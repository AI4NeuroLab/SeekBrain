import test from "node:test";
import assert from "node:assert/strict";
import { parseJudgeResponse } from "../scripts/brainarena-judge-response.mjs";

test("a bare score or numeric breakdown is not grading feedback", () => {
  for (const text of ["90", "**90**", "30 + 30 + 30\n90"]) {
    assert.throws(() => parseJudgeResponse(text), /without grading reasons/);
  }
});
test("English and Chinese explanations retain their final score", () => {
  assert.equal(parseJudgeResponse("Item 1: 25/30; missing uncertainty.\n75").score, 75);
  assert.equal(parseJudgeResponse("图形：25/30，缺少误差带。\n**75**").score, 75);
});
test("missing or out-of-range scores are rejected", () => {
  for (const text of ["Explanation without a score.", "Explanation\n101", "Explanation\n-1"]) {
    assert.throws(() => parseJudgeResponse(text), /0–100 integer/);
  }
});
