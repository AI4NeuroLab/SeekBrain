import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const hooksSource = await readFile(new URL("src/extension/runtime-hooks.ts", root), "utf8");

assert.match(extensionSource, /registerSeekBrainRuntimeHooks\(pi/);
assert.doesNotMatch(extensionSource, /pi\.on\(/);
assert.match(hooksSource, /pi\.on\("session_start"/);
assert.match(hooksSource, /pi\.on\("tool_execution_end"/);
assert.match(hooksSource, /pi\.on\("session_before_compact"/);
assert.match(hooksSource, /pi\.on\("tool_result"/);
assert.match(hooksSource, /pi\.appendEntry\(/);
assert.doesNotMatch(hooksSource, /pi\.sendMessage\(/);
assert.doesNotMatch(hooksSource, /packages\/workflows|extensions\/seekbrain/);

console.log("Phase 5 runtime hooks register through the Pi adapter boundary");
