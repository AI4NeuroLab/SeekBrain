import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRunRepository } from "../../src/core/index.ts";
import { PlanWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

describe("plan workflow", () => {
  it("plans through an injected agent and persists state plus the review gate", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-plan-stage-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "stored question");
      await lifecycle.updateState(run, {
        metadata_locked: true,
        data_info: "locked data",
        extra_path_info: "locked path",
        targeted_skill: "stored skill",
        deep_research_context: "stored research",
        inherited_context: { source_round: 1 },
        human_reviews: { plan: { feedback: ["add a control", { text: "state assumptions" }] } },
      });
      const events: any[] = [];
      let capturedPrompt = "";
      const workflow = new PlanWorkflow({
        lifecycle,
        runAgent: async ({ prompt }) => {
          capturedPrompt = prompt;
          return {
            ok: true,
            result: {
              plan_markdown: "# Test plan",
              review_summary: "review this plan",
              summary: "summary",
              confidence: 0.8,
              warnings: [],
            },
            output_path: "output.json",
          };
        },
        writeText: (path, value) => writeFile(path, value),
        appendEvent: async (event) => { events.push(event); },
      });
      const result = await workflow.execute({
        cwd,
        runId: run.runId,
        dataInfo: "ignored data",
        extraPathInfo: "ignored path",
        additionalContext: "main-agent context",
        rolePrompt: "planner role",
        agentConfig: {},
        finalizeSchema: {},
        humanReviewRequired: true,
      });

      expect(capturedPrompt).toContain("Question:\nstored question");
      expect(capturedPrompt).toContain("Data info:\nlocked data");
      expect(capturedPrompt).toContain("Prior-round reusable context (read-only)");
      expect(capturedPrompt).toContain("1. add a control\n2. state assumptions");
      expect(capturedPrompt).toContain("Additional context from the main agent:\nmain-agent context");
      expect(await readFile(join(run.runDir, "plan.md"), "utf8")).toBe("# Test plan");
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.plan.review_summary).toBe("review this plan");
      expect(state.data_info).toBe("locked data");
      expect(events[0]).toMatchObject({ event: "seekbrain_formulation_generate", ok: true });
      expect(result).toMatchObject({
        ok: true,
        plan_markdown: "# Test plan",
        human_review: { required: true, approved: false, needs_user_review: true, review_owner: "main_agent" },
      });
      expect(result.guidance).toContain("seekbrain_formulation_researcher_review");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
