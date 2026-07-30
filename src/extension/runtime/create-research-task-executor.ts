import { join } from "node:path";
import { Type } from "typebox";
import type {
  CodeWorkflow,
  ImageWorkflow,
  InterpretWorkflow,
  ResearchTaskExecutionDependencies,
  ValidateWorkflow,
  WorkflowRunContext,
} from "../../workflows/index.ts";
import type { Json } from "./runtime-types.ts";

export interface ResearchTaskExecutorDependencies {
  projectRoot: string;
  loadConfig(cwd: string): Promise<Json>;
  workflowConfig(config: Json): Json;
  readPrompt(name: string): Promise<string>;
  resolveRun(cwd: string, runId?: string): Promise<WorkflowRunContext>;
  pickAgentConfig(config: Json, name: string): Json;
  humanGateEnabled(config: Json, stage: string): boolean;
  defaultMaxCodeAttempts: number;
  codeWorkflow: CodeWorkflow;
  validateWorkflow: ValidateWorkflow;
  imageWorkflow: ImageWorkflow;
  interpretWorkflow: InterpretWorkflow;
}

export function createResearchTaskExecutor(
  deps: ResearchTaskExecutorDependencies,
): ResearchTaskExecutionDependencies["executeTask"] {
  const {
    projectRoot: PROJECT_ROOT,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    readPrompt,
    resolveRun,
    pickAgentConfig,
    humanGateEnabled,
    defaultMaxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
    codeWorkflow,
    validateWorkflow,
    imageWorkflow,
    interpretWorkflow,
  } = deps;
  return async ({ cwd, task, publish, signal, afterCodeToolCall }) => {
    const config = await loadConfigCached(PROJECT_ROOT);
    const workflow = seekbrainWorkflowConfig(config);
    const [codePrompt, validatePrompt, refinePrompt, interpretPrompt] = await Promise.all([
      readPrompt("code"), readPrompt("validate"), readPrompt("image_refine"), readPrompt("interpret"),
    ]);
    let child = await resolveRun(cwd, task.run_id);
    if (child.state.interpretation && child.state.conclusions) {
      const conclusionsPath = String(child.state.conclusions.path || join(child.runDir, "conclusions.json"));
      await publish("task_completed", {
        completed_at: new Date().toISOString(),
        interpretation_path: conclusionsPath,
        conclusions_path: conclusionsPath,
        summary: child.state.conclusions.summary || child.state.interpretation.summary || "",
        recovered_existing_result: true,
      });
      return { task_id: task.task_id, run_id: task.run_id, ok: true, recovered_existing_result: true };
    }
    const needsCode = Number(child.state.code_attempt || 0) === 0 || child.state.validation?.route === "retry_code";
    await publish("execution_started", { resumed: Number(child.state.code_attempt || 0) > 0 });
    await publish("code_started", {
      code_attempt: needsCode ? Number(child.state.code_attempt || 0) + 1 : Number(child.state.code_attempt || 0),
      reused: !needsCode,
      retry_reason: child.state.validation?.route === "retry_code" ? child.state.validation?.next_code_feedback : undefined,
    });
    const code = needsCode ? await codeWorkflow.execute({
      cwd,
      runId: task.run_id,
      validationFeedback: child.state.validation?.next_code_feedback,
      rolePrompt: codePrompt,
      agentConfig: pickAgentConfig(config, "seekbrain_code"),
      finalizeSchema: Type.Object({
        code_files: Type.Array(Type.Object({ path: Type.String() }), { minItems: 1 }),
        exec_log: Type.String(),
        statistics: Type.Any(),
        artifacts: Type.Array(Type.Object({
          name: Type.Optional(Type.String()),
          path: Type.String(),
          kind: Type.Union([Type.Literal("figure"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("markdown"), Type.Literal("json"), Type.Literal("log"), Type.Literal("other")]),
          role: Type.Optional(Type.String()),
          description: Type.Optional(Type.String()),
          produced_by: Type.Optional(Type.String()),
        })),
        summary: Type.String(),
        warnings: Type.Array(Type.String()),
      }),
      planReviewRequired: humanGateEnabled(config, "plan"),
      maxAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
      signal,
      afterToolCall: afterCodeToolCall,
    }) : { ok: true, code_attempt: child.state.code_attempt, result: child.state.code || {} };
    if (!code.ok) throw new Error(`Code failed for ${task.task_id}: ${code.error || code.message || "unknown error"}`);
    await publish("code_completed", {
      code_attempt: code.code_attempt || child.state.code_attempt,
      code_summary: code.result?.summary,
      reused: !needsCode,
    });

    child = await resolveRun(cwd, task.run_id);
    const persistedValidation = child.state.validation;
    const validationCurrent = persistedValidation
      && Number(persistedValidation.validated_code_attempt ?? child.state.code_attempt) === Number(child.state.code_attempt || 0)
      && child.state.validation_invalidated_by_code_edit !== true
      && persistedValidation.route !== "retry_code";
    await publish("validation_started", { code_attempt: child.state.code_attempt, code_summary: code.result?.summary, reused: validationCurrent });
    const validation = validationCurrent ? {
      ok: true,
      result: persistedValidation,
      validation_path: join(child.runDir, "validation.json"),
    } : await validateWorkflow.execute({
      cwd,
      runId: task.run_id,
      rolePrompt: validatePrompt,
      agentConfig: pickAgentConfig(config, "seekbrain_validate"),
      finalizeSchema: Type.Object({
        pass: Type.Boolean(),
        per_figure: Type.Array(Type.Object({ path: Type.String(), pass: Type.Boolean(), issues: Type.Array(Type.String()) })),
        overall_mismatches: Type.Array(Type.String()),
        blocking_issues: Type.Array(Type.String()),
        methodological_caveats: Type.Array(Type.String()),
        figure_observations: Type.Array(Type.String()),
        visual_issues: Type.Array(Type.Object({ figure_path: Type.String(), feedback: Type.String() }), { maxItems: 1 }),
        confidence: Type.Number(),
        summary: Type.String(),
      }),
      maxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
      imageRefineEnabled: workflow.image_refine,
      signal,
    });
    if (!validation.ok) throw new Error(`Validation failed for ${task.task_id}: ${validation.error || "unknown error"}`);
    await publish("validation_completed", {
      validation_path: validation.validation_path,
      route: validation.result?.route,
      pass: validation.result?.pass,
      summary: validation.result?.summary,
    });
    if (validation.result?.route === "retry_code") {
      await publish("task_blocked", {
        blocked_stage: "validate",
        validation_path: validation.validation_path,
        reason: validation.result.next_code_feedback || validation.result.summary || "Code repair is required.",
      });
      return { task_id: task.task_id, run_id: task.run_id, ok: false, blocked: true, stage: "validate", validation_path: validation.validation_path };
    }

    let refinement: Json | undefined;
    if (validation.result?.route === "refine_image" && workflow.image_refine) {
      await publish("refinement_started", { figure_path: validation.result.refine_target?.figure_path });
      refinement = await imageWorkflow.refine({
        cwd,
        runId: task.run_id,
        figurePath: validation.result.refine_target?.figure_path,
        feedback: validation.result.refinement_feedback,
        rolePrompt: refinePrompt,
        agentConfig: pickAgentConfig(config, "seekbrain_refine_image"),
        finalizeSchema: Type.Object({
          refined_code_patch: Type.String(),
          refined_figure_path: Type.Optional(Type.String()),
          summary: Type.String(),
          remaining_issues: Type.Array(Type.String()),
          stop: Type.Boolean(),
        }),
        enabled: true,
        signal,
      });
      // A failed presentation-only refinement is already rolled back and
      // converted to a validation caveat by ImageWorkflow; interpretation continues.
      await publish("refinement_completed", { attempted: true, ok: refinement?.ok, summary: refinement?.summary, skipped: false });
    } else {
      await publish("refinement_completed", { attempted: false, skipped: true });
    }

    await publish("interpretation_started", {
      validation_path: validation.validation_path,
      refinement_attempted: Boolean(refinement),
      refinement_ok: refinement?.ok,
    });
    const interpretation = await interpretWorkflow.execute({
      cwd,
      runId: task.run_id,
      rolePrompt: interpretPrompt,
      agentConfig: pickAgentConfig(config, "seekbrain_interpret"),
      finalizeSchema: Type.Object({
        conclusions: Type.Array(Type.String()),
        summary: Type.String(),
        limitations: Type.Array(Type.String()),
        next_research_directions: Type.Array(Type.Object({
          title: Type.String(),
          research_question: Type.String(),
        })),
      }),
      signal,
    });
    if (!interpretation.ok) throw new Error(`Result Interpretation failed for ${task.task_id}: ${interpretation.error || "unknown error"}`);
    return {
      task_id: task.task_id,
      run_id: task.run_id,
      ok: true,
      validation_path: validation.validation_path,
      interpretation_path: interpretation.interpretation_path,
      conclusions_path: interpretation.conclusions_path,
      refinement_attempted: Boolean(refinement),
      refinement_ok: refinement?.ok,
    };
  };
}
