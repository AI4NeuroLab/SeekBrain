import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRunRepository } from "../../src/core/index.ts";
import {
  CreativeResearchPlanningWorkflow,
  RunLifecycleWorkflow,
} from "../../src/workflows/index.ts";

function ideas(mediumId = "H2") {
  return {
    session_summary: "Three distinct testable explanations.",
    target_abstraction: {
      observed_pattern: "A population changes state over time.",
      entities: "observed units",
      relation: "state composition changes with time",
      candidate_dynamics: ["transition", "selection"],
      observable_signature: "a reproducible temporal change",
    },
    frozen_constraints: ["Use only recorded variables"],
    ideas: [
      {
        idea_id: "H1", temperature: "low", parent_ids: [], title: "Direct transition",
        research_question: "Does the observed population undergo a data-supported transition?",
        core_anomaly: "State composition changes.", hypothesis: "The change reflects a direct transition.",
        mechanism: "Recorded units move between measurable states.",
        remote_transfer: { source_domain: "", transferred_mechanism: "" },
        why_data_can_test: "Repeated state measurements are available.",
        discriminating_prediction: "Transitions precede composition changes.",
        nearest_prior_boundary: "Not searched.", strongest_counterevidence: "Sampling drift.",
        minimal_decisive_analysis: "Estimate transition-linked composition change.", evidence_ids: [],
        method_ids: [],
        lineage: { user: ["temporal change"], retrieval: [], seekbrain: ["transition test"] },
      },
      {
        idea_id: mediumId, temperature: "medium", parent_ids: mediumId === "H2" ? [] : ["H2"], title: "Transferred competition",
        research_question: "Does competition between latent states explain the change?",
        core_anomaly: "One state expands as another contracts.", hypothesis: "Competing states drive the change.",
        mechanism: "A transferable competition mechanism redistributes occupancy.",
        remote_transfer: { source_domain: "ecology", transferred_mechanism: "competitive occupancy" },
        why_data_can_test: "The dataset records both state abundances.",
        discriminating_prediction: "Reciprocal changes exceed independent drift.",
        nearest_prior_boundary: "Bounded by E1.", strongest_counterevidence: "A shared external driver.",
        minimal_decisive_analysis: "Compare coupled and independent state-change models.", evidence_ids: ["E1", "invented"],
        method_ids: ["M1", "invented"],
        lineage: { user: [], retrieval: ["ecological competition"], seekbrain: ["occupancy prediction"] },
      },
      {
        idea_id: "H3", temperature: "high", parent_ids: [], title: "Measurement alternative",
        research_question: "Is the apparent transition caused by changing measurement resolution?",
        core_anomaly: "New states appear abruptly.", hypothesis: "Resolution change creates apparent states.",
        mechanism: "Measurement sensitivity changes state separability.",
        remote_transfer: { source_domain: "measurement science", transferred_mechanism: "resolution-dependent classes" },
        why_data_can_test: "Quality and separability can be measured.",
        discriminating_prediction: "Class changes track quality rather than biological markers.",
        nearest_prior_boundary: "Not searched.", strongest_counterevidence: "Stable quality with marker changes.",
        minimal_decisive_analysis: "Test class emergence against quality and marker trajectories.", evidence_ids: [],
        method_ids: [],
        lineage: { user: [], retrieval: [], seekbrain: ["measurement alternative"] },
      },
    ],
  };
}

describe("creative research planning workflow", () => {
  it("persists three temperatures, revisions, evidence provenance, and a selected certificate", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-creative-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "Find a valuable explanation for the temporal state change.");
      await lifecycle.updateState(run, {
        data_info: JSON.stringify({ observations: "states by time", quality_metric: true }),
        research_planning: { status: "pending_review", assessment: { task_brief: { hard_constraints: [] } } },
      });
      let call = 0;
      const workflow = new CreativeResearchPlanningWorkflow({
        lifecycle,
        runAgent: async ({ prompt }) => {
          expect(prompt).toContain("Do not search");
          call += 1;
          if (call === 2) expect(prompt).toContain("Requested operation: crossover");
          return { ok: true, result: ideas(call === 1 ? "H2" : "H4") };
        },
        writeJson: async (path, value) => {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, JSON.stringify(value, null, 2));
        },
        appendEvent: async () => {},
      });
      const creativeDir = join(run.runDir, "creative_research");
      await mkdir(creativeDir, { recursive: true });
      await writeFile(join(creativeDir, "creative_search_pool.json"), JSON.stringify({
        entries: [{ evidence_id: "E1", intent: "nearest_prior" }],
        methods: [{ method_id: "M1", status: "available", reusable_component: "competition model" }],
      }));

      const started = await workflow.start({ cwd, runId: run.runId, rolePrompt: "creative role", agentConfig: {}, finalizeSchema: {} });
      expect(started).toMatchObject({ ok: true, idea_count: 3, needs_idea_selection: true });
      expect(started.idea_cards.map((idea: any) => idea.temperature)).toEqual(["low", "medium", "high"]);
      expect(started.idea_cards[1].evidence_ids).toEqual(["E1"]);
      expect(started.idea_cards[1].method_ids).toEqual(["M1"]);

      const updated = await workflow.update({
        cwd, runId: run.runId, rolePrompt: "creative role", agentConfig: {}, finalizeSchema: {},
        operation: "crossover", instruction: "Use the medium mechanism with the low-temperature test.", sourceIdeaIds: ["H2", "H1"],
      });
      expect(updated).toMatchObject({ ok: true, operation: "crossover" });
      expect(updated.idea_cards[1]).toMatchObject({ idea_id: "H4", parent_ids: ["H2"] });
      await expect(readFile(updated.history_path, "utf8")).resolves.toContain('"idea_id": "H2"');

      const selected = await workflow.select({ cwd, runId: run.runId, ideaId: "H4" });
      expect(selected).toMatchObject({
        ok: true,
        research_question_certificate: {
          idea_id: "H4",
          selected_hypothesis: "Competing states drive the change.",
          evidence_ids: ["E1"],
        },
      });
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.research_planning).toMatchObject({
        status: "pending_review",
        creative_status: "idea_selected",
        selected_idea_id: "H4",
        research_question_certificate: { idea_id: "H4" },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
