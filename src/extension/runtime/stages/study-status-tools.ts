import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { StudyWorkflow } from "../../../workflows/unified/study-workflow.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export function createStudyStatusTools(deps: { workflow: StudyWorkflow; getProjectPath?(): string | undefined; content(details: Json): any }): SeekBrainToolDefinition[] {
  return [defineTool({
    name: "seekbrain_system_check", label: "Study Status", description: "Show the active scientific workflow and output root without legacy module gates or a provider call.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _update, ctx) {
      let project: Json | undefined;
      try { const run = await deps.workflow.resolve(ctx.cwd, { projectPath: deps.getProjectPath ? deps.getProjectPath() || ctx.cwd : undefined }); project = { run_id: run.runId, project_dir: run.state.project_dir }; } catch { /* no active study */ }
      return deps.content({ ok: true, flow_version: "0.1.4", run_count: deps.workflow.projectCount(), workflow: ["Plan", "Formulation", "Execution", "Report"], ...project });
    },
  })];
}
