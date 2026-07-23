type Json = Record<string, any>;

export interface ReportCommandAPI {
  registerCommand(name: string, command: Json): void;
  sendMessage(message: Json): void;
}

export interface ReportCommandDependencies {
  getActiveProjectPath(): string | undefined;
  listAvailable(projectPath: string): Promise<Json>;
  generate(input: {
    projectPath: string;
    selectedEvidence: string[];
    reportGoal?: string;
    onProgress?: (progress: Json) => void;
  }): Promise<Json>;
}

const REPORT_PROGRESS_WIDGET = "seekbrain-report-progress";

function reportProgress(context: Json, selectedCount: number) {
  const startedAt = Date.now();
  let message = "Preparing selected evidence";
  const render = () => {
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    context.ui?.setWidget?.(REPORT_PROGRESS_WIDGET, [
      "○ Scientific report · generating",
      `${selectedCount} selected result${selectedCount === 1 ? "" : "s"}`,
      `${message} · ${elapsed}s`,
    ], { placement: "aboveEditor" });
    context.ui?.setStatus?.("seekbrain-report", `Report generating · ${elapsed}s`);
  };
  render();
  const timer = setInterval(render, 1000);
  timer.unref?.();
  return {
    update(progress: Json) {
      message = String(progress.message || message);
      render();
    },
    stop() {
      clearInterval(timer);
      context.ui?.setWidget?.(REPORT_PROGRESS_WIDGET, undefined);
      context.ui?.setStatus?.("seekbrain-report", undefined);
    },
  };
}

function parseArgs(args: string): { projectPath?: string; selected: string[] } {
  const tokens = String(args || "").trim().split(/\s+/).filter(Boolean);
  const selected = tokens.filter((token) => /^(?:ROUND:\d+|R\d+|[^:]+:R\d+)$/i.test(token));
  const projectPath = tokens.find((token) => !selected.includes(token));
  return { projectPath, selected };
}

async function selectEvidence(context: Json, available: Json[]): Promise<string[] | undefined> {
  if (!context?.ui?.select) return undefined;
  const selected = new Set<string>();
  while (true) {
    const labels = available.map((item) => {
      const marker = selected.has(item.evidence_id) ? "[x]" : "[ ]";
      const question = String(item.question || item.summary || "").replace(/\s+/g, " ").slice(0, 88);
      return `${marker} ${item.evidence_id}${question ? ` — ${question}` : ""}`;
    });
    const generate = `Generate report from ${selected.size} selected result${selected.size === 1 ? "" : "s"}`;
    const cancel = "Cancel";
    const choice = await context.ui.select("Select completed SeekBrain results", [...labels, generate, cancel]);
    if (!choice || choice === cancel) return undefined;
    if (choice === generate) {
      if (selected.size) return [...selected];
      context.ui.notify?.("Select at least one result.", "warning");
      continue;
    }
    const index = labels.indexOf(choice);
    if (index < 0) continue;
    const id = String(available[index].evidence_id);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }
}

export function registerReportCommand(pi: ReportCommandAPI, dependencies: ReportCommandDependencies): void {
  pi.registerCommand("neuro-report", {
    description: "Generate a scientific report from explicitly selected completed rounds. Usage: /neuro-report [project-path] [ROUND:2 SQ1-T1:R1 ...]",
    async handler(args: string, context: Json) {
      const parsed = parseArgs(args);
      const projectPath = parsed.projectPath || dependencies.getActiveProjectPath();
      if (!projectPath) {
        context.ui?.notify?.("Provide a SeekBrain project path or resume a project first.", "error");
        return;
      }
      try {
        const catalog = await dependencies.listAvailable(projectPath);
        if (!Array.isArray(catalog.available) || !catalog.available.length) {
          context.ui?.notify?.("No completed results are available in this project.", "warning");
          return;
        }
        const selected = parsed.selected.length ? parsed.selected : await selectEvidence(context, catalog.available);
        if (!selected?.length) return;
        const progress = reportProgress(context, selected.length);
        let result: Json;
        try {
          result = await dependencies.generate({ projectPath, selectedEvidence: selected, onProgress: progress.update });
        } finally {
          progress.stop();
        }
        if (!result.ok) {
          pi.sendMessage({
            customType: "neuro-report",
            display: true,
            content: [
              "# Scientific report failed",
              "",
              String(result.error || "Report generation failed."),
              result.error_path ? `Diagnostic: ${result.error_path}` : "",
            ].filter(Boolean).join("\n"),
          });
          return;
        }
        pi.sendMessage({
          customType: "neuro-report",
          display: true,
          content: [
            "# Scientific report generated",
            "",
            result.title ? `**${result.title}**` : "",
            `Selected results: ${selected.join(", ")}`,
            `Report: ${result.report_path}`,
            result.pdf_generated === true && result.pdf_path ? `PDF: ${result.pdf_path}` : "",
            result.pdf_generated === false ? `PDF was not generated; report.md is the canonical output.${result.pdf_note ? ` ${result.pdf_note}` : ""}` : "",
          ].filter(Boolean).join("\n\n"),
        });
      } catch (error) {
        pi.sendMessage({
          customType: "neuro-report",
          display: true,
          content: `# Scientific report failed\n\n${String(error)}`,
        });
      }
    },
  });
}
