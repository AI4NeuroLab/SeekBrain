import { describe, expect, it, vi } from "vitest";
import { createResearchPlanningTools } from "../../src/extension/runtime/stages/research-planning-tools.ts";
import { createDatasetTools } from "../../src/extension/runtime/stages/dataset-tools.ts";
import { createLifecycleTools } from "../../src/extension/runtime/stages/lifecycle-tools.ts";
import { createRecipeResearchTools } from "../../src/extension/runtime/stages/recipe-research-tools.ts";
import { createReportingTools } from "../../src/extension/runtime/stages/reporting-tools.ts";
import { createSystemTools } from "../../src/extension/runtime/stages/system-tools.ts";
import { createReviewTools } from "../../src/extension/runtime/stages/review-tools.ts";
import { createCodeReviewTools } from "../../src/extension/runtime/stages/code-review-tools.ts";
import { createResearchExecutionTools } from "../../src/extension/runtime/stages/research-execution-tools.ts";
import { createFormulationTools } from "../../src/extension/runtime/stages/formulation-tools.ts";
import { createCodeExecutionTools } from "../../src/extension/runtime/stages/code-execution-tools.ts";
import { createValidationTools } from "../../src/extension/runtime/stages/validation-tools.ts";
import { createFigureRefinementTools } from "../../src/extension/runtime/stages/figure-refinement-tools.ts";
import { createInterpretationTools } from "../../src/extension/runtime/stages/interpretation-tools.ts";
import { registerTools, TOOL_REGISTRATION_ORDER } from "../../src/extension/runtime/tool-registry.ts";

function definition(name: string) {
  return { name } as any;
}

describe("runtime tool registry", () => {
  it("registers definitions in the frozen public order", () => {
    const registerTool = vi.fn();
    const reversed = [...TOOL_REGISTRATION_ORDER].reverse().map(definition);

    registerTools({ registerTool } as any, reversed);

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual(TOOL_REGISTRATION_ORDER);
  });

  it("rejects missing, duplicate, and unexpected definitions", () => {
    const pi = { registerTool: vi.fn() } as any;
    const complete = TOOL_REGISTRATION_ORDER.map(definition);

    expect(() => registerTools(pi, complete.slice(1))).toThrow(/Missing SeekBrain tool definition/);
    expect(() => registerTools(pi, [...complete, definition(complete[0].name)])).toThrow(/Duplicate SeekBrain tool definition/);
    expect(() => registerTools(pi, [...complete, definition("seekbrain_unexpected")])).toThrow(/Unexpected SeekBrain tool definitions/);
  });
});

describe("Research Planning stage", () => {
  it("owns the Research Planning tool definitions", () => {
    const tools = createResearchPlanningTools({} as any);
    expect(tools.map((tool) => tool.name)).toEqual([
      "seekbrain_planning_assess",
      "seekbrain_planning_decision_review",
      "seekbrain_planning_decision_record",
      "seekbrain_planning_generate",
      "seekbrain_planning_peer_review",
      "seekbrain_planning_researcher_review",
      "seekbrain_planning_researcher_decision_record",
      "seekbrain_analysis_tasks_prepare",
      "seekbrain_research_extend",
    ]);
  });
});

describe("Phase 4 stages", () => {
  it("own their frozen public tool definitions", () => {
    expect(createSystemTools({} as any).map((tool) => tool.name)).toEqual([
      "seekbrain_system_check",
      "seekbrain_system_capabilities",
    ]);
    expect(createDatasetTools({} as any).map((tool) => tool.name)).toEqual(["seekbrain_data_resolve"]);
    expect(createLifecycleTools({} as any).map((tool) => tool.name)).toEqual([
      "seekbrain_research_start",
      "seekbrain_research_continue",
      "seekbrain_run_start",
      "seekbrain_run_resume",
    ]);
    expect(createReportingTools({} as any).map((tool) => tool.name)).toEqual([
      "seekbrain_report_evidence_compile",
      "seekbrain_report_generate",
    ]);
    expect(createRecipeResearchTools({} as any).map((tool) => tool.name)).toEqual([
      "seekbrain_recipe_retrieve",
      "seekbrain_deep_research",
    ]);
  });
});

describe("Phase 5 stages", () => {
  it("own the frozen Review and Code Review tool definitions", () => {
    expect(createReviewTools({} as any).map((tool) => tool.name)).toEqual([
      "seekbrain_review_approve",
      "seekbrain_review_feedback",
      "seekbrain_formulation_researcher_review",
      "seekbrain_formulation_update",
    ]);
    expect(createCodeReviewTools({} as any).map((tool) => tool.name)).toEqual([
      "seekbrain_code_edit_review",
      "seekbrain_code_update_propose",
      "seekbrain_code_update_review",
    ]);
  });
});

describe("Phase 6 stage", () => {
  it("owns the five frozen Research Execution tool definitions", () => {
    expect(createResearchExecutionTools({} as any).map((tool) => tool.name)).toEqual([
      "seekbrain_execution_initialize",
      "seekbrain_execution_run",
      "seekbrain_execution_schema_review",
      "seekbrain_execution_tasks_run",
      "seekbrain_analysis_task_control",
    ]);
  });
});

describe("Phase 7 stages", () => {
  it("own the five frozen standard analysis tool definitions", () => {
    expect(createFormulationTools({} as any).map((tool) => tool.name)).toEqual(["seekbrain_formulation_generate"]);
    expect(createCodeExecutionTools({} as any).map((tool) => tool.name)).toEqual(["seekbrain_code_execute"]);
    expect(createValidationTools({} as any).map((tool) => tool.name)).toEqual(["seekbrain_validation_run"]);
    expect(createFigureRefinementTools({} as any).map((tool) => tool.name)).toEqual(["seekbrain_figure_refine"]);
    expect(createInterpretationTools({} as any).map((tool) => tool.name)).toEqual(["seekbrain_interpretation_run"]);
  });
});
