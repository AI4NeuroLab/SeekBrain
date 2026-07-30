type Json = Record<string, any>;

export interface ReportCommandAPI {
  registerCommand(name: string, command: Json): void;
  sendMessage(message: Json): void;
}

export interface ReportCommandDependencies {
  getActiveProjectPath(): string | undefined;
  catalog(projectPath: string): Promise<Json>;
  generate(input: {
    projectPath: string;
    selectedEvidenceIds?: string[];
    reportGoal?: string;
    onProgress?: (progress: Json) => void;
  }): Promise<Json>;
}

const REPORT_PROGRESS_WIDGET = "seekbrain-report-progress";

function compact(value: unknown, limit = 92): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : text;
}

function reportProgress(context: Json, roundCount: number) {
  const startedAt = Date.now();
  let message = "Compiling the selected Research Planning rounds";
  const render = () => {
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    context.ui?.setWidget?.(REPORT_PROGRESS_WIDGET, [
      "○ Report Agent · hierarchical synthesis",
      `${roundCount} selected round${roundCount === 1 ? "" : "s"}`,
      `${message} · ${elapsed}s`,
    ], { placement: "aboveEditor" });
    context.ui?.setStatus?.("seekbrain-report", `Report Agent generating · ${elapsed}s`);
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

function parseArgs(args: string): { projectPath?: string; selectedEvidenceIds: string[] } {
  const tokens = String(args || "").trim().split(/\s+/).filter(Boolean);
  const selectedEvidenceIds = tokens.filter((token) => /^[^:]+:R[1-9]\d*$/i.test(token));
  return { projectPath: tokens.find((token) => !selectedEvidenceIds.includes(token)), selectedEvidenceIds };
}

function flattenedRounds(catalog: Json): Json[] {
  return (Array.isArray(catalog.subquestions) ? catalog.subquestions : []).flatMap((subquestion: Json) =>
    (Array.isArray(subquestion.tasks) ? subquestion.tasks : []).flatMap((task: Json) =>
      (Array.isArray(task.rounds) ? task.rounds : []).map((round: Json) => ({
        ...round,
        task_id: task.task_id,
        task_title: task.title,
        subquestion_id: subquestion.subquestion_id,
        subquestion_title: subquestion.title,
      })),
    ),
  );
}

async function selectReportRounds(context: Json, catalog: Json): Promise<string[] | undefined> {
  const rounds = flattenedRounds(catalog);
  if (!rounds.length) return undefined;
  const recommended = new Set<string>((catalog.recommended_evidence_ids || []).map(String));
  if (!context?.ui?.custom || context.mode && context.mode !== "tui") return [...recommended];

  const tuiPackage = "@earendil-works/pi-tui";
  const tui: any = await import(tuiPackage);
  const { truncateToWidth, visibleWidth, matchesKey, Key } = tui;
  const selected = new Set<string>(recommended);
  let cursor = 0;
  let notice = "";

  return await context.ui.custom((tuiContext: Json, theme: Json, _keyboard: unknown, done: (value: unknown) => void) => {
    const fit = (value: string, width: number): string => {
      const clipped = truncateToWidth(value, width);
      return `${clipped}${" ".repeat(Math.max(0, width - visibleWidth(clipped)))}`;
    };
    const framed = (value: string, width: number): string => `│${fit(value, Math.max(1, width - 2))}│`;
    const renderRound = (round: Json, active: boolean): string => {
      const id = String(round.evidence_id);
      const marker = selected.has(id) ? theme.fg("success", "●") : theme.fg("dim", "○");
      const pointer = active ? theme.fg("accent", "›") : " ";
      const label = active ? theme.fg("accent", theme.bold(`Round ${Number(round.round_number)}`)) : `Round ${Number(round.round_number)}`;
      return `    ${pointer} ${marker}  ${label}`;
    };
    return {
      render(width: number): string[] {
        const cardWidth = Math.max(48, width);
        const title = " Select Results for Report ";
        const top = `╭─${theme.fg("accent", theme.bold(title))}${"─".repeat(Math.max(0, cardWidth - visibleWidth(title) - 3))}╮`;
        const bottom = `╰${"─".repeat(Math.max(0, cardWidth - 2))}╯`;
        const lines = [top, framed("", cardWidth)];
        let roundIndex = 0;
        for (const subquestion of (Array.isArray(catalog.subquestions) ? catalog.subquestions : [])) {
          lines.push(framed(`  ${theme.fg("accent", theme.bold(`${String(subquestion.subquestion_id)} · ${compact(subquestion.title)}`))}`, cardWidth));
          lines.push(framed("", cardWidth));
          for (const task of (Array.isArray(subquestion.tasks) ? subquestion.tasks : [])) {
            if (!Array.isArray(task.rounds) || !task.rounds.length) continue;
            lines.push(framed(`    ${theme.bold(`${String(task.task_id)} · ${compact(task.title)}`)}`, cardWidth));
            for (const round of task.rounds) {
              lines.push(framed(renderRound(round, roundIndex === cursor), cardWidth));
              roundIndex += 1;
            }
            lines.push(framed("", cardWidth));
          }
        }
        const selectedTaskCount = new Set(rounds.filter((round) => selected.has(String(round.evidence_id))).map((round) => String(round.task_id))).size;
        lines.push(`├${"─".repeat(Math.max(0, cardWidth - 2))}┤`);
        lines.push(framed(`  ${theme.fg("dim", `${selected.size} round${selected.size === 1 ? "" : "s"} from ${selectedTaskCount} task${selectedTaskCount === 1 ? "" : "s"}`)}`, cardWidth));
        if (notice) lines.push(framed(`  ${theme.fg("warning", notice)}`, cardWidth));
        lines.push(framed("", cardWidth));
        lines.push(framed(`  ${theme.fg("dim", "↑↓ move  ·  space/enter select  ·  L latest valid  ·  G generate  ·  Esc cancel")}`, cardWidth));
        lines.push(framed("", cardWidth), bottom);
        return lines;
      },
      handleInput(data: string) {
        notice = "";
        if (matchesKey(data, Key.up)) cursor = (cursor - 1 + rounds.length) % rounds.length;
        else if (matchesKey(data, Key.down)) cursor = (cursor + 1) % rounds.length;
        else if (data === " " || matchesKey(data, Key.enter)) {
          const id = String(rounds[cursor].evidence_id);
          if (selected.has(id)) selected.delete(id); else selected.add(id);
        } else if (data.toLowerCase() === "l") {
          selected.clear();
          for (const id of recommended) selected.add(id);
        } else if (data.toLowerCase() === "g") {
          if (!selected.size) notice = "Select at least one round.";
          else { done([...selected]); return; }
        } else if (matchesKey(data, Key.escape)) { done(undefined); return; }
        tuiContext.requestRender();
      },
      invalidate() {},
    };
  }, { overlay: true, overlayOptions: { width: "82%", anchor: "center" } }) as string[] | undefined;
}

export function registerReportCommand(pi: ReportCommandAPI, dependencies: ReportCommandDependencies): void {
  pi.registerCommand("seekbrain-report", {
    description: "Select completed Research Planning task rounds and generate an academic report. Usage: /seekbrain-report [project-path] [SQ1-T1:R1 ...]",
    async handler(args: string, context: Json) {
      const parsed = parseArgs(args);
      const projectPath = parsed.projectPath || dependencies.getActiveProjectPath();
      if (!projectPath) {
        context.ui?.notify?.("Provide a Research Planning project path or resume that project first.", "error");
        return;
      }
      try {
        const catalog = await dependencies.catalog(projectPath);
        if (catalog.available !== true) {
          context.ui?.notify?.("No completed, validated Research Planning rounds are available for reporting.", "warning");
          return;
        }
        const selected = parsed.selectedEvidenceIds.length ? parsed.selectedEvidenceIds : await selectReportRounds(context, catalog);
        if (!selected?.length) return;
        const progress = reportProgress(context, selected.length);
        let result: Json;
        try {
          result = await dependencies.generate({ projectPath, selectedEvidenceIds: selected, onProgress: progress.update });
        } finally {
          progress.stop();
        }
        if (!result.ok) {
          pi.sendMessage({ customType: "seekbrain-report", display: true, content: ["# Report generation failed", "", String(result.error || "Report generation failed."), result.error_path ? `Diagnostic: ${result.error_path}` : ""].filter(Boolean).join("\n") });
          return;
        }
        pi.sendMessage({
          customType: "seekbrain-report",
          display: true,
          content: [
            "# Academic report generated",
            "",
            result.title ? `**${result.title}**` : "",
            `Scope: ${String(result.report_scope || "partial")} · ${Number(result.round_count || selected.length)} selected rounds`,
            `Report: ${result.report_path}`,
            result.pdf_generated === true && result.pdf_path ? `PDF: ${result.pdf_path}` : "",
            result.pdf_generated === false ? `PDF was not generated; report.md remains canonical.${result.pdf_note ? ` ${result.pdf_note}` : ""}` : "",
          ].filter(Boolean).join("\n\n"),
        });
      } catch (error) {
        pi.sendMessage({ customType: "seekbrain-report", display: true, content: `# Report generation unavailable\n\n${String(error)}` });
      }
    },
  });
}
