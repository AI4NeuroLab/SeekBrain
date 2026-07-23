const DEFAULT_MAX_CODE_ATTEMPTS = 3;

function strings(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function visualIssues(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const feedback = item.trim();
        return feedback ? { figure_path: "", feedback } : null;
      }
      const figurePath = String(item?.figure_path || item?.path || "").trim();
      const feedback = String(item?.feedback || item?.issue || "").trim();
      return feedback ? { figure_path: figurePath, feedback } : null;
    })
    .filter(Boolean)
    .slice(0, 1);
}

/**
 * Normalize a validator response into one deterministic workflow route.
 * The model reports facts; this function owns all action selection.
 */
export function normalizeValidation(raw, context = {}) {
  const codeAttempt = Number(context.codeAttempt || 0);
  const refinementCount = Number(context.refinementCount || 0);
  const maxCodeAttempts = Number(context.maxCodeAttempts || DEFAULT_MAX_CODE_ATTEMPTS);
  const perFigure = Array.isArray(raw?.per_figure) ? raw.per_figure : [];
  const perFigureFailures = perFigure.filter((entry) => entry?.pass === false);
  const blockingIssues = strings(raw?.blocking_issues);
  const methodologicalCaveats = strings(raw?.methodological_caveats);
  const normalizedVisualIssues = visualIssues(raw?.visual_issues);

  if (raw?.pass === true && perFigureFailures.length) {
    blockingIssues.push("One or more figures failed while the overall result was marked as passed.");
  }

  const pass = raw?.pass === true && blockingIssues.length === 0 && perFigureFailures.length === 0;
  const overallMismatches = strings(raw?.overall_mismatches);
  const failureDetails = perFigureFailures.flatMap((entry) => strings(entry?.issues));
  const nextCodeFeedback = pass
    ? ""
    : [...blockingIssues, ...overallMismatches, ...failureDetails].join("\n")
      || "Validation failed; correct the blocking validation issues before rerunning.";

  let route;
  if (!pass) {
    route = codeAttempt >= maxCodeAttempts ? "conclude_with_limitations" : "retry_code";
  } else if (refinementCount < 1 && normalizedVisualIssues.length) {
    route = "refine_image";
  } else {
    route = "proceed";
  }

  const refineTarget = route === "refine_image" ? normalizedVisualIssues[0] : null;
  return {
    ...raw,
    pass,
    per_figure: perFigure,
    blocking_issues: blockingIssues,
    methodological_caveats: methodologicalCaveats,
    visual_issues: normalizedVisualIssues,
    overall_mismatches: overallMismatches,
    route,
    next_code_feedback: nextCodeFeedback,
    refinement_feedback: refineTarget?.feedback || "",
    refine_target: refineTarget,
    validated_code_attempt: codeAttempt,
  };
}

export function validationNextStep(validation, runId, figurePath = "") {
  switch (validation?.route) {
    case "retry_code":
      return {
        tool: "neuro_code",
        args: { run_id: runId, validation_feedback: validation.next_code_feedback },
        reason: "Blocking validation issues require a Code repair.",
      };
    case "refine_image":
      return {
        tool: "neuro_refine_image",
        args: {
          run_id: runId,
          figure_path: validation.refine_target?.figure_path,
          feedback: validation.refinement_feedback,
        },
        reason: "Validation passed with one actionable presentation-only issue.",
      };
    case "conclude_with_limitations":
      return {
        tool: "neuro_interpret",
        args: { run_id: runId },
        reason: "The Code-attempt limit was reached; continue with tentative evidence and explicit limitations.",
      };
    default:
      return {
        tool: "neuro_interpret",
        args: { run_id: runId },
        reason: "Validation passed; continue to scientific interpretation.",
      };
  }
}

/**
 * Reuse the scientific pass from Validate after one presentation-only Refine.
 * The caller must first confirm that the refinement completed and that its
 * immutable data/statistics guard accepted the result.
 */
export function fastPassRefinedValidation(validation, refinement, context = {}) {
  const allowed = validation?.pass === true
    && validation?.route === "refine_image"
    && context.integrityAccepted === true;
  if (!allowed) {
    return { allowed: false, validation };
  }

  const previousTarget = validation.refine_target || null;
  return {
    allowed: true,
    validation: {
      ...validation,
      route: "proceed",
      visual_issues: [],
      refinement_feedback: "",
      refine_target: null,
      refined_fast_pass: true,
      pre_refinement_route: "refine_image",
      refined_figure_path: String(refinement?.refined_figure_path || previousTarget?.figure_path || ""),
      refinement_summary: String(refinement?.summary || ""),
      refinement_remaining_issues: strings(refinement?.remaining_issues),
      validated_code_attempt: Number(context.codeAttempt ?? validation.validated_code_attempt ?? 0),
    },
  };
}

export function codeRetryPolicy(state, suppliedFeedback = "", maxCodeAttempts = DEFAULT_MAX_CODE_ATTEMPTS) {
  const previousAttempt = Number(state?.code_attempt || 0);
  const validation = state?.validation || null;
  if (previousAttempt >= maxCodeAttempts) {
    return { allowed: false, reason: "attempt_limit", previousAttempt, feedback: "" };
  }
  if (previousAttempt === 0) {
    return { allowed: true, reason: "initial_attempt", previousAttempt, feedback: "" };
  }
  if (!validation) {
    return { allowed: false, reason: "validation_required", previousAttempt, feedback: "" };
  }
  const validatedAttempt = Number(validation.validated_code_attempt ?? previousAttempt);
  if (validatedAttempt !== previousAttempt) {
    return { allowed: false, reason: "stale_validation", previousAttempt, validatedAttempt, feedback: "" };
  }
  if (validation.pass === true) {
    return { allowed: false, reason: "already_passed", previousAttempt, feedback: "" };
  }
  const route = validation.route || (validation.pass === false ? "retry_code" : "");
  const feedback = String(suppliedFeedback || validation.next_code_feedback || "").trim();
  if (route !== "retry_code" || !feedback) {
    return { allowed: false, reason: "repair_feedback_required", previousAttempt, feedback: "" };
  }
  return { allowed: true, reason: "validated_retry", previousAttempt, feedback };
}

export function currentArtifactsValidated(state) {
  const validation = state?.validation;
  if (!validation) return false;
  if (state?.validation_invalidated_by_code_edit === true) return false;
  if (state?.refinement_pending_validation === true) return false;
  const currentAttempt = Number(state?.code_attempt || 0);
  const validatedAttempt = Number(validation.validated_code_attempt ?? currentAttempt);
  return validatedAttempt === currentAttempt;
}

export { DEFAULT_MAX_CODE_ATTEMPTS };
