import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createJiti } from "jiti";
import { visibleWidth } from "@earendil-works/pi-tui";
import { mock } from "node:test";

const jiti = createJiti(import.meta.url);
const { default: registerSeekBrain } = await jiti.import("../src/extension/index.ts");
const entrySource = await readFile(new URL("../src/extension/index.ts", import.meta.url), "utf8");
const shutdownLines = entrySource.split("\n").filter((line) => line.includes("context.shutdown()"));
assert.ok(shutdownLines.length > 0, "standalone seekbrain setup must still close its owned Pi session");
assert.ok(shutdownLines.every((line) => line.includes("SEEKBRAIN_SETUP")), "/seekbrain-setup must never unconditionally shut down the current session");

const handlers = new Map();
const commands = new Map();
const pi = {
  on(event, handler) {
    const list = handlers.get(event) || [];
    list.push(handler);
    handlers.set(event, list);
  },
  registerCommand(name, command) { commands.set(name, command); },
  registerTool() {},
  getAllTools() { return ["read", "write", "bash", "seekbrain_plan_generate", "seekbrain_execution_run"].map(name => ({name})); },
  setActiveTools() {},
  sendUserMessage() {},
  async appendEntry() {},
  sendMessage() {},
};
registerSeekBrain(pi);

const statuses = [];
const notifications = [];
const widgets = [];
const widgetStyles = [];
let workflowComponent;
let headerFactory;
const testTheme = {
  fg(style, value) { widgetStyles.push([style, value]); return value; },
  bold(value) { return value; },
};
const ctx = {
  cwd: process.cwd(),
  hasUI: true,
  isIdle() { return true; },
  async waitForIdle() {},
  ui: {
    setTheme() { return { success: true }; },
    setHeader(factory) { headerFactory = factory; },
    setTitle() {},
    setWidget(name, content) {
      workflowComponent = typeof content === "function" ? content({}, testTheme) : undefined;
      widgets.push([name, workflowComponent ? workflowComponent.render(160).map(line => line.slice(1).trimEnd()) : content]);
    },
    setStatus(name, value) { statuses.push([name, value]); },
    notify(message) { notifications.push(message); },
  },
};

const sessionStart = handlers.get("session_start").at(-1);
const beforeAgentStart = handlers.get("before_agent_start").at(-1);
assert.equal(typeof sessionStart, "function");
assert.equal(typeof beforeAgentStart, "function");

await sessionStart({}, ctx);
assert.equal(typeof headerFactory, "function");
const header = headerFactory({}, testTheme);
const compactHeader = header.render(160).join("\n");
assert.match(compactHeader, /╭─ SeekBrain v0\.1\.4/);
assert.match(compactHeader, /█▀▀ █▀▀ █▀▀ █▄▀/);
assert.match(compactHeader, /READY/);
assert.match(compactHeader, /SCIENTIFIC RESEARCH AGENT/);
assert.match(compactHeader, /Ask.*Plan.*Research.*Deep Research/);
assert.match(compactHeader, /Type below to begin.*ctrl\+o guide.*\/seekbrain-setup models/);
assert.doesNotMatch(compactHeader, /\/entry/);
assert.doesNotMatch(compactHeader, /LOADED/);
for (const width of [1, 8, 48, 80, 160]) {
  assert.ok(header.render(width).every((line) => visibleWidth(line) <= width), `header must fit ${width} columns`);
}
header.setExpanded(true);
const expandedHeader = header.render(160).join("\n");
assert.match(expandedHeader, /START.*Type a question, discuss a plan, or request an analysis/s);
assert.match(expandedHeader, /MODES.*\/ask.*\/plan.*\/research/s);
assert.match(expandedHeader, /MODELS.*\/seekbrain-setup/s);
assert.match(expandedHeader, /LOADED.*mode controls.*task activity.*usage footer/s);
assert.doesNotMatch(expandedHeader, /\/entry/);

for (const handler of handlers.get("session_start").slice(0, -1)) await handler({}, ctx);
const { buildSystemPrompt } = await import(new URL("../node_modules/@earendil-works/pi-coding-agent/dist/core/system-prompt.js", import.meta.url));
async function mainPrompt() {
  const systemPromptOptions = { cwd: ctx.cwd, sections: { project_test: "Existing project instructions" }, selectedTools: ["read"], contextFiles: [{ path: "/tmp/AGENTS.md", content: "Keep donor identity intact" }] };
  assert.equal(await beforeAgentStart({ systemPromptOptions }, ctx), undefined);
  const text = buildSystemPrompt(systemPromptOptions);
  assert.match(text, /Existing project instructions/);
  assert.match(text, /Keep donor identity intact/);
  return { systemPrompt: text };
}
let prompt = await mainPrompt();
assert.match(prompt.systemPrompt, /Current mode: Research/);
assert.deepEqual(widgets.at(-1), ["seekbrain-workflow", undefined]);
for (const name of ["ask", "plan", "research", "deep-research", "seekbrain-setup"]) assert.ok(commands.has(name));
assert.equal(commands.has("neuro"), false);
await commands.get("plan").handler("", ctx);
prompt = await mainPrompt();
assert.match(prompt.systemPrompt, /Current mode: Plan/);
assert.deepEqual(statuses.at(-1), ["seekbrain-mode", "Plan"]);
const toolStart = handlers.get("tool_execution_start").at(-1);
const toolEnd = handlers.get("tool_execution_end").at(-1);
const toolUpdate = handlers.get("tool_execution_update").at(-1);
let monotonicTime = 0;
const intervals = new Map();
mock.method(performance, "now", () => monotonicTime);
mock.method(globalThis, "setInterval", (callback, delay) => {
  assert.equal(delay, 1000, "activity repaint should run at most once a second");
  const timer = { unref() {} }; intervals.set(timer, callback); return timer;
});
mock.method(globalThis, "clearInterval", timer => intervals.delete(timer));
function tick(milliseconds) { monotonicTime += milliseconds; for (const callback of [...intervals.values()]) callback(); }
await toolStart({ toolName: "seekbrain_plan_generate", toolCallId: "plan-1" }, ctx);
assert.ok(widgets.at(-1)[1].some(line => line.includes("writing plans")));
assert.match(widgets.at(-1)[1][0], /  0s$/);
assert.equal(intervals.size, 1);
tick(80_000);
assert.match(widgets.at(-1)[1][0], /  1m20s$/, "elapsed time must update without tool progress events");
assert.ok(widgetStyles.some(([style, value]) => style === "accent" && value.includes("Exploring materials")));
assert.ok(widgetStyles.some(([style, value]) => style === "dim" && value === "1m20s"));
await toolEnd({ toolName: "read", toolCallId: "reading-1", result: {} }, ctx);
assert.equal(intervals.size, 1, "an unrelated tool completion must not stop the current clock");
await toolEnd({ toolName: "seekbrain_plan_generate", toolCallId: "plan-1", result: { details: { ok: true, plan_paths: ["/tmp/study/analyze.json"] } } }, ctx);
assert.deepEqual(widgets.at(-1)[1], ["/tmp/study/analyze.json"]);
assert.doesNotMatch(widgets.at(-1)[1].join("\n"), /Formulation|\d+s/);
assert.equal(intervals.size, 0, "successful completion must release the timer");
await toolStart({ toolName: "seekbrain_execution_run", toolCallId: "execution-1" }, ctx);
tick(10_000);
await toolStart({ toolName: "seekbrain_report_generate", toolCallId: "report-1" }, ctx);
tick(5_000);
await toolEnd({ toolName: "seekbrain_execution_run", toolCallId: "execution-1", result: { details: { ok: true } } }, ctx);
assert.match(widgets.at(-1)[1][0], /Writing report.*  5s$/, "stale completions must not reset another operation's clock");
assert.equal(intervals.size, 1, "replacing an activity must not accumulate timers");
await toolEnd({ toolName: "seekbrain_report_generate", toolCallId: "report-1", isError: true, result: {} }, ctx);
assert.equal(intervals.size, 0, "failure must release the timer");
assert.match(widgets.at(-1)[1][0], /Interrupted or incomplete/);
await toolStart({ toolName: "seekbrain_plan_generate", toolCallId: "plan-2" }, ctx);
tick(3_723_000);
assert.match(widgets.at(-1)[1][0], /  1h02m03s$/);
await commands.get("ask").handler("", ctx);
assert.equal(intervals.size, 0, "mode changes must release the timer");
prompt = await mainPrompt(); assert.match(prompt.systemPrompt, /Current mode: Ask/);
assert.match(prompt.systemPrompt, /Deep Research \(`\/deep-research`\)/);
assert.doesNotMatch(prompt.systemPrompt, /not implemented|Use the registered research tools/);
await commands.get("deep-research").handler("", ctx);
assert.equal(notifications.at(-1), "Deep Research");
prompt = await mainPrompt();
assert.match(prompt.systemPrompt, /Current mode: Deep Research/);
assert.match(prompt.systemPrompt, /seekbrain_research_decide/);
await commands.get("research").handler("", ctx);
assert.deepEqual(statuses.at(-1), ["seekbrain-mode", "Research"]);
const { getModeController } = await jiti.import("../src/extension/runtime/mode-controller.ts");
const projectPath = "/mnt/shared-storage-gpfs2/ai4neuro-share/xiangpeishan/BrainAtlas/Q1_Subclass_diversification/results_20261014_19";
getModeController(pi).project = projectPath;
await toolStart({ toolName: "seekbrain_execution_run", toolCallId: "execution-2" }, ctx);
for (const [task_id, task_status] of [["T1", "running"], ["T2", "running"], ["T3", "failed"]]) {
  await toolUpdate({ toolName: "seekbrain_execution_run", toolCallId: "execution-2", partialResult: { details: { progress: true, task_id, task_status } } });
}
assert.deepEqual(widgets.at(-1)[1], [projectPath, "Executing tasks  0s", "  ● T1", "  ● T2", "  × T3"]);
assert.ok(widgetStyles.some(([style, value]) => style === "dim" && value === projectPath));
assert.ok(widgetStyles.some(([style, value]) => style === "error" && value === "×"));
for (const width of [1, 8, 48, 80, 160]) {
  assert.ok(workflowComponent.render(width).every(line => visibleWidth(line) <= width), `activity must fit ${width} columns without truncating the project path`);
}
await toolUpdate({ toolName: "seekbrain_execution_run", toolCallId: "execution-2", partialResult: { details: { progress: true, task_id: "T1", task_status: "complete" } } });
assert.ok(!widgets.at(-1)[1].some(line => /T1/.test(line)), "completed tasks should disappear from the live list");
await toolStart({ toolName: "seekbrain_report_generate", toolCallId: "report-2" }, ctx);
assert.deepEqual(widgets.at(-1)[1], [projectPath, "Writing report and exporting requested files  0s"], "reporting should not carry the old task list");
await toolUpdate({ toolName: "seekbrain_execution_run", toolCallId: "execution-2", partialResult: { details: { progress: true, task_id: "T4", task_status: "running" } } });
assert.equal(widgets.at(-1)[1].length, 2, "stale progress must not repopulate the task list");
await toolEnd({ toolName: "seekbrain_report_generate", toolCallId: "report-2", result: { details: { ok: true, report_path: "report.md", pdf_path: "report.pdf" } } }, ctx);
assert.deepEqual(widgets.at(-1)[1], [projectPath, "report.md", "report.pdf"]);
await toolStart({ toolName: "seekbrain_plan_generate", toolCallId: "plan-3" }, ctx);
await sessionStart({}, ctx);
assert.equal(intervals.size, 0, "new sessions must release the previous clock");
await toolStart({ toolName: "seekbrain_execution_run", toolCallId: "execution-aborted" }, ctx);
await toolUpdate({ toolName: "seekbrain_execution_run", toolCallId: "execution-aborted", partialResult: { details: { progress: true, task_id: "T1", task_status: "running" } } });
await handlers.get("agent_end").at(-1)({}, ctx);
assert.equal(intervals.size, 0, "an aborted turn must not leave the clock running");
assert.equal(widgets.at(-1)[1].length, 2, "an aborted turn must not leave a task displayed as running");
await toolStart({ toolName: "seekbrain_execution_run", toolCallId: "execution-error" }, ctx);
for (const [task_id, task_status] of [["T1", "running"], ["T2", "failed"]]) {
  await toolUpdate({ toolName: "seekbrain_execution_run", toolCallId: "execution-error", partialResult: { details: { progress: true, task_id, task_status } } });
}
await toolEnd({ toolName: "seekbrain_execution_run", toolCallId: "execution-error", isError: true, result: {} }, ctx);
assert.equal(intervals.size, 0);
assert.deepEqual(widgets.at(-1)[1], [projectPath, "Interrupted or incomplete; completed files are retained.", "  × T2"], "failed tasks should remain visible after execution stops");
await toolStart({ toolName: "seekbrain_plan_generate", toolCallId: "plan-headless" }, { ...ctx, hasUI: false });
assert.equal(intervals.size, 0, "non-interactive runs must not create UI refresh timers");
await toolEnd({ toolName: "seekbrain_plan_generate", toolCallId: "plan-headless", result: { details: { ok: true } } }, ctx);
await toolStart({ toolName: "seekbrain_plan_generate", toolCallId: "plan-5" }, ctx);
await handlers.get("session_shutdown").at(-1)({}, ctx);
assert.equal(intervals.size, 0, "shutdown must release the timer");
mock.restoreAll();
console.log("SeekBrain mode commands, native context, output activity and dynamic operation timers verified");
