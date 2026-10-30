import { describe, expect, it, vi } from "vitest";
import { createResearchPlanningTools } from "../../src/extension/runtime/stages/research-planning-tools.ts";

function baseDeps(strategy: "standard" | "creative") {
  return {
    projectRoot: "/project",
    lifecycle: {},
    taskBriefWorkflow: {},
    scheduler: {},
    loadConfig: async () => ({}),
    workflowConfig: () => ({
      research_planning_strategy: strategy,
      research_survey: true,
      research_planning_peer_review: true,
      has_literature_provider: true,
    }),
    readPrompt: async (name: string) => `${name} prompt`,
    pickAgentConfig: () => ({}),
    pickLiteratureAgentConfig: () => ({}),
    resolveRun: async () => ({ state: {} }),
    setActiveRunDir() {},
    content: (details: any) => details,
  } as any;
}

describe("creative Research Planning tool boundary", () => {
  it("routes only the creative strategy to Idea Card generation and bypasses the standard survey", async () => {
    const deps = baseDeps("creative");
    deps.creativeSearchWorkflow = { search: vi.fn(async () => ({ ok: true, request_id: "SR1", method_count: 2 })) };
    deps.creativeWorkflow = { start: vi.fn(async () => ({ ok: true, research_planning_strategy: "creative", idea_count: 3 })) };
    deps.surveyWorkflow = { execute: vi.fn(async () => { throw new Error("standard survey must not run"); }) };
    deps.planningWorkflow = {};
    const tool = createResearchPlanningTools(deps).find((item) => item.name === "seekbrain_planning_generate")!;
    const result = await tool.execute("creative", { run_id: "run-1" }, undefined, undefined, { cwd: "/cwd" } as any);
    expect(result).toMatchObject({
      ok: true,
      research_planning_strategy: "creative",
      idea_count: 3,
      initial_search: { ok: true, request_id: "SR1", method_count: 2 },
    });
    expect(deps.creativeSearchWorkflow.search).toHaveBeenCalledOnce();
    expect(deps.creativeWorkflow.start).toHaveBeenCalledOnce();
    expect(deps.surveyWorkflow.execute).not.toHaveBeenCalled();
  });

  it("leaves the standard survey and hierarchical planner path unchanged", async () => {
    const deps = baseDeps("standard");
    deps.creativeWorkflow = { start: vi.fn() };
    deps.surveyWorkflow = { execute: vi.fn(async () => ({ ok: true, status: "ready", source_count: 2 })) };
    deps.planningWorkflow = {
      prepareSubquestions: vi.fn(async () => ({ ok: true, subquestion_count: 2, task_count: 2 })),
    };
    const tool = createResearchPlanningTools(deps).find((item) => item.name === "seekbrain_planning_generate")!;
    const result = await tool.execute("standard", { run_id: "run-1" }, undefined, undefined, { cwd: "/cwd" } as any);
    expect(result).toMatchObject({ ok: true, subquestion_count: 2, task_count: 2 });
    expect(deps.surveyWorkflow.execute).toHaveBeenCalledOnce();
    expect(deps.planningWorkflow.prepareSubquestions).toHaveBeenCalledOnce();
    expect(deps.creativeWorkflow.start).not.toHaveBeenCalled();
  });

  it("waits for the planning decision after a Creative Idea Card is selected", async () => {
    const deps = baseDeps("creative");
    deps.creativeWorkflow = {
      select: vi.fn(async () => ({
        ok: true,
        run_id: "run-1",
        selected_idea: { idea_id: "H2" },
        needs_planning_decision: true,
        next_tool: "seekbrain_planning_decision_review",
      })),
    };
    deps.planningWorkflow = { prepareSubquestions: vi.fn() };
    const tool = createResearchPlanningTools(deps).find((item) => item.name === "seekbrain_creative_select")!;
    const result = await tool.execute("select", { run_id: "run-1", idea_id: "H2" }, undefined, undefined, { cwd: "/cwd" } as any);
    expect(result).toMatchObject({
      ok: true,
      selected_idea: { idea_id: "H2" },
      needs_planning_decision: true,
      next_tool: "seekbrain_planning_decision_review",
    });
    expect(deps.planningWorkflow.prepareSubquestions).not.toHaveBeenCalled();
  });

  it("generates the hierarchy only after the selected Creative idea is approved", async () => {
    const deps = baseDeps("creative");
    deps.resolveRun = async () => ({
      state: {
        research_planning: {
          status: "approved",
          creative_status: "idea_selected",
          research_question_certificate: { idea_id: "H2", scientific_question: "Test H2." },
        },
      },
    });
    deps.planningWorkflow = {
      prepareSubquestions: vi.fn(async () => ({ ok: true, subquestion_count: 2, task_count: 2 })),
    };
    deps.creativeSearchWorkflow = { search: vi.fn() };
    deps.creativeWorkflow = { start: vi.fn() };
    const tool = createResearchPlanningTools(deps).find((item) => item.name === "seekbrain_planning_generate")!;
    const result = await tool.execute("generate", { run_id: "run-1" }, undefined, undefined, { cwd: "/cwd" } as any);
    expect(result).toMatchObject({ ok: true, subquestion_count: 2, task_count: 2 });
    expect(deps.planningWorkflow.prepareSubquestions).toHaveBeenCalledWith(expect.objectContaining({
      creativeCertificate: { idea_id: "H2", scientific_question: "Test H2." },
    }));
    expect(deps.creativeSearchWorkflow.search).not.toHaveBeenCalled();
    expect(deps.creativeWorkflow.start).not.toHaveBeenCalled();
  });
});
