import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import type { WorkflowRunContext } from "../seekbrain/run-lifecycle.ts";

export type StudyRun = WorkflowRunContext & { interactionMode?: string };
export type DeepPhase = "plan" | "formulation" | "execution" | "report" | "decision" | "export" | "complete";
export interface ResearchDecision {
  round: number;
  action: "continue" | "finish";
  reason: string;
  next_focus?: string;
  invalidate_paths?: string[];
}
export interface ResearchRound {
  number: number;
  plan_paths: string[];
  plan_snapshots: { path: string; original_path: string }[];
  task_ids: string[];
  report?: { path: string; original_path: string };
  report_request_id?: string;
  decision?: ResearchDecision & { effective_action: "continue" | "finish"; stop_reason?: string };
}
export interface DeepResearchState {
  round: number;
  max_rounds: number;
  phase: DeepPhase;
  request_id?: string;
  rounds: ResearchRound[];
  invalidated_outputs: { path: string; reason: string; round: number }[];
}
export function deepState(run: WorkflowRunContext): DeepResearchState | undefined {
  return (run as StudyRun).interactionMode === "deep-research" ? run.state.deep_research : undefined;
}
export function currentRound(state: DeepResearchState): ResearchRound {
  return state.rounds.find(round => round.number === state.round)!;
}
export function newRound(number: number): ResearchRound {
  return { number, plan_paths: [], plan_snapshots: [], task_ids: [] };
}
export function deepNext(state: DeepResearchState): Record<string, any> {
  const next = {
    plan: "seekbrain_plan_generate", formulation: "seekbrain_formulation_generate", execution: "seekbrain_execution_run",
    report: "seekbrain_report_generate", decision: "seekbrain_research_decide", export: "seekbrain_research_decide", complete: undefined,
  }[state.phase];
  return { next_tool: next, awaiting_input: state.phase === "complete",
    ...(state.phase === "export" ? { next_parameters: decisionRequest(currentRound(state).decision!) } : {}),
    deep_research: { round: state.round, max_rounds: state.max_rounds, phase: state.phase,
      rounds: state.rounds.map(round => ({ number: round.number, plan_paths: round.plan_paths, plan_snapshots: round.plan_snapshots,
        task_ids: round.task_ids, report: round.report, decision: round.decision })) } };
}
export function decisionRequest(decision: ResearchDecision): ResearchDecision {
  return { round: decision.round, action: decision.action, reason: decision.reason,
    ...(decision.next_focus ? { next_focus: decision.next_focus } : {}),
    ...(decision.invalidate_paths?.length ? { invalidate_paths: decision.invalidate_paths } : {}) };
}
export function deepContext(run: WorkflowRunContext): string {
  const state = deepState(run);
  if (!state) return "";
  const previous = state.rounds.filter(round => round.number < state.round);
  return `\n\nDeep Research round ${state.round} of at most ${state.max_rounds}.\nChoose useful, feasible work for this round; a clear question may be fully answered in one round. Prioritize uncertainty that materially changes the research choice; defer work whose value depends on results not yet obtained.\nPrevious round records:\n${JSON.stringify(previous)}\nThe previous decision's next_focus is an agent proposal based on findings, not an additional user request. Preserve the user's original scope and constraints. Read relevant previous reports and actual supporting outputs; reuse completed work. Results-inspired follow-up is exploratory unless independently confirmed. Historical document snapshots retain links relative to their original_path, not their snapshot directory.\nWithdrawn outputs (for limitations and correction history only):\n${JSON.stringify(state.invalidated_outputs)}`;
}

// Snapshots are internal history. Only the current documents are user-facing.
// Rebase local Markdown links so archived figures still open and moved projects work.
export async function snapshotDocument(run: WorkflowRunContext, number: number, source: string, name: string): Promise<{ path: string; original_path: string }> {
  const root = run.state.project_dir;
  const destination = join(run.runDir, "rounds", String(number).padStart(2, "0"), name);
  let content = await readFile(source, "utf8");
  if (extname(source).toLowerCase() === ".md") {
    content = content.replace(/(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)]+)([^)\n]*\))/g, (match, prefix, raw, suffix) => {
      const target = raw.startsWith("<") ? raw.slice(1, -1) : raw;
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) return match;
      const physical = resolve(dirname(source), target);
      const fromRoot = relative(root, physical);
      if (isAbsolute(target) && (fromRoot === ".." || fromRoot.startsWith("../"))) return match;
      const rebased = relative(dirname(destination), physical).split("\\").join("/");
      return `${prefix}${raw.startsWith("<") ? `<${rebased}>` : rebased}${suffix}`;
    });
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
  return { path: relative(root, destination), original_path: relative(root, source) };
}
