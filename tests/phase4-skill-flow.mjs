import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const resolver = await readFile(new URL("src/targeted-skill/resolver.ts", root), "utf8");
const generator = await readFile(new URL("src/targeted-skill/rag-skill-generator.ts", root), "utf8");
const manager = await readFile(new URL("src/targeted-skill/skill-library-manager.ts", root), "utf8");
const saveCommand = await readFile(new URL("src/extension/commands/save-skill-command.ts", root), "utf8");
const standardizedScript = new URL("library/skills/trajectory/zebrafish_functional_connectivity_matrix/scripts/main.py", root);
const obsoleteScript = new URL("library/skills/trajectory/zebrafish_functional_connectivity_matrix/code/main.py", root);

assert.match(manager, /\.seekbrain", "skills"/);
assert.match(manager, /"builtin", "trajectory", version/);
assert.match(manager, /\.seekbrain-managed\.json/);
assert.match(resolver, /ensureTrajectoryDir/);
assert.match(resolver, /resource_filter \|\| \{ suffixes: \["\.md", "\.py"\], max_files: 5 \}/);
assert.match(resolver, /join\(userSkillsRoot, "from_rag"\)/);
assert.match(generator, /SKILL\.md/);
assert.match(generator, /metadata\.json/);
assert.match(generator, /"scripts"/);
assert.match(generator, /"references"/);
assert.match(generator, /\.ipynb/);
assert.match(generator, /matched_paper_context/);
assert.match(generator, /connection_analysis/);
assert.match(generator, /reproduction_plan/);
assert.match(generator, /if \(existsSync\(join\(skillDir, "SKILL\.md"\)\)\).*reused: true/);
assert.match(saveCommand, /\.seekbrain\/skills\/from_expert/);
await access(standardizedScript);
await assert.rejects(access(obsoleteScript));

console.log("trajectory-first matching and persistent RAG skill storage are frozen");
