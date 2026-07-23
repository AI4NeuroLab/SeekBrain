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
const ctx = {
  cwd: process.cwd(),
  hasUI: true,
  ui: {
    setTheme() { return { success: true }; },
    setTitle() {},
    setWidget() {},
    setStatus(name, value) { statuses.push([name, value]); },
    notify(message) { notifications.push(message); },
  },
};

const sessionStart = handlers.get("session_start").at(-1);
const beforeAgentStart = handlers.get("before_agent_start").at(-1);
assert.equal(typeof sessionStart, "function");
assert.equal(typeof beforeAgentStart, "function");

await sessionStart({}, ctx);
let prompt = await beforeAgentStart({}, ctx);
assert.match(prompt.systemPrompt, /running SeekBrain's research workflow/);
assert.deepEqual(statuses.at(-1), ["seekbrain", "SeekBrain: 0/5 stages"]);

const seekBrainCommand = commands.get("seekbrain");
assert.ok(seekBrainCommand, "/seekbrain command must be registered");
assert.ok(commands.has("seekbrain-setup"), "/seekbrain-setup must open the Pi-native setup wizard");
assert.equal(commands.has("neuro"), false, "the retired workflow selector must not be public");
await seekBrainCommand.handler("", ctx);
prompt = await beforeAgentStart({}, ctx);
assert.match(prompt.systemPrompt, /running SeekBrain's research workflow/);
assert.deepEqual(statuses.at(-1), ["seekbrain", "SeekBrain: 0/5 stages"]);
assert.match(notifications.at(-1), /SeekBrain workflow ready/);

console.log("SeekBrain exposes one workflow entry without a level selector");
