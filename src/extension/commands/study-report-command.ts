import { getModeController } from "../runtime/mode-controller.ts";
import { basename, dirname } from "node:path";
import type { StudyWorkflow } from "../../workflows/unified/study-workflow.ts";

export function registerStudyReportCommand(pi: any, deps: { workflow: StudyWorkflow; getActiveRunDir(): string | undefined }): void {
  pi.registerCommand("seekbrain-report", {
    description: "Generate a report from available validated study results. Usage: /seekbrain-report [project-path]",
    async handler(args: string, ctx: any) {
      const path = args.trim() || deps.getActiveRunDir();
      if (!path) { ctx.ui?.notify?.("Provide a seekbrain-014 project path.", "error"); return; }
      try {
        const projectPath = basename(path) === ".seekbrain" ? dirname(path) : path;
        getModeController(pi).assertAllowed("seekbrain_report_generate");
        const run = await deps.workflow.resolve(ctx.cwd, { projectPath });
        const result = await getModeController(pi).run("seekbrain_report_generate", ctx.signal, signal => deps.workflow.report(run, undefined, signal));
        ctx.ui?.notify?.(`Report: ${result.report_path}\nPDF: ${result.pdf_path || result.pdf_export?.error || "Export failed"}${result.report_status === "draft" ? "\nMarkdown retained; PDF export needs attention." : ""}`, "info");
      } catch (error) { ctx.ui?.notify?.(String(error), "error"); }
    },
  });
}
