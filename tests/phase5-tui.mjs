import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const diffSource = await readFile(new URL("src/extension/tui/code-review-tui.ts", root), "utf8");
const selectorSource = await readFile(new URL("src/extension/tui/review-selectors.ts", root), "utf8");
const transparencySource = await readFile(new URL("src/extension/tui/transparency-card.ts", root), "utf8");

assert.match(extensionSource, /createCodeReviewDetails/);
assert.match(extensionSource, /selectBinaryReview/);
assert.match(extensionSource, /renderCall: renderCodeEditCall/);
assert.match(extensionSource, /renderResult: renderCodeUpdateResult/);
assert.doesNotMatch(extensionSource, /ui\.(select|input)|new Box|new Spacer|LazyDiffComponent|structuredPatch/);
assert.match(diffSource, /class SeekBrainDiffComponent/);
assert.match(diffSource, /truncateToWidth/);
assert.doesNotMatch(diffSource, /@pi-archimedes\/diff|class LazyDiffComponent|import\([^)]*diff/);
assert.match(selectorSource, /ui\.select/);
assert.match(transparencySource, /registerEntryRenderer/);
assert.match(transparencySource, /new Markdown/);
assert.doesNotMatch(diffSource + selectorSource, /packages\/workflows|extensions\/seekbrain/);

console.log("Phase 5 TUI selectors and diff rendering live behind Pi-only adapters");
