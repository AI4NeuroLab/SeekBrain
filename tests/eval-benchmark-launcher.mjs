import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../scripts/eval_benchmark.sh", import.meta.url), "utf8");

assert.match(script, /eval_benchmark\.sh Koninck_2025_Science_Advances 1E/);
assert.match(script, /EVAL_CODE=false/);
assert.match(script, /--eval-code\)/);
assert.match(script, /generated_code\.py/);
assert.match(script, /SCORER_ARGS\+=\(--eval-code\)/);
assert.match(script, /python "\$\{SCORER\}" "\$\{SCORER_ARGS\[@\]\}"/);
assert.match(script, /ln -s "\$\{ROUND_DIR\}\/generated_code\.py" "\$\{STAGED_RESULT\}\/generated_code\.py"/);
assert.doesNotMatch(script, /Generated Analysis Code \(submitted evidence\)/);
assert.doesNotMatch(script, /STAGED_RESULT=.*MODE_SUFFIX/);
assert.match(script, /RUBRIC_DIR="\$\{RUBRIC_DIR:-\$\{EVALUATE_DIR\}\/evaluate_query\/rubric_0714\}"/);
assert.match(script, /score_outputs\.py/);
assert.match(script, /--layout ours/);
assert.match(script, /--rubric-dir "\$\{RUBRIC_DIR\}"/);
assert.match(script, /results\/evaluation\/scores/);
assert.doesNotMatch(script, /eval_ours\.sh[^\n]*>|eval_cc\.sh[^\n]*>/);

console.log("benchmark evaluator keeps code grading opt-in and isolated");
