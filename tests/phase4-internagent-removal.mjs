import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
for (const path of [
  "src/targeted-skill/resolver.ts",
  "src/targeted-skill/rag-client.ts",
  "src/targeted-skill/taxonomy.ts",
  "src/targeted-skill/skill-writer.ts",
  "src/targeted-skill/indexer.ts",
  "src/targeted-skill/rag-skill-generator.ts",
  "src/targeted-skill/skill-library-manager.ts",
]) await access(join(root, path));

const runtime = await readFile(join(root, "src/extension/seekbrain-runtime.ts"), "utf8");
const saveCommand = await readFile(join(root, "src/extension/commands/save-skill-command.ts"), "utf8");
assert.doesNotMatch(runtime, /internagent\/|runPythonScript|resolve_targeted_skill\.py|rag_paper\.py/);
assert.doesNotMatch(saveCommand, /internagent\/|save_skill\.py|runPython/);
assert.match(runtime, /TargetedSkillResolver/);
assert.match(runtime, /PaperRagClient/);
assert.match(runtime, /SkillLibraryManager/);
assert.match(runtime, /RagSkillGenerator/);
assert.match(saveCommand, /writeSkill/);
assert.match(runtime, /SEEKBRAIN_PYTHON/);

await assert.rejects(access(join(root, "internagent")), (error) => error?.code === "ENOENT", "internagent/ must be removed after the TypeScript contracts pass");

console.log("Phase 4 InternAgent removal boundary passed");
