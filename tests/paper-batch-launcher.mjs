import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const single = await readFile(new URL("../scripts/run_benchmark.sh", import.meta.url), "utf8");
const paper = await readFile(new URL("../scripts/run_all.sh", import.meta.url), "utf8");
const wrapper = await readFile(new URL("../pi_run_paper.sh", import.meta.url), "utf8");

assert.match(single, /run_benchmark\.sh Adam_2023_Cell 1H/);
assert.match(single, /benchmark_0714\/benchmark/);
assert.match(single, /questions\/\$\{PAPER_ID\}\/\$\{QUESTION_ID\}\.md/);
assert.match(single, /meta\/\$\{PAPER_ID\}\.json/);
assert.match(single, /results\/level1\/\$\{PAPER_ID\}\/\$\{QUESTION_ID\}/);
assert.match(single, /PI_CMD="\$\{ROOT_DIR\}\/\.tools\/node\/bin\/pi"/);
assert.match(single, /export PATH="\$\{ROOT_DIR\}\/\.tools\/node\/bin:/);
assert.match(single, /NEURO_LEVEL1_NON_INTERACTIVE=1/);
assert.match(single, /"\$\{PI_CMD\}"/);
assert.match(single, /-e extensions\/neuro\.ts/);
assert.match(single, /-p "/);
assert.doesNotMatch(single, /timeout|token|cost|--provider|--model|--thinking|--tools|--mode|--no-session/iu);

assert.match(paper, /run_all\.sh Adam_2023_Cell/);
assert.match(paper, /find "\$\{QUESTIONS_DIR\}"[^\n]+-name 'Fig_\*\.md' \| sort/);
assert.match(paper, /run_benchmark\.sh/);
assert.doesNotMatch(paper, /NEURO_LEVEL1_NON_INTERACTIVE|extensions\/neuro\.ts/);

assert.match(wrapper, /scripts\/run_all\.sh/);

console.log("single-question and paper launchers follow the CC script split");
