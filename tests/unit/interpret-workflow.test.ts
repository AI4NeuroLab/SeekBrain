import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { InterpretWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-interpret-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const research = await lifecycle.startResearch({
    cwd,
    projectPath: "project",
    question: "Which zebrafish neural populations respond to visual stimuli?",
  });
  const figurePath = join(research.run.runDir, "figure.png");
  await writeFile(figurePath, "test image bytes");
  await writeFile(join(research.run.runDir, "statistics.json"), JSON.stringify({ n: 22, effect: 0.42, genes: ["eomesa", "pvalb7"] }));
  await lifecycle.updateState(research.run, {
    code_attempt: 1,
    code: {
      code_files: [{ path: "generated_code.py" }],
      statistics: { n: 22, effect: 0.42, genes: ["eomesa", "pvalb7"] },
      warnings: ["Exploratory execution: analyzed 12 of 22 eligible fish"],
    },
    validation: { pass: true, route: "proceed", validated_code_attempt: 1 },
    checks: { dummy_data_signals: [] },
    deep_research_context: "Prior work predicts a positive effect.",
    artifacts: [{ name: "figure.png", path: figurePath, kind: "figure", role: "main" }],
  });
  return { cwd, lifecycle, research };
}

function dependencies(item: Awaited<ReturnType<typeof fixture>>) {
  return {
    lifecycle: item.lifecycle,
    currentArtifactsValidated: () => true,
    nextStep: () => ({ tool: "seekbrain_code_execute" }),
    loadImages: async () => ({ images: [{ type: "image", data: "encoded" }], warnings: [] }),
    runAgent: async () => ({ ok: false }),
    writeJson: atomicWriteJson,
    writeText: async (path: string, value: string) => { await writeFile(path, value); },
    snapshot: async () => undefined,
    appendEvent: async () => undefined,
  };
}

describe("Interpret workflow", () => {
  it("separates evidence research from conclusion writing", async () => {
    const item = await fixture();
    try {
      const calls: string[] = [];
      const capturedPrompts: string[] = [];
      const capturedImageCounts: number[] = [];
      const workflow = new InterpretWorkflow({
        ...dependencies(item),
        retrievePapers: async () => ({
          ok: true,
          paper_source: "ailab_rag",
          sources: [{
            title: "Relevant neuroscience study",
            text: "# Results\n\nVisual stimuli recruit molecularly diverse zebrafish neural populations.",
          }],
        }),
        runAgent: async ({ prompt, images, customTools }) => {
          calls.push("seekbrain_interpretation_run");
          capturedPrompts.push(prompt);
          capturedImageCounts.push(images.length);
          if (customTools?.length) {
            const search = customTools.find((tool) => tool.name === "search_neuroscience_literature");
            const searchResult: any = await search?.execute("search-1", {
              query: "zebrafish visual neural populations",
              purpose: "Interpret the observed response",
            });
            const response = JSON.parse(searchResult.content[0].text);
            return {
              ok: true,
              result: {
                result_findings: [{
                  id: "R1",
                  finding: "A positive neural response was measured.",
                  relationship_type: "population_response",
                  quantitative_support: ["effect: 0.42"],
                  scope: "22 zebrafish",
                  evidence_origin: "statistics",
                  strength: "direct",
                }],
                cross_result_relationships: [],
                literature_links: [{
                  result_ids: ["R1"],
                  source_ids: [response.sources[0].source_id],
                  biological_context: "Visual stimuli can recruit molecularly diverse neural populations.",
                  scope_fit: "direct",
                  interpretation_level: "contextual",
                  boundary: "The current analysis does not establish cell identity.",
                }],
                unresolved_interpretations: [],
              },
            };
          }
          return { ok: true, result: {
            claims: [{
              id: "C1",
              observation: "The analysis measured a positive neural response (effect 0.42).",
              result_evidence: ["R1"],
              biological_interpretation: "This is consistent with recruitment of molecularly diverse visual populations.",
              literature_evidence: ["S1"],
              interpretation_level: "supported_context",
              boundary: "The analysis does not establish the responding cell identities.",
            }],
            primary_claim_id: "C1",
            limitations: [],
            next_research_directions: [],
          } };
        },
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.research.run.runId,
        rolePrompt: "Interpret validated evidence.",
        agentConfig: { vision: true, rag: { paper_source: "ailab_rag" } },
        finalizeSchema: {},
      });
      expect(calls).toEqual(["seekbrain_interpretation_run", "seekbrain_interpretation_run"]);
      expect(capturedPrompts[0]).toContain("search_neuroscience_literature");
      expect(capturedPrompts[0]).toContain(`Statistics file:\n${join(item.research.run.runDir, "statistics.json")}`);
      expect(capturedPrompts[0]).not.toContain("Essential statistics:");
      expect(capturedPrompts[1]).toContain("InterpretationEvidence");
      expect(capturedPrompts[1]).toContain('"source_id": "S1"');
      expect(capturedImageCounts).toEqual([1, 0]);
      expect(result).toMatchObject({ ok: true, interpretation_path: join(item.research.run.runDir, "conclusions.json") });
      expect(existsSync(join(item.research.run.runDir, "conclusion_baseline.json"))).toBe(false);
      expect(existsSync(join(item.research.run.runDir, "biological_interpretation.json"))).toBe(false);
      expect(existsSync(join(item.research.run.runDir, "conclusion_gate.json"))).toBe(false);
      expect(existsSync(join(item.research.run.runDir, "conclusion_result_evidence.json"))).toBe(true);
      expect(existsSync(join(item.research.run.runDir, "conclusion_evidence.json"))).toBe(true);
      const trace = JSON.parse(await readFile(join(item.research.run.runDir, "conclusion_research_sources.json"), "utf8"));
      expect(trace.selected_evidence).toHaveLength(1);
      expect(trace.retrieved_sources[0].source_id).toBe("S1");
      const conclusions = JSON.parse(await readFile(join(item.research.run.runDir, "conclusions.json"), "utf8"));
      expect(conclusions.summary).toBe(conclusions.conclusions[0]);
      expect(conclusions.summary).not.toContain("does not establish the responding cell identities");
      expect(conclusions.limitations).toEqual([]);
    } finally { await rm(item.cwd, { recursive: true, force: true }); }
  });

  it("persists conclusions when literature retrieval is unavailable", async () => {
    const item = await fixture();
    try {
      const workflow = new InterpretWorkflow({
        ...dependencies(item),
        retrievePapers: async () => ({ ok: false, sources: [], error: "provider unavailable" }),
        runAgent: async ({ customTools }) => {
          if (customTools?.length) {
            const search = customTools.find((tool) => tool.name === "search_neuroscience_literature");
            await search?.execute("search-1", { query: "zebrafish visual response", purpose: "Interpret response" });
            return { ok: true, result: {
              result_findings: [{
                id: "R1", finding: "A positive response was measured.", relationship_type: "response",
                quantitative_support: ["effect: 0.42"], scope: "current cohort", evidence_origin: "statistics", strength: "direct",
              }],
              cross_result_relationships: [], literature_links: [],
              unresolved_interpretations: [{
                result_ids: ["R1"], question: "Which biological population explains the response?",
                reason: "Literature retrieval was unavailable.",
              }],
            } };
          }
          return { ok: true, result: {
            claims: [{
              id: "C1", observation: "A positive response was measured (effect 0.42).",
              result_evidence: ["R1"], interpretation_level: "observed_only",
            }],
            primary_claim_id: "C1", limitations: [], next_research_directions: [],
          } };
        },
      });
      const result = await workflow.execute({
        cwd: item.cwd, runId: item.research.run.runId, rolePrompt: "Interpret evidence.",
        agentConfig: { vision: true, rag: { paper_source: "ailab_rag" } }, finalizeSchema: {},
      });
      expect(result.ok).toBe(true);
      const trace = JSON.parse(await readFile(join(item.research.run.runDir, "conclusion_research_sources.json"), "utf8"));
      expect(trace.attempts[0]).toMatchObject({ ok: false, error: "provider unavailable" });
    } finally { await rm(item.cwd, { recursive: true, force: true }); }
  });

  it("removes biological interpretation linked to an unknown retrieval source", async () => {
    const item = await fixture();
    try {
      let call = 0;
      const workflow = new InterpretWorkflow({
        ...dependencies(item),
        retrievePapers: async () => ({
          ok: true,
          paper_source: "ailab_rag",
          sources: [{ title: "Retrieved study", text: "# Results\n\nA relevant observation." }],
        }),
        runAgent: async ({ customTools }) => {
          call += 1;
          if (call === 1) {
            const search = customTools?.find((tool) => tool.name === "search_neuroscience_literature");
            await search?.execute("search-1", { query: "zebrafish visual response", purpose: "Interpret response" });
            return { ok: true, result: {
              result_findings: [{
                id: "R1", finding: "A positive response was measured.", relationship_type: "response",
                quantitative_support: ["effect: 0.42"], scope: "current cohort", evidence_origin: "statistics", strength: "direct",
              }],
              literature_links: [{
                result_ids: ["R1"], source_ids: ["S999"], biological_context: "Unsupported context",
                scope_fit: "direct", interpretation_level: "direct", boundary: "Unknown",
              }],
              unresolved_interpretations: [],
            } };
          }
          return { ok: true, result: {
            claims: [{
              id: "C1", observation: "A positive response was measured (effect 0.42).",
              result_evidence: ["R1"], biological_interpretation: "This proves a specific biological mechanism.",
              literature_evidence: ["S999"], interpretation_level: "supported_context",
            }],
            primary_claim_id: "C1", limitations: [], next_research_directions: [],
          } };
        },
      });
      const result = await workflow.execute({
        cwd: item.cwd, runId: item.research.run.runId, rolePrompt: "writer", researchRolePrompt: "researcher",
        agentConfig: { vision: true, rag: { paper_source: "ailab_rag" } }, finalizeSchema: {},
      });
      expect(result.ok).toBe(true);
      const conclusions = JSON.parse(await readFile(join(item.research.run.runDir, "conclusions.json"), "utf8"));
      expect(conclusions.conclusions).toEqual(["A positive response was measured (effect 0.42)."]);
      const trace = JSON.parse(await readFile(join(item.research.run.runDir, "conclusion_research_sources.json"), "utf8"));
      expect(trace.selected_evidence).toEqual([]);
      expect(trace.unresolved_gaps).toContain("Rejected unknown literature source ID: S999");
    } finally { await rm(item.cwd, { recursive: true, force: true }); }
  });

  it("blocks interpretation until current artifacts are validated", async () => {
    const item = await fixture();
    try {
      let invoked = false;
      const workflow = new InterpretWorkflow({
        ...dependencies(item),
        currentArtifactsValidated: () => false,
        runAgent: async () => { invoked = true; return { ok: false }; },
      });
      const result = await workflow.execute({
        cwd: item.cwd, runId: item.research.run.runId, rolePrompt: "role", agentConfig: {}, finalizeSchema: {},
      });
      expect(invoked).toBe(false);
      expect(result).toMatchObject({ ok: false, next_step: { tool: "seekbrain_validation_run" } });
    } finally { await rm(item.cwd, { recursive: true, force: true }); }
  });
});
