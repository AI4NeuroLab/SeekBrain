import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageEntry = await readFile(new URL("src/extension/index.ts", root), "utf8");
const compositionEntry = await readFile(new URL("src/extension/seekbrain-extension.ts", root), "utf8");

assert.match(packageEntry, /import registerSeekBrain from "\.\/seekbrain-extension\.ts"/);
assert.match(packageEntry, /registerSeekBrain\(pi\)/);
assert.match(packageEntry, /setWidget\("seekbrain-workflow"/);
assert.match(compositionEntry, /registerSeekBrainRuntime/);
assert.doesNotMatch(compositionEntry, /registerTool|registerCommand|pi\.on|Type\.Object/);

console.log("Phase 5 package entry owns the workflow widget and delegates tool composition");
