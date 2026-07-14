import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: registerUsageFooter } = await jiti.import("../extensions/usage-footer.ts");

let sessionStart;
registerUsageFooter({
  on(event, handler) {
    if (event === "session_start") sessionStart = handler;
  },
});

let footerFactory;
await sessionStart({}, {
  cwd: "/tmp/example-project",
  hasUI: true,
  model: { id: "test-model" },
  getContextUsage() { return { percent: 24.6 }; },
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
  { onBranchChange() { return () => {}; } },
);
const lines = component.render(120);
assert.equal(lines.length, 1);
assert.match(lines[0], /test-model/);
assert.match(lines[0], /ctx 25%/);
assert.match(lines[0], /1\.5k in \/ 250 out/);
assert.match(lines[0], /\$0\.0123/);
assert.doesNotMatch(lines[0], /example-project|main|read|bash/);

let headlessFooterInstalled = false;
await sessionStart({}, {
  hasUI: false,
  ui: { setFooter() { headlessFooterInstalled = true; } },
});
assert.equal(headlessFooterInstalled, false);

console.log("lightweight usage footer scenario passed");
