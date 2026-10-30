/** SeekBrain terminal entry: modes, activity and actual outputs. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import registerSeekBrain from "./seekbrain-extension.ts";
import { applySeekBrainDefaults } from "./tui/extension-defaults.ts";
import { activateSetupPrimaryModel, runPiSetupWizard } from "./tui/setup-wizard.ts";
import { registerModeCommands } from "./runtime/mode-controller.ts";
import { applyAssistantPrompt } from "./runtime/shared/assistant-prompt.ts";
import { activityLines } from "./tui/research-activity.ts";
import type { SeekBrainRuntimeOptions } from "./runtime/runtime-options.ts";
export * from "./existing-pi-agent-adapter.ts";
export * from "./public-web-search.ts";
export * from "./scientific-inspiration-tool.ts";
export * from "./scientific-inspiration-search.ts";
export * from "./tool-adapter.ts";
export * from "./runtime-hooks.ts";
export * from "./commands/system-commands.ts";
export * from "./commands/show-command.ts";
export * from "./commands/save-skill-command.ts";
export * from "./commands/report-command.ts";
export * from "./tui/code-review-tui.ts";
export * from "./tui/review-selectors.ts";
export * from "./tui/transparency-card.ts";
export { default as registerSeekBrainTools } from "./seekbrain-extension.ts";


const PROMPT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "prompts");
const ASSISTANT_PROMPT = readFileSync(join(PROMPT_DIR, "assistant.md"), "utf8");
const RESEARCH_PROMPT = readFileSync(join(PROMPT_DIR, "research.md"), "utf8");
export default function registerSeekBrainEntry(pi: ExtensionAPI, options: SeekBrainRuntimeOptions = {}) {
  const env = { ...(options.env ?? process.env) };
  const mode = registerModeCommands(pi, env);
  registerSeekBrain(pi, { ...options, env });
  let ctx: any, setupRunning = false, activity = "";
  let activityStartedAt: number | undefined, activityTimer: ReturnType<typeof setInterval> | undefined;
  let activityTool: { name: string; id?: string } | undefined;
  const tasks = new Map<string, { status: string; instruction?: string }>();
  let outputs: string[] = [];
  function stopActivityTimer() {
    if (activityTimer !== undefined) clearInterval(activityTimer);
    activityTimer = undefined; activityStartedAt = undefined; activityTool = undefined;
  }
  function update() {
    if (!ctx?.ui) return;
    const elapsedMs = activityStartedAt === undefined ? undefined : performance.now() - activityStartedAt;
    const view = { projectPath: mode.project, activity, elapsedMs, tasks: ["research", "deep-research"].includes(mode.mode) ? [...tasks.entries()].map(([id, value]) => ({ id, ...value })) : [], outputs };
    ctx.ui.setWidget("seekbrain-workflow", activityLines(view).length ? (_tui: any, theme: any) => new Text(activityLines(view, theme).join("\n"), 1, 0) : undefined);
  }
  mode.onChange = () => { stopActivityTimer(); activity = ""; tasks.clear(); outputs = []; update(); };
  async function openSetup(context: any) {
    if (setupRunning) return; setupRunning = true;
    try { const result = await runPiSetupWizard(context, { onPrimaryChanged: reference => activateSetupPrimaryModel(pi, context, reference) }); context.ui.notify(result.ready ? "Setup saved" : "Setup closed", result.ready ? "info" : "warning"); }
    catch (error) { context.ui.notify(String(error), "error"); }
    finally { setupRunning = false; if (env.SEEKBRAIN_SETUP === "1") context.shutdown(); }
  }
  pi.registerCommand("seekbrain", { description: "Switch to Research", handler: async (args, context) => {
    await mode.switchTo("research", context); pi.appendEntry("seekbrain-mode", { mode: mode.mode, project: mode.project });
    context.ui.setStatus("seekbrain-mode", "Research"); if (args.trim()) pi.sendUserMessage(args.trim());
  } });
  pi.registerCommand("seekbrain-setup", { description: "Configure providers, models, and research source", handler: async (_args, context) => openSetup(context) });
  const activities: Record<string, string> = { seekbrain_research_start: "Preparing workspace", seekbrain_plan_generate: "Exploring materials and writing plans", seekbrain_formulation_generate: "Preparing tasks", seekbrain_execution_run: "Executing tasks", seekbrain_report_generate: "Writing report and exporting requested files", seekbrain_research_decide: "Recording research decision and finalizing files" };
  pi.on("tool_execution_start", async (event: any, context) => {
    ctx = context; if (!activities[event.toolName]) return;
    stopActivityTimer(); activityStartedAt = performance.now(); activityTool = { name: event.toolName, id: event.toolCallId };
    if (context.hasUI) { activityTimer = setInterval(update, 1000); activityTimer.unref(); }
    activity = mode.mode === "deep-research" && event.toolName === "seekbrain_report_generate" ? "Updating research report" : activities[event.toolName]; outputs = []; tasks.clear(); update();
  });
  pi.on("tool_execution_update", async (event: any) => {
    if (!activityTool || (activityTool.id && event.toolCallId ? activityTool.id !== event.toolCallId : activityTool.name !== event.toolName)) return;
    const detail = event.partialResult?.details || event.result?.details || {};
    const progress = detail.progress === true ? detail : detail.progress || detail;
    if (progress.task_id) tasks.set(progress.task_id, { status: progress.status || progress.task_status || (progress.stage === "task_completed" ? "complete" : progress.stage === "task_failed" ? "failed" : progress.stage === "task_interrupted" ? "pending" : "running") });
    update();
  });
  pi.on("tool_execution_end", async (event: any, context) => {
    ctx = context;
    const isCurrentActivity = activityTool && (activityTool.id && event.toolCallId ? activityTool.id === event.toolCallId : activityTool.name === event.toolName);
    if (activities[event.toolName] && !isCurrentActivity) return;
    if (isCurrentActivity) stopActivityTimer();
    const detail = event.result?.details || {};
    if (detail.graph?.tasks) for (const task of detail.graph.tasks) tasks.set(task.id, { ...task });
    if (isCurrentActivity) for (const task of tasks.values()) if (task.status === "running") task.status = "pending";
    if (activities[event.toolName]) activity = event.isError || detail.ok === false ? "Interrupted or incomplete; completed files are retained." : detail.report_status === "draft" ? "Report draft saved; PDF export needs attention." : detail.partial || detail.graph?.status === "complete_with_failures" ? "Completed with partial results." : detail.needs_plan_selection ? "Select the plan or plans to execute." : "";
    outputs = [...new Set([...(detail.plan_paths || []), detail.report_path, detail.pdf_path].filter(Boolean))]; update();
  });
  pi.on("before_agent_start", async (event, context) => {
    ctx = context;
    pi.setActiveTools(pi.getAllTools().map(tool => tool.name).filter(name => mode.allows(name)));
    update();
    applyAssistantPrompt(event.systemPromptOptions, { common: ASSISTANT_PROMPT, research: RESEARCH_PROMPT,
      mode: mode.mode, context: mode.prompt(), nonInteractive: env.SEEKBRAIN_NON_INTERACTIVE === "1" });
  });
  pi.on("session_start", async (_event, context) => {
    ctx = context; stopActivityTimer(); activity = ""; tasks.clear(); outputs = []; applySeekBrainDefaults(context); update();
    pi.setActiveTools(pi.getAllTools().map(tool => tool.name).filter(name => mode.allows(name)));
    if (env.SEEKBRAIN_SETUP === "1") await openSetup(context);
  });
  pi.on("agent_end", async () => {
    if (activityStartedAt === undefined) return;
    for (const task of tasks.values()) if (task.status === "running") task.status = "pending";
    stopActivityTimer(); activity = "Interrupted or incomplete; completed files are retained."; update();
  });
  pi.on("session_shutdown", async () => { stopActivityTimer(); });
}
