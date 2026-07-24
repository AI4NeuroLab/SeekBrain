import assert from "node:assert/strict";
import { createJiti } from "jiti";

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
const header = headerFactory({}, {
  fg(_style, value) { return value; },
  bold(value) { return value; },
});
assert.match(header.render(160).join("\n"), /seekbrain v0\.1\.5/);
assert.match(header.render(160).join("\n"), /Press ctrl\+o to show full startup help and loaded resources/);
assert.doesNotMatch(header.render(160).join("\n"), /\[Prompts\]/);
header.setExpanded(true);
assert.match(header.render(160).join("\n"), /\[Prompts\].*\/entry/s);
assert.match(header.render(160).join("\n"), /\[Extensions\].*SeekBrain workflow, usage footer/s);
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
const pipeline = widgets.at(-1)[1](
  {},
  { fg(_style, value) { return value; }, bold(value) { return value; } },
);
assert.match(pipeline.render(160).join("\n"), /Round 1.*Recipe ○.*Analytical Formulation ○.*Result Interpretation ○/);

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
