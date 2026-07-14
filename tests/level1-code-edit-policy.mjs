import assert from "node:assert/strict";
import {
  applyExactCodeEdits,
  countExactMatches,
  validationInvalidationForScope,
} from "../extensions/neuro/level1/code-edit-policy.js";

assert.equal(countExactMatches('cmap="Reds"\ncmap="Reds"', 'cmap="Reds"'), 2);

const oneLine = applyExactCodeEdits(
  'imshow(data, cmap="Reds", vmin=0.2)',
  [{ find: 'cmap="Reds"', replace: 'cmap="Blues"', expected_matches: 1 }],
);
assert.equal(oneLine.updatedCode, 'imshow(data, cmap="Blues", vmin=0.2)');
assert.equal(oneLine.appliedEdits[0].actual_matches, 1);

assert.throws(
  () => applyExactCodeEdits('x = 1\nx = 1', [{ find: 'x = 1', replace: 'x = 2' }]),
  /expected 1 exact match\(es\), found 2/,
);
assert.throws(
  () => applyExactCodeEdits('x = 1', [{ find: 'missing', replace: 'x = 2' }]),
  /found 0/,
);
assert.throws(
  () => applyExactCodeEdits('x = 1', [{ find: 'x = 1', replace: 'x = 1' }]),
  /identical/,
);

assert.deepEqual(validationInvalidationForScope("presentation"), {
  visual_validation_invalidated_by_code_edit: true,
  validation_invalidations: { visual: true, scientific: false },
});
assert.equal(validationInvalidationForScope("scientific").validation_invalidated_by_code_edit, true);

console.log("level1 code edit policy scenarios passed");
