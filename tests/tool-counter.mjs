import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: registerToolCounter } = await jiti.import("../extensions/tool-counter.ts");

const handlers = new Map();
registerToolCounter({
  on(event, handler) { handlers.set(event, handler); },
});

await handlers.get("tool_execution_end")({ toolName: "read" });
await handlers.get("tool_execution_end")({ toolName: "read" });
await handlers.get("tool_execution_end")({ toolName: "bash" });

let footerFactory;
await handlers.get("session_start")({}, {
  cwd: "/tmp/example-project",
  hasUI: false,
  model: { id: "test-model" },
  getContextUsage() { return { percent: 25 }; },
  sessionManager: {
    getBranch() {
      return [
        { type: "message", message: { role: "assistant", usage: { input: 1500, output: 250, cost: { total: 0.0123 } } } },
        { type: "message", message: { role: "assistant" } },
      ];
    },
  },
  ui: {
    setFooter(factory) { footerFactory = factory; },
  },
});

assert.equal(typeof footerFactory, "function");
const component = footerFactory(
  { requestRender() {} },
  { fg(_style, value) { return value; } },
  { getGitBranch() { return "main"; }, onBranchChange() { return () => {}; } },
);
const lines = component.render(160);
assert.equal(lines.length, 2);
assert.match(lines[0], /test-model/);
assert.match(lines[0], /1\.5k in 250 out \$0\.0123/);
assert.match(lines[1], /example-project \(main\)/);
assert.match(lines[1], /read 2/);
assert.match(lines[1], /bash 1/);

console.log("tool counter footer scenario passed");
