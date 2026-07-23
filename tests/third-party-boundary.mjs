import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extension = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const adapter = await readFile(new URL("src/extension/existing-pi-agent-adapter.ts", root), "utf8");
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

assert.doesNotMatch(extension, /createAgentSession|ModelRegistry|AuthStorage/);
assert.match(adapter, /createAgentSession/);
assert.equal(packageJson.dependencies["pi-subagents"], undefined);
assert.equal(packageJson.dependencies["@pi-archimedes/diff"], undefined);
assert.equal(packageJson.dependencies.diff, "8.0.4");
assert.doesNotMatch(adapter, /pi-subagents\/src|@pi-archimedes\/diff\/src/);

console.log("Pi session creation is isolated and the unlicensed diff dependency is absent");
