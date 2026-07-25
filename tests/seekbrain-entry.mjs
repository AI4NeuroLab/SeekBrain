import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { visibleWidth } from "@earendil-works/pi-tui";

const jiti = createJiti(import.meta.url);
const { default: registerSeekBrain } = await jiti.import("../src/extension/index.ts");

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
  async appendEntry() {},
  sendMessage() {},
};
registerSeekBrain(pi);

const statuses = [];
const notifications = [];
const widgets = [];
let headerFactory;
const testTheme = {
  fg(_style, value) { return value; },
  bold(value) { return value; },
};
const ctx = {
  cwd: process.cwd(),
  hasUI: true,
  ui: {
    setTheme() { return { success: true }; },
    setHeader(factory) { headerFactory = factory; },
    setTitle() {},
    setWidget(name, content) { widgets.push([name, content]); },
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
assert.match(compactHeader, /╭─ SeekBrain v0\.1\.1/);
assert.match(compactHeader, /█▀▀ █▀▀ █▀▀ █▄▀/);
assert.match(compactHeader, /READY FOR RESEARCH/);
assert.match(compactHeader, /SCIENTIFIC RESEARCH AGENT/);
assert.match(compactHeader, /QUESTION.*PLAN.*ANALYZE.*VALIDATE.*INSIGHT/);
assert.match(compactHeader, /Type below to begin.*ctrl\+o guide.*\/seekbrain-setup models/);
assert.doesNotMatch(compactHeader, /\/entry/);
assert.doesNotMatch(compactHeader, /LOADED/);
for (const width of [1, 8, 48, 80, 160]) {
  assert.ok(header.render(width).every((line) => visibleWidth(line) <= width), `header must fit ${width} columns`);
}
header.setExpanded(true);
const expandedHeader = header.render(160).join("\n");
assert.match(expandedHeader, /START.*Type your research question directly/s);
assert.match(expandedHeader, /DATA.*start with only a question/s);
assert.match(expandedHeader, /MODELS.*\/seekbrain-setup/s);
assert.match(expandedHeader, /LOADED.*research workflow.*adaptive stage tracker.*usage footer/s);
assert.doesNotMatch(expandedHeader, /\/entry/);

let prompt = await beforeAgentStart({}, ctx);
assert.match(prompt.systemPrompt, /running SeekBrain's research workflow/);
assert.deepEqual(statuses.at(-1), ["seekbrain", undefined]);
assert.deepEqual(widgets.at(-1), ["seekbrain-workflow", undefined]);

const toolEnd = handlers.get("tool_execution_end").at(-1);
await toolEnd({
  toolName: "seekbrain_research_start",
  result: { details: { ok: true, round_name: "planning", round_number: 0 } },
}, ctx);
assert.deepEqual(widgets.at(-1), ["seekbrain-workflow", undefined]);

await toolEnd({
  toolName: "seekbrain_planning_decision_review",
  result: { details: { ok: true, decision: "no", round_name: "round1", round_number: 1 } },
}, ctx);
assert.equal(typeof widgets.at(-1)[1], "function");
assert.deepEqual(statuses.at(-1), ["seekbrain", "SeekBrain: 0/5 stages"]);
const pipeline = widgets.at(-1)[1]({}, testTheme);
assert.match(pipeline.render(160).join("\n"), /Round 1.*○ Recipe.*○ Analytical Formulation.*○ Interpretation/);
assert.match(pipeline.render(80).join("\n"), /Round 1.*○ Recipe.*○ Formulate.*○ Interpret/);

const seekBrainCommand = commands.get("seekbrain");
assert.ok(seekBrainCommand, "/seekbrain command must be registered");
assert.ok(commands.has("seekbrain-setup"), "/seekbrain-setup must open the Pi-native setup wizard");
assert.equal(commands.has("neuro"), false, "the retired workflow selector must not be public");
await seekBrainCommand.handler("", ctx);
prompt = await beforeAgentStart({}, ctx);
assert.match(prompt.systemPrompt, /running SeekBrain's research workflow/);
assert.deepEqual(statuses.at(-1), ["seekbrain", undefined]);
assert.deepEqual(widgets.at(-1), ["seekbrain-workflow", undefined]);
assert.match(notifications.at(-1), /SeekBrain workflow ready/);

console.log("SeekBrain exposes one workflow entry without a level selector");
