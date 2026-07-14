export function countExactMatches(source, needle) {
  if (!needle) return 0;
  return source.split(needle).length - 1;
}

export function applyExactCodeEdits(source, edits) {
  if (!Array.isArray(edits) || edits.length === 0) {
    throw new Error("At least one exact code edit is required.");
  }

  let updatedCode = String(source);
  const appliedEdits = [];
  for (const [index, rawEdit] of edits.entries()) {
    const find = String(rawEdit?.find || "");
    const replace = String(rawEdit?.replace ?? "");
    const expectedMatches = Number(rawEdit?.expected_matches ?? 1);
    if (!find) throw new Error(`Edit ${index + 1}: find must not be empty.`);
    if (find === replace) throw new Error(`Edit ${index + 1}: find and replace are identical.`);
    if (!Number.isInteger(expectedMatches) || expectedMatches < 1) {
      throw new Error(`Edit ${index + 1}: expected_matches must be a positive integer.`);
    }

    const actualMatches = countExactMatches(updatedCode, find);
    if (actualMatches !== expectedMatches) {
      throw new Error(
        `Edit ${index + 1}: expected ${expectedMatches} exact match(es), found ${actualMatches}. No code was changed.`,
      );
    }
    updatedCode = updatedCode.split(find).join(replace);
    appliedEdits.push({ index: index + 1, expected_matches: expectedMatches, actual_matches: actualMatches });
  }

  if (updatedCode === source) throw new Error("The proposed edits produced no code changes.");
  return { updatedCode, appliedEdits };
}

export function validationInvalidationForScope(scope) {
  if (scope === "presentation") {
    return {
      visual_validation_invalidated_by_code_edit: true,
      validation_invalidations: { visual: true, scientific: false },
    };
  }
  return {
    validation_invalidated_by_code_edit: true,
    visual_validation_invalidated_by_code_edit: true,
    validation_invalidations: { visual: true, scientific: true },
  };
}
