import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: registerNeuro } = await jiti.import("../extensions/neuro.ts");

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
registerNeuro(pi);

const statuses = [];
const notifications = [];
let selectedLevel = "level2 - Subquestion planning, SQ Level 1 execution, and evidence synthesis";
const ctx = {
  cwd: process.cwd(),
  hasUI: true,
  ui: {
    setTheme() { return { success: true }; },
    setTitle() {},
    setWidget() {},
    setStatus(name, value) { statuses.push([name, value]); },
    notify(message) { notifications.push(message); },
    async select() { return selectedLevel; },
  },
};

const sessionStart = handlers.get("session_start").at(-1);
const beforeAgentStart = handlers.get("before_agent_start").at(-1);
assert.equal(typeof sessionStart, "function");
assert.equal(typeof beforeAgentStart, "function");

await sessionStart({}, ctx);
let prompt = await beforeAgentStart({}, ctx);
assert.match(prompt.systemPrompt, /active NeuroScientist workflow: Level 1/);
assert.deepEqual(statuses.at(-1), ["neuro", "NeuroScientist: level1"]);
assert.match(notifications.at(-1), /Level 1/);

const neuroCommand = commands.get("neuro");
assert.ok(neuroCommand, "/neuro command must remain registered");
await neuroCommand.handler("", ctx);
prompt = await beforeAgentStart({}, ctx);
assert.match(prompt.systemPrompt, /active NeuroScientist workflow: Level 2/);
assert.deepEqual(statuses.at(-1), ["neuro", "NeuroScientist: level2"]);

console.log("neuro selector defaults to Level 1 and still switches levels");
