import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { WEB_TOOL_NAMES } from "../web-access-tools.ts";

export type InteractionMode = "ask" | "plan" | "research" | "deep-research";
export const MODE_LABELS: Record<InteractionMode, string> = { ask: "Ask", plan: "Plan", research: "Research", "deep-research": "Deep Research" };
const askTools = new Set(["read", "ls", "find", "grep", "bash", "seekbrain_literature_search", "seekbrain_paper_read", "web_search", "fetch_content", "get_search_content"]);
const planners = new Set([...askTools, "seekbrain_data_resolve", "seekbrain_research_start", "seekbrain_plan_generate", "seekbrain_run_resume"]);
const controllers = new WeakMap<object, ModeController>();
export function isInteractionMode(value: unknown): value is InteractionMode { return typeof value === "string" && Object.hasOwn(MODE_LABELS, value); }

export class ModeController {
  mode: InteractionMode = "research";
  webSearchEnabled = true;
  pending?: InteractionMode;
  project?: string;
  onChange?: () => void;
  private aborter = new AbortController();
  private operations = new Set<Promise<any>>();
  allows(name: string): boolean {
    if (!this.webSearchEnabled && (WEB_TOOL_NAMES as readonly string[]).includes(name)) return false;
    return !this.pending && (name === "seekbrain_research_decide" ? this.mode === "deep-research" : this.mode === "research" || this.mode === "deep-research" || (this.mode === "ask" ? askTools.has(name) : this.mode === "plan" && planners.has(name)));
  }
  assertAllowed(name: string): void { if (!this.allows(name)) throw new Error(`${name} is unavailable in ${MODE_LABELS[this.mode]} mode${this.pending ? " while switching" : ""}.`); }
  async run<T>(name: string, signal: AbortSignal | undefined, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.assertAllowed(name);
    const combined = signal ? AbortSignal.any([signal, this.aborter.signal]) : this.aborter.signal;
    combined.throwIfAborted();
    const operation = Promise.resolve().then(() => { combined.throwIfAborted(); return action(combined); });
    this.operations.add(operation);
    try { return await operation; } finally { this.operations.delete(operation); }
  }
  async switchTo(mode: InteractionMode, ctx: any): Promise<void> {
    this.pending = mode; ctx.ui?.setStatus?.("seekbrain-mode", `Switching to ${MODE_LABELS[mode]}…`);
    this.aborter.abort(new Error("Mode changed; preserve completed work."));
    if (!ctx.isIdle?.()) ctx.abort?.();
    await Promise.allSettled([...this.operations]);
    await ctx.waitForIdle?.();
    this.mode = mode; this.pending = undefined; this.aborter = new AbortController(); this.onChange?.();
  }
  restore(ctx: any, initial = false, env: NodeJS.ProcessEnv = process.env): void {
    const entries = ctx.sessionManager?.getBranch?.() || [];
    const saved = [...entries].reverse().find((entry: any) => entry.type === "custom" && entry.customType === "seekbrain-mode");
    this.mode = initial && isInteractionMode(env.SEEKBRAIN_INTERACTION_MODE) ? env.SEEKBRAIN_INTERACTION_MODE : isInteractionMode(saved?.data?.mode) ? saved.data.mode : "research";
    this.project = saved?.data?.project; this.pending = undefined; this.aborter = new AbortController(); this.onChange?.();
  }
  prompt(): string {
    const base = `Current mode: ${MODE_LABELS[this.mode]}.\n${this.project ? `Current project: ${this.project}.` : "No current project has been selected."}`;
    const guidance: Record<InteractionMode, string> = {
      ask: "Answer through conversation, reading and retrieval. Keep user files and environments unchanged; use temporary directories for scratch work. Give drafts in chat. For requested file operations, name /plan for plans or /research for execution and other changes.",
      plan: "Discuss and refine plans with the user. When files are requested, create or resume the workspace with seekbrain_research_start in the requested directory or current working directory, then use seekbrain_plan_generate for the requested plans. Respect multiple alternatives and user formats. Stop at the requested planning scope.",
      research: "Choose operations from the current request and existing progress. Reuse selected plans and results. A discussion, focused edit, planning-only request or report-only request needs just that scope. For a full study, arrange, execute and validate tasks, then deliver the requested report. Finish without autonomously extending the scientific question.",
      "deep-research": "For a full study, complete each round through its Markdown report, then read the report and relevant validation evidence and record continue or finish with seekbrain_research_decide before ending the study. Preserve useful results, address the remaining uncertainty, and avoid redundant analyses. Further rounds are optional; finish when the evidence is sufficient or further work is not useful or feasible within the user's scope and resources.",
    };
    return `${base}\n\n${guidance[this.mode]}`;
  }
}
export function getModeController(pi: object): ModeController {
  let controller = controllers.get(pi); if (!controller) { controller = new ModeController(); controllers.set(pi, controller); } return controller;
}
export function registerModeCommands(pi: ExtensionAPI, env: NodeJS.ProcessEnv = { ...process.env }): ModeController {
  const controller = getModeController(pi);
  let ctx: any;
  const display = () => ctx?.ui?.setStatus?.("seekbrain-mode", controller.pending ? `Switching to ${MODE_LABELS[controller.pending]}…` : MODE_LABELS[controller.mode]);
  const persist = () => pi.appendEntry("seekbrain-mode", { mode: controller.mode, project: controller.project });
  for (const mode of Object.keys(MODE_LABELS) as InteractionMode[]) pi.registerCommand(mode, {
    description: `Switch to ${MODE_LABELS[mode]}; optional request follows the command`,
    async handler(args, context) {
      ctx = context;
      try {
        await controller.switchTo(mode, context); persist(); display();
        pi.setActiveTools(pi.getAllTools().map(tool => tool.name).filter(name => controller.allows(name)));
        context.ui?.notify?.(MODE_LABELS[mode], "info");
        if (args.trim()) pi.sendUserMessage(args.trim());
      } catch (error) { context.ui?.notify?.(String(error), "error"); }
    },
  });
  let initial = true;
  pi.on("session_start", async (_event, context) => { ctx = context; controller.restore(context, initial, env); initial = false; display(); });
  pi.on("session_tree", async (_event, context) => { ctx = context; controller.restore(context); display(); });
  pi.on("tool_call", async event => controller.allows(event.toolName) ? undefined : { block: true, reason: `${event.toolName} is unavailable in ${MODE_LABELS[controller.mode]} mode.` });
  pi.on("tool_execution_end", async (event: any) => {
    const details = event.result?.details || {};
    if (details.project_dir && !event.isError && details.ok !== false) { controller.project = details.project_dir; persist(); }
  });
  return controller;
}
