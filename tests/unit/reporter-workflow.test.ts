import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson } from "../../src/core/index.ts";
import { ReporterWorkflow } from "../../src/workflows/index.ts";

describe("ReporterWorkflow", () => {
  it("uses only the authoritative bundle and writes canonical Markdown plus structured provenance", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "seekbrain-reporter-"));
    try {
      const bundlePath = join(reportDir, "evidence_bundle.json");
      await atomicWriteJson(bundlePath, {
        schema_version: 1,
        selection_authoritative: true,
        report_goal: "Synthesize selected evidence.",
        evidence: [{
          evidence_id: "ROUND:2",
          question: "Selected question",
          statistics: { effect: 0.5 },
          figures: [
            { figure_id: "ROUND:2:F1", figure_number: 1, asset_path: "/tmp/figure.png", relative_path: "assets/figure-001.png", supplemental_assets: [{ asset_path: "/tmp/figure.pdf" }] },
            { figure_id: "ROUND:2:F2", figure_number: 2, asset_path: "/tmp/supplement-only.pdf", relative_path: "assets/figure-002.pdf" },
          ],
        }],
      });
      let prompt = "";
      let loadedPaths: string[] = [];
      let pdfInput: any;
      const workflow = new ReporterWorkflow({
        loadImages: async (paths) => {
          loadedPaths = paths;
          return { images: paths.map(() => ({ type: "image" })), warnings: [], loaded_paths: paths };
        },
        runAgent: async (input) => {
          prompt = input.prompt;
          expect(input.images).toHaveLength(1);
          return { ok: true, result: {
            report_markdown: "# Selected Report\n\nEvidence from ROUND:2.",
            title: "Selected Report",
            abstract: "Selected evidence only.",
            sections: [{ heading: "Evidence Synthesis", body: "Effect 0.5." }],
            figure_legends: [{ figure_id: "ROUND:2:F1", figure_number: 1, title: "Effect", caption: "Selected effect", panels: [] }],
            key_claims: [{ claim: "Effect observed", evidence_ids: ["ROUND:2"], figure_refs: [{ figure_id: "ROUND:2:F1", panels: ["single"] }], data_source: "effect=0.5", reasoning: "positive value" }],
            limitations: [],
          } };
        },
        writeJson: atomicWriteJson,
        writeText: async (path, value) => { const { writeFile } = await import("node:fs/promises"); await writeFile(path, value); },
        exportPdf: async (input) => { pdfInput = input; return { ok: true, pdf_path: input.pdfPath }; },
      });
      const result = await workflow.execute({ evidenceBundlePath: bundlePath, rolePrompt: "Reporter role", agentConfig: { vision: true }, finalizeSchema: {}, pdf: { enabled: true, command: "md-to-pdf", timeout_seconds: 120 } });
      expect(result).toMatchObject({ ok: true, selected_count: 1, figure_count: 2, pdf_generated: true, pdf_path: join(reportDir, "report.pdf") });
      expect(pdfInput).toMatchObject({ markdownPath: join(reportDir, "report.md"), pdfPath: join(reportDir, "report.pdf"), command: "md-to-pdf" });
      expect(loadedPaths).toEqual(["/tmp/figure.png"]);
      expect(prompt).toContain("Selected evidence IDs:\n- ROUND:2");
      expect(prompt).toContain('"attached_image_index": null');
      expect(prompt).not.toContain("coverage warning");
      expect(await readFile(result.report_path, "utf8")).toContain("Selected Report");
      const json = JSON.parse(await readFile(result.report_json_path, "utf8"));
      expect(json.selected_evidence_ids).toEqual(["ROUND:2"]);
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });

  it("rejects claims that point outside the selected bundle", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "seekbrain-reporter-invalid-"));
    try {
      const bundlePath = join(reportDir, "evidence_bundle.json");
      await atomicWriteJson(bundlePath, { schema_version: 1, selection_authoritative: true, evidence: [{ evidence_id: "ROUND:1", figures: [] }] });
      const workflow = new ReporterWorkflow({
        loadImages: async () => ({ images: [], warnings: [] }),
        runAgent: async () => ({ ok: true, result: {
          report_markdown: "invalid", title: "invalid", abstract: "", sections: [], figure_legends: [],
          key_claims: [{ claim: "wrong", evidence_ids: ["ROUND:9"], figure_refs: [], data_source: "", reasoning: "" }], limitations: [],
        } }),
        writeJson: atomicWriteJson,
        writeText: async () => {},
      });
      await expect(workflow.execute({ evidenceBundlePath: bundlePath, rolePrompt: "role", agentConfig: {}, finalizeSchema: {} })).resolves.toMatchObject({ ok: false, invalid_claims: [{ evidence_ids: ["ROUND:9"] }] });
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });

  it("accepts one claim backed by multiple selected evidence items and figures", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "seekbrain-reporter-multi-"));
    try {
      const bundlePath = join(reportDir, "evidence_bundle.json");
      await atomicWriteJson(bundlePath, {
        schema_version: 1,
        selection_authoritative: true,
        evidence: [
          { evidence_id: "SQ1-T1:R1", figures: [{ figure_id: "SQ1-T1:R1:F1", asset_path: "/tmp/a.png" }] },
          { evidence_id: "SQ2-T1:R1", figures: [{ figure_id: "SQ2-T1:R1:F1", asset_path: "/tmp/b.png" }] },
        ],
      });
      const workflow = new ReporterWorkflow({
        loadImages: async (paths) => ({ images: paths.map(() => ({ type: "image" })), warnings: [], loaded_paths: paths }),
        runAgent: async () => ({ ok: true, result: {
          report_markdown: "# Synthesis", title: "Synthesis", abstract: "", sections: [], figure_legends: [],
          key_claims: [{
            claim: "Convergent result",
            evidence_ids: ["SQ1-T1:R1", "SQ2-T1:R1"],
            figure_refs: [
              { figure_id: "SQ1-T1:R1:F1", panels: ["A"] },
              { figure_id: "SQ2-T1:R1:F1", panels: ["single"] },
            ],
            data_source: "selected results", reasoning: "convergence",
          }],
          limitations: [],
        } }),
        writeJson: atomicWriteJson,
        writeText: async (path, value) => { const { writeFile } = await import("node:fs/promises"); await writeFile(path, value); },
      });
      const result = await workflow.execute({ evidenceBundlePath: bundlePath, rolePrompt: "role", agentConfig: {}, finalizeSchema: {} });
      expect(result).toMatchObject({ ok: true, selected_count: 2, figure_count: 2 });
      const report = JSON.parse(await readFile(result.report_json_path, "utf8"));
      expect(report.key_claims[0].evidence_ids).toEqual(["SQ1-T1:R1", "SQ2-T1:R1"]);
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });

  it("rejects the retired singular provenance fields", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "seekbrain-reporter-legacy-"));
    try {
      const bundlePath = join(reportDir, "evidence_bundle.json");
      await atomicWriteJson(bundlePath, {
        schema_version: 1,
        selection_authoritative: true,
        evidence: [{ evidence_id: "ROUND:1", figures: [{ figure_id: "ROUND:1:F1", asset_path: "/tmp/a.png" }] }],
      });
      const workflow = new ReporterWorkflow({
        loadImages: async (paths) => ({ images: paths.map(() => ({ type: "image" })), warnings: [], loaded_paths: paths }),
        runAgent: async () => ({ ok: true, result: {
          report_markdown: "legacy", title: "legacy", abstract: "", sections: [], figure_legends: [],
          key_claims: [{ claim: "legacy", evidence_id: "ROUND:1", figure_id: "ROUND:1:F1", panel: "single", data_source: "", reasoning: "" }],
          limitations: [],
        } }),
        writeJson: atomicWriteJson,
        writeText: async () => {},
      });
      await expect(workflow.execute({ evidenceBundlePath: bundlePath, rolePrompt: "role", agentConfig: {}, finalizeSchema: {} }))
        .resolves.toMatchObject({ ok: false, error: "Report Agent produced an invalid evidence_ids or figure_refs provenance reference." });
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });

  it("persists a diagnostic when the Reporter does not finalize", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "seekbrain-reporter-failure-"));
    try {
      const bundlePath = join(reportDir, "evidence_bundle.json");
      await atomicWriteJson(bundlePath, {
        schema_version: 1,
        selection_authoritative: true,
        evidence: [{ evidence_id: "SQ1-T1:R1", figures: [{ figure_id: "SQ1-T1:R1:F1", figure_number: 1, asset_path: "/tmp/figure.png" }] }],
      });
      const workflow = new ReporterWorkflow({
        loadImages: async (paths) => ({ images: paths.map(() => ({ type: "image" })), warnings: [], loaded_paths: paths }),
        runAgent: async () => ({ ok: false, error: "subagent did not call finalize_seekbrain_report" }),
        writeJson: atomicWriteJson,
        writeText: async () => {},
      });
      const result = await workflow.execute({ evidenceBundlePath: bundlePath, rolePrompt: "role", agentConfig: {}, finalizeSchema: {} });
      expect(result).toMatchObject({ ok: false, error_path: join(reportDir, "report_error.json") });
      const diagnostic = JSON.parse(await readFile(result.error_path, "utf8"));
      expect(diagnostic).toMatchObject({ phase: "model_generation", finalize_called: false, loaded_image_paths: ["/tmp/figure.png"] });
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });
});
