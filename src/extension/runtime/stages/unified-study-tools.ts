import { userRequestFromSession } from "../shared/user-request-context.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ReportFormatOverrideSchema } from "../../../workflows/unified/contracts.ts";
import type { StudyWorkflow } from "../../../workflows/unified/study-workflow.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export function createUnifiedStudyTools(deps: { workflow: StudyWorkflow; setActiveRunDir(path: string): void; getMode?(): string; getProjectPath?(): string | undefined; deepResearchMaxRounds?(): Promise<number>; content(details: Json): any }): SeekBrainToolDefinition[] {
  const content = (result: Json) => {
    if (deps.getMode?.() === "plan" && result.next_tool && !["seekbrain_plan_generate", "seekbrain_run_resume"].includes(result.next_tool)) result = { ...result, next_tool: undefined, awaiting_input: true };
    return deps.content(result.graph ? { ...result,
    graph: { status: result.graph.status, tasks: result.graph.tasks.filter((task: Json) => !result.deep_research || result.deep_research.rounds.find((round: Json) => round.number === result.deep_research.round)?.task_ids.includes(task.id)).map((task: Json) => ({ id: task.id, status: task.status, depends_on: task.depends_on, reason: task.reason })) },
  } : result);
  };
  const target = { run_id: Type.Optional(Type.String()), project_path: Type.Optional(Type.String()) };
  const resolve = async (params: Json, ctx: Json) => {
    const run = await deps.workflow.resolve(ctx.cwd, { runId: params.run_id, projectPath: params.project_path || (!params.run_id && deps.getProjectPath ? deps.getProjectPath() || ctx.cwd : undefined), mode: deps.getMode?.() });
    if (deps.getMode?.() === "deep-research") await deps.workflow.enableDeepResearch(run, await deps.deepResearchMaxRounds?.());
    deps.setActiveRunDir(run.runDir); return run;
  };
  const tools = [
    defineTool({ name: "seekbrain_research_start", label: "Start Study", description: "Create or resume one Plan → Formulation → Execution → Report project. The runtime reads the actual user request from the session. Honor its output directory and extract supplied dataset/reference/format-reference paths. project_dir is optional; never append a suffix or create an extra project wrapper.",
      parameters: Type.Object({ project_dir: Type.Optional(Type.String()),
        dataset_paths: Type.Optional(Type.Array(Type.String())), reference_paths: Type.Optional(Type.Array(Type.String())),
        metadata_json_path: Type.Optional(Type.String()), extra_path_info: Type.Optional(Type.String()),
        max_rounds: Type.Optional(Type.Integer({ minimum: 1, description: "Deep Research only: an explicit user-requested round limit, including the first round. Otherwise use configuration (default 3)." })) }, { additionalProperties: false }),
      async execute(_id, params, _signal, _update, ctx) {
        const userRequest = userRequestFromSession(ctx);
        const result = await deps.workflow.start({ cwd: ctx.cwd, projectPath: params.project_dir || (deps.getMode?.() === "plan" ? ctx.cwd : undefined), request: userRequest.text, userRequest,
          datasetPaths: params.dataset_paths, referencePaths: params.reference_paths, metadataPath: params.metadata_json_path, extraPathInfo: params.extra_path_info, mode: deps.getMode?.(),
          maxRounds: deps.getMode?.() === "deep-research" ? params.max_rounds : undefined,
          defaultMaxRounds: deps.getMode?.() === "deep-research" ? await deps.deepResearchMaxRounds?.() : undefined });
        const run = await deps.workflow.resolve(ctx.cwd, { runId: result.run_id }); deps.setActiveRunDir(run.runDir);
        return content(result);
      } }),
    defineTool({ name: "seekbrain_plan_generate", label: "Scientific Plan", description: "Explore data, supplied references and literature/method tools; write a scientific plan files in requested Markdown, JSON or text formats. The runtime supplies the user request and conversation. No task graph or execution contract at this stage.", parameters: Type.Object({ ...target, action: Type.Optional(Type.Union([Type.Literal("create"), Type.Literal("revise"), Type.Literal("reuse")])), output_paths: Type.Optional(Type.Array(Type.String(), { minItems: 1 })), source_paths: Type.Optional(Type.Array(Type.String())) }, { additionalProperties: false }),
      async execute(_id, params, signal, _update, ctx) { return content(await deps.workflow.plan(await resolve(params, ctx), signal, { action: params.action, output_paths: params.output_paths, source_paths: params.source_paths, userRequest: userRequestFromSession(ctx) })); } }),
    defineTool({ name: "seekbrain_formulation_generate", label: "Formulate Tasks", description: "Convert selected plan files to task instructions, dependencies, optional scientific checks, priorities and pilot conditions. Supports one task, serial, parallel or mixed execution without execution contracts or fixed deliverable filenames.", parameters: Type.Object({ ...target, plan_paths: Type.Optional(Type.Array(Type.String(), { minItems: 1 })) }),
      async execute(_id, params, signal, _update, ctx) { return content(await deps.workflow.formulate(await resolve(params, ctx), signal, params.plan_paths, userRequestFromSession(ctx))); } }),
    defineTool({ name: "seekbrain_execution_run", label: "Execute Study", description: "Run dependency-ready tasks with Code → Validation; retry repairable code within limits. Isolate branch failures and resume interrupted tasks. Completion may include failed or skipped branches.", parameters: Type.Object({ ...target, concurrency: Type.Optional(Type.Integer({ minimum: 1, maximum: 16 })) }),
      async execute(_id, params, signal, _update, ctx) { return content(await deps.workflow.execute(await resolve(params, ctx), params.concurrency ?? 2, signal, progress => _update?.(content({ ok: true, flow_version: "0.1.4", progress: true, ...progress })), userRequestFromSession(ctx))); } }),
    defineTool({ name: "seekbrain_report_evidence_compile", label: "Collect Evidence", description: "Collect currently usable reviewed outputs, including partial results, and separately describe unreviewed, failed and incomplete work. Does not wait for every task to succeed.", parameters: Type.Object(target),
      async execute(_id, params, _signal, _update, ctx) { return content(await deps.workflow.evidence(await resolve(params, ctx))); } }),
    defineTool({ name: "seekbrain_report_generate", label: "Scientific Report", description: "Read current validated statistics, images, methods and plan; use relevant textbook skills and literature to form the study conclusions and produce the requested Markdown/PDF files. Honor report_path, pdf_path and output_formats; default to report.md and report.pdf only when no names were requested. PDF generation follows the configured switch and CLI override; when disabled, Markdown alone completes the report. Partial execution is allowed. Extract any explicit user format overrides into report_format; otherwise use the brief-communication limits.", parameters: Type.Object({ ...target, report_goal: Type.Optional(Type.String()), report_format: Type.Optional(ReportFormatOverrideSchema), report_path: Type.Optional(Type.String()), pdf_path: Type.Optional(Type.String()), output_formats: Type.Optional(Type.Array(Type.Union([Type.Literal("markdown"), Type.Literal("pdf")]), { minItems: 1 })) }),
      async execute(_id, params, signal, _update, ctx) { return content(await deps.workflow.report(await resolve(params, ctx), params.report_goal, signal, params.report_format, params, userRequestFromSession(ctx))); } }),
    defineTool({ name: "seekbrain_research_decide", label: "Research Decision", description: "Deep Research only. After reading the current round report and relevant execution/validation evidence, record whether to continue with useful focused work or finish. Pass the current round number for safe retries. A continuation needs next_focus, an agent proposal rather than a new user requirement. Optional invalidate_paths withdraws specifically identified erroneous outputs. Completion exports the retained report PDF without calling Report again; resume failed export with the returned next_parameters.",
      parameters: Type.Object({ ...target, round: Type.Integer({ minimum: 1 }), action: Type.Union([Type.Literal("continue"), Type.Literal("finish")]), reason: Type.String({ minLength: 1 }),
        next_focus: Type.Optional(Type.String({ minLength: 1 })), invalidate_paths: Type.Optional(Type.Array(Type.String())) }, { additionalProperties: false }),
      async execute(_id, params, signal, _update, ctx) {
        if (deps.getMode?.() !== "deep-research") throw new Error("Research decisions are available only in Deep Research mode");
        return content(await deps.workflow.decide(await resolve(params, ctx), { round: params.round, action: params.action, reason: params.reason, next_focus: params.next_focus, invalidate_paths: params.invalidate_paths }, signal));
      } }),
    defineTool({ name: "seekbrain_run_resume", label: "Resume Study", description: "Load an existing seekbrain-014 project and report its plan, formulation, execution coverage and next stage, without starting another route.", parameters: Type.Object(target),
      async execute(_id, params, _signal, _update, ctx) {
        const run = await resolve(params, ctx);
        if (deps.getMode?.() === "deep-research") return content(await deps.workflow.researchStatus(run));
        const { existsSync } = await import("node:fs"); const { resolve: resolvePath } = await import("node:path");
        const candidates = (run.state.plan_paths || run.state.selected_plan_paths || [run.state.plan_path || "plan.md"]).map((path: string) => resolvePath(run.state.project_dir, path));
        const selected = (run.state.selected_plan_paths || []).map((path: string) => resolvePath(run.state.project_dir, path));
        const hasPlan = (selected.length ? selected : candidates).every(existsSync), hasGraph = existsSync(resolvePath(run.runDir, "tasks.json"));
        const report = run.state.report;
        const reportDone = await deps.workflow.reportComplete(run);
        const evidence = hasGraph ? await deps.workflow.evidence(run) : undefined;
        return content({ ok: true, flow_version: "0.1.4", run_id: run.runId, project_dir: run.state.project_dir, completed_stages: [hasPlan ? "Plan" : "", hasGraph ? "Formulation" : "", ["complete", "complete_with_failures"].includes(evidence?.execution_status) ? "Execution" : "", reportDone ? "Report" : ""].filter(Boolean), execution_status: evidence?.execution_status, coverage: evidence?.coverage, plan_paths: candidates, selected_plan_paths: selected, report, awaiting_input: !!reportDone,
          next_tool: reportDone ? undefined : !hasPlan ? "seekbrain_plan_generate" : !hasGraph ? "seekbrain_formulation_generate" : evidence?.execution_status === "complete" || evidence?.execution_status === "complete_with_failures" ? "seekbrain_report_generate" : "seekbrain_execution_run" });
      } }),
  ];
  return tools.map(tool => ({ ...tool, renderResult: renderSeekBrainResult(tool.name) }));
}
