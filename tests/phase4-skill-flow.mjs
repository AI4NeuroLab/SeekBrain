import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const resolver = await readFile(new URL("src/targeted-skill/resolver.ts", root), "utf8");
const repositoryCache = await readFile(new URL("src/targeted-skill/repository-cache.ts", root), "utf8");
const manager = await readFile(new URL("src/targeted-skill/skill-library-manager.ts", root), "utf8");
const saveCommand = await readFile(new URL("src/extension/commands/save-skill-command.ts", root), "utf8");
const standardizedScript = new URL("recipes/Single-modality/Dynamics%20Modality/ns_ana-zebrafish-ca-pearson-fc_matrix/scripts/reference_implementation.py", root);
const obsoleteScript = new URL("recipes/Single-modality/Dynamics%20Modality/ns_ana-zebrafish-ca-pearson-fc_matrix/code/reference_implementation.py", root);

assert.match(manager, /\.seekbrain", "skills"/);
assert.match(manager, /"builtin", "trajectory", version/);
assert.match(manager, /\.seekbrain-managed\.json/);
assert.match(resolver, /ensureTrajectoryDir/);
assert.match(resolver, /resource_filter \|\| \{ suffixes: \["\.md", "\.py"\], max_files: 5 \}/);
assert.match(resolver, /lookupValidatedRepositoryScripts/);
assert.match(resolver, /materializeRepository/);
assert.match(resolver, /join\(userSkillsRoot, "from_rag"\)/);
assert.match(resolver, /repository_recipe_crystallization_enabled/);
assert.match(repositoryCache, /validated-scripts\.json/);
assert.match(repositoryCache, /--filter=blob:none/);
assert.match(repositoryCache, /candidate_files/);
assert.match(saveCommand, /\.seekbrain\/skills\/from_expert/);
assert.match(saveCommand, /registerRepositoryScripts/);
await access(standardizedScript);
await assert.rejects(access(obsoleteScript));

console.log("trajectory-first matching, lightweight repository materialization, and validated-script reuse are frozen");
