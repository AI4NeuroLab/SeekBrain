import assert from "node:assert/strict";
import {
  codeRetryPolicy,
  currentArtifactsValidated,
  fastPassRefinedValidation,
  normalizeValidation,
  validationNextStep,
} from "../src/workflows/seekbrain/validation-policy.js";

const base = {
  pass: true,
  per_figure: [{ path: "figure.png", pass: true, issues: [] }],
  overall_mismatches: [],
  blocking_issues: [],
  methodological_caveats: [],
  visual_issues: [],
  confidence: 0.9,
  summary: "ok",
};

const failed = normalizeValidation({
  ...base,
  pass: false,
  blocking_issues: ["Correct the group labels."],
}, { codeAttempt: 1 });
assert.equal(failed.route, "retry_code");
assert.match(failed.next_code_feedback, /group labels/);
assert.equal(validationNextStep(failed, "run-1").tool, "neuro_code");

const exhausted = normalizeValidation({ ...base, pass: false }, { codeAttempt: 3 });
assert.equal(exhausted.route, "conclude_with_limitations");
assert.ok(exhausted.next_code_feedback.length > 0);

const caveat = normalizeValidation({
  ...base,
  methodological_caveats: ["Small sample size limits generalization."],
}, { codeAttempt: 1 });
assert.equal(caveat.pass, true);
assert.equal(caveat.route, "proceed");

const contradictory = normalizeValidation({
  ...base,
  pass: true,
  per_figure: [{ path: "figure.png", pass: false, issues: ["Statistic mismatch."] }],
}, { codeAttempt: 1 });
assert.equal(contradictory.pass, false);
assert.equal(contradictory.route, "retry_code");
assert.match(contradictory.next_code_feedback, /Statistic mismatch/);

const visual = normalizeValidation({
  ...base,
  visual_issues: [
    { figure_path: "figure.png", feedback: "Move the legend outside the axes." },
    { figure_path: "secondary.png", feedback: "Increase font size." },
  ],
}, { codeAttempt: 1, refinementCount: 0 });
assert.equal(visual.route, "refine_image");
assert.equal(visual.visual_issues.length, 1);
assert.equal(validationNextStep(visual, "run-1").args.figure_path, "figure.png");

const refinedFastPass = fastPassRefinedValidation(visual, {
  refined_figure_path: "figure.png",
  summary: "Moved the legend.",
  remaining_issues: ["Small label remains."],
}, { integrityAccepted: true, codeAttempt: 1 });
assert.equal(refinedFastPass.allowed, true);
assert.equal(refinedFastPass.validation.route, "proceed");
assert.equal(refinedFastPass.validation.refined_fast_pass, true);
assert.deepEqual(refinedFastPass.validation.visual_issues, []);
assert.deepEqual(refinedFastPass.validation.refinement_remaining_issues, ["Small label remains."]);
assert.equal(validationNextStep(refinedFastPass.validation, "run-1", "figure.png").tool, "neuro_interpret");
assert.equal(currentArtifactsValidated({
  code_attempt: 1,
  refinement_pending_validation: false,
  validation: refinedFastPass.validation,
}), true);
assert.equal(fastPassRefinedValidation(visual, {}, { integrityAccepted: false }).allowed, false);
assert.equal(fastPassRefinedValidation({ ...visual, pass: false }, {}, { integrityAccepted: true }).allowed, false);

const visualAfterRefine = normalizeValidation({
  ...base,
  visual_issues: [{ figure_path: "figure.png", feedback: "Minor overlap remains." }],
}, { codeAttempt: 1, refinementCount: 1 });
assert.equal(visualAfterRefine.route, "proceed");

assert.equal(currentArtifactsValidated({
  code_attempt: 2,
  refinement_pending_validation: false,
  validation: { validated_code_attempt: 2 },
}), true);
assert.equal(currentArtifactsValidated({
  code_attempt: 2,
  refinement_pending_validation: true,
  validation: { validated_code_attempt: 2 },
}), false);
assert.equal(currentArtifactsValidated({
  code_attempt: 2,
  validation_invalidated_by_code_edit: true,
  refinement_pending_validation: false,
  validation: { validated_code_attempt: 2 },
}), false);

assert.equal(codeRetryPolicy({ code_attempt: 0 }).allowed, true);
assert.equal(codeRetryPolicy({ code_attempt: 1 }).reason, "validation_required");
assert.equal(codeRetryPolicy({
  code_attempt: 1,
  validation: { pass: true, validated_code_attempt: 1 },
}).reason, "already_passed");
assert.equal(codeRetryPolicy({
  code_attempt: 2,
  validation: { pass: false, route: "retry_code", validated_code_attempt: 1, next_code_feedback: "fix" },
}).reason, "stale_validation");
assert.equal(codeRetryPolicy({
  code_attempt: 1,
  validation: { pass: false, route: "retry_code", validated_code_attempt: 1, next_code_feedback: "fix labels" },
}).feedback, "fix labels");
assert.equal(codeRetryPolicy({ code_attempt: 3 }).reason, "attempt_limit");
assert.equal(currentArtifactsValidated({
  code_attempt: 2,
  refinement_pending_validation: false,
  validation: { validated_code_attempt: 1 },
}), false);

console.log("seekbrain validation policy scenarios passed");
