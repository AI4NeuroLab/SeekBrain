import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson } from "../../src/core/index.ts";
import { ReporterWorkflow } from "../../src/workflows/index.ts";

function hierarchy() {
  return {
    schema_version: 2,
    kind: "research_planning_hierarchical_evidence",
    selection_authoritative: true,
    research_goal: "Test the integrated hypothesis.",
    synthesis_strategy: "Combine SQ1 evidence.",
    subquestions: [{ id: "SQ1", question: "Does the effect exist?", hypothesis: "Yes", role_in_overall_conclusion: "Primary", evidence_ids: ["SQ1-T1"] }],
    plan_evidence: [{ evidence_id: "SQ1-T1", subquestion_id: "SQ1", summary: "Effect 0.5", limitations: [], source_paths: { statistics: "/run/statistics.json" } }],
    figures: [{ figure_id: "SQ1-T1:F1", figure_number: 1, evidence_id: "SQ1-T1", relative_path: "assets/figure-001.png", source_path: "/run/figure.png" }],
    tables: [],
    literature: { sources: [] },
  };
}

describe("ReporterWorkflow", () => {
  it("performs hierarchical synthesis without reloading images and writes Markdown plus PDF provenance", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "seekbrain-reporter-"));
    try {
      const hierarchyPath = join(reportDir, "hierarchical_evidence.json");
      await atomicWriteJson(hierarchyPath, hierarchy());
      let call = 0;
      let pdfInput: any;
      const workflow = new ReporterWorkflow({
        runAgent: async (input) => {
          expect(input.images).toEqual([]);
          call += 1;
          if (call === 1) return { ok: true, result: {
            subquestion_id: "SQ1", conclusion: "The effect exists.",
            key_results: [{ finding: "Effect 0.5", evidence_ids: ["SQ1-T1"], figure_refs: ["SQ1-T1:F1"], table_refs: [] }],
            supporting_evidence_ids: ["SQ1-T1"], contradictions: [], limitations: [], figure_refs: ["SQ1-T1:F1"], table_refs: [],
          } };
          if (call === 2) return { ok: true, result: {
            answer: "The integrated hypothesis is supported.",
            integrated_findings: [{ finding: "Effect 0.5", subquestion_ids: ["SQ1"], evidence_ids: ["SQ1-T1"], figure_refs: ["SQ1-T1:F1"], table_refs: [] }],
            agreements: [], disagreements: [], limitations: [], supporting_subquestion_ids: ["SQ1"], supporting_evidence_ids: ["SQ1-T1"],
          } };
          expect(input.prompt).toContain("Hierarchical scientific evidence");
          return { ok: true, result: {
            report_markdown: [
              "# Integrated Scientific Effect", "", "## Abstract", "Effect 0.5 [SQ1; SQ1-T1].",
              "", "## Introduction", "The hypothesis was tested [SQ1-T1].",
              "", "## Results", "", "### Sub-question 1: Effect", "The effect was observed (Figure 1) [SQ1; SQ1-T1].",
              "", "![Figure 1. Effect](assets/figure-001.png)", "", "**Figure 1 | Observed effect.** Evidence: SQ1-T1. Source: /run/figure.png.",
              "", "## Discussion", "The evidence supports the hypothesis [SQ1-T1].",
              "", "## Limitations", "No additional limitations [SQ1-T1].",
              "", "## Conclusion", "The integrated hypothesis is supported [SQ1; SQ1-T1].",
            ].join("\n"),
            title: "Integrated Scientific Effect", abstract: "Effect 0.5.",
            sections: [{ heading: "Results", body: "Effect 0.5." }],
            figure_legends: [{ figure_id: "SQ1-T1:F1", figure_number: 1, title: "Observed effect", caption: "Effect 0.5", panels: [] }],
            key_claims: [{ claim: "Effect observed", evidence_ids: ["SQ1-T1"], figure_refs: [{ figure_id: "SQ1-T1:F1", panels: [] }], data_source: "/run/statistics.json", reasoning: "effect=0.5" }],
            limitations: [],
          } };
        },
        writeJson: atomicWriteJson,
        writeText: (path, value) => writeFile(path, value),
        exportPdf: async (input) => { pdfInput = input; await writeFile(input.pdfPath, "%PDF-test"); return { ok: true, pdf_path: input.pdfPath }; },
      });
      const result = await workflow.execute({ hierarchicalEvidencePath: hierarchyPath, rolePrompt: "Reporter role", agentConfig: {}, finalizeSchema: {}, pdf: { enabled: true, command: "seekbrain-pdf", timeout_seconds: 120 } });
      expect(result).toMatchObject({ ok: true, task_count: 1, subquestion_count: 1, figure_count: 1, pdf_generated: true });
      expect(call).toBe(3);
      expect(pdfInput).toMatchObject({ markdownPath: join(reportDir, "report.md"), pdfPath: join(reportDir, "report.pdf") });
      expect(await readFile(result.report_path, "utf8")).toContain("## Discussion");
      const savedHierarchy = JSON.parse(await readFile(hierarchyPath, "utf8"));
      expect(savedHierarchy.subquestion_conclusions[0].supporting_evidence_ids).toEqual(["SQ1-T1"]);
      expect(savedHierarchy.overall_synthesis.supporting_subquestion_ids).toEqual(["SQ1"]);
      const report = JSON.parse(await readFile(result.report_json_path, "utf8"));
      expect(report.selected_evidence_ids).toEqual(["SQ1-T1"]);
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });

  it("rejects a final report that omits the required academic section structure", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "seekbrain-reporter-invalid-"));
    try {
      const hierarchyPath = join(reportDir, "hierarchical_evidence.json");
      await atomicWriteJson(hierarchyPath, hierarchy());
      let call = 0;
      const workflow = new ReporterWorkflow({
        runAgent: async () => {
          call += 1;
          if (call === 1) return { ok: true, result: { subquestion_id: "SQ1", conclusion: "yes", key_results: [], supporting_evidence_ids: ["SQ1-T1"], contradictions: [], limitations: [], figure_refs: [], table_refs: [] } };
          if (call === 2) return { ok: true, result: { answer: "yes", integrated_findings: [], agreements: [], disagreements: [], limitations: [], supporting_subquestion_ids: ["SQ1"], supporting_evidence_ids: ["SQ1-T1"] } };
          return { ok: true, result: { report_markdown: "# Incomplete", title: "Incomplete", abstract: "", sections: [], figure_legends: [], key_claims: [], limitations: [] } };
        },
        writeJson: atomicWriteJson,
        writeText: (path, value) => writeFile(path, value),
      });
      await expect(workflow.execute({ hierarchicalEvidencePath: hierarchyPath, rolePrompt: "role", agentConfig: {}, finalizeSchema: {} }))
        .resolves.toMatchObject({ ok: false, error: expect.stringContaining("Abstract") });
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });
});
