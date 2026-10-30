import assert from "node:assert/strict";
import test from "node:test";
import { buildToolResultsMap, EMPTY_TRANSCRIPT, mergeTailPage, prependOlderPage } from "./subagent-viewer-state.ts";

const message = (id) => ({ role: "user", content: id });
const page = (ids, { hasMore = false, oldest = ids[0] ?? null } = {}) => ({
  messages: ids.map(message),
  entryIds: ids,
  oldestEntryId: oldest,
  hasMore,
});

test("buildToolResultsMap pairs tool results by tool call id", () => {
  const result = { role: "toolResult", toolCallId: "call-1", content: [] };
  assert.equal(buildToolResultsMap([message("a"), result]).get("call-1"), result);
});

test("a poll keeps the older pages loaded above the newest page", () => {
  // The user paged up to a1; the run then appended e5 and e6.
  const shown = page(["a1", "a2", "e1", "e2", "e3", "e4"], { hasMore: true, oldest: "a0" });
  const merged = mergeTailPage(shown, page(["e3", "e4", "e5", "e6"], { hasMore: true }));
  assert.deepEqual(merged.entryIds, ["a1", "a2", "e1", "e2", "e3", "e4", "e5", "e6"]);
  assert.equal(merged.oldestEntryId, "a0");
  assert.equal(merged.hasMore, true);
  // Messages already shown keep their objects, so MessageView's memo holds.
  assert.equal(merged.messages[4], shown.messages[4]);
  assert.equal(merged.messages.length, merged.entryIds.length);
});

test("a poll that no longer overlaps, or covers the whole branch, replaces the transcript", () => {
  const shown = page(["a1", "a2"], { hasMore: true });
  assert.deepEqual(mergeTailPage(shown, page(["z1", "z2"], { hasMore: true })).entryIds, ["z1", "z2"]);
  assert.deepEqual(mergeTailPage(shown, page(["a2", "a3"])).entryIds, ["a2", "a3"]);
  assert.deepEqual(mergeTailPage(EMPTY_TRANSCRIPT, page(["a1"])).entryIds, ["a1"]);
});

test("an older page is prepended once, and only onto the cursor it was asked for", () => {
  const shown = page(["e1", "e2"], { hasMore: true, oldest: "e1" });
  const older = page(["a1", "a2"], { hasMore: false, oldest: "a1" });
  const prepended = prependOlderPage(shown, "e1", older);
  assert.deepEqual(prepended.entryIds, ["a1", "a2", "e1", "e2"]);
  assert.equal(prepended.oldestEntryId, "a1");
  assert.equal(prepended.hasMore, false);
  // The same answer arriving again, or after a poll moved the cursor, is dropped.
  assert.equal(prependOlderPage(prepended, "e1", older), prepended);
});
