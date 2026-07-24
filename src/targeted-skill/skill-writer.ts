import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { regenerateSkillIndex } from "./indexer.ts";
import { canonicalLabel, normalizeSmmt, piName, validateSmmt } from "./taxonomy.ts";

type Json = Record<string, any>;

const REFERENCE_FILES: Record<string, (input: Json) => string> = {
  "question.md": (input) => `# Source question\n\n${input.question || "No question recorded."}\n`,
  "question-history.md": (input) => `# Question history\n\n${JSON.stringify(input.question_history || [], null, 2)}\n`,
  "data-info.md": (input) => `# Data information\n\n${input.data_info || "No data metadata recorded."}\n`,
  "plan.md": (input) => `# Methodological schema\n\n${input.plan_markdown || "No methodological schema recorded."}\n`,
  "statistics.md": (input) => `# Statistics\n\n\`\`\`json\n${JSON.stringify(input.statistics || {}, null, 2)}\n\`\`\`\n`,
  "conclusions.md": (input) => `# Conclusions\n\n${JSON.stringify(input.conclusions || {}, null, 2)}\n`,
  "research-context.md": (input) => `# Research context\n\n${input.deep_research_context || "No research context recorded."}\n`,
  "artifacts.md": (input) => `# Run artifacts\n\n${JSON.stringify({ resource_profile: input.resource_profile || {}, image_analyses: input.image_analyses || [], deliverables: input.deliverables || [] }, null, 2)}\n`,
  "transcript-digest.md": (input) => `# Transcript digest\n\n${input.transcript_digest || "No transcript digest recorded."}\n`,
};

function safeOutputDir(input: Json, projectRoot: string): string {
  const configured = String(input.output_dir || ".seekbrain/skills");
  return isAbsolute(configured) ? resolve(configured) : resolve(projectRoot, configured);
}

async function uniqueSkillDir(outputDir: string, requested: string): Promise<{ folderName: string; skillDir: string }> {
  for (let version = 1; version < 10_000; version += 1) {
    const folderName = version === 1 ? requested : `${requested}-v${version}`;
    const skillDir = join(outputDir, folderName);
    if (!existsSync(skillDir)) return { folderName, skillDir };
  }
  throw new Error(`could not allocate a unique analysis recipe folder under ${outputDir}`);
}

function skillMarkdown(input: Json, folderName: string, commandName: string): string {
  const description = String(input.description || `Reusable SeekBrain analysis captured from run ${input.run_id || "unknown"}.`).trim();
  const triggers = Array.isArray(input.triggers) ? input.triggers.map(String).filter(Boolean) : [];
  const tags = Array.isArray(input.tags) ? input.tags.map(String).filter(Boolean) : [];
  const metadata = stringifyYaml({ name: commandName, description, ...(triggers.length ? { triggers } : {}), ...(tags.length ? { tags } : {}) }).trim();
  return [
    "---", metadata, "---", "", `# ${folderName}`, "", "## Description", "", description, "",
    "## Workflow", "", "1. Read the files in `references/` to recover the original intent, data constraints, methodological schema, and conclusions.",
    "2. Adapt `scripts/run_analysis.py` to the current dataset; never assume paths or schemas are unchanged.",
    "3. Run the adapted analysis, validate its outputs, and report any deviations from the captured workflow.", "",
    "## Resources", "", "- `scripts/run_analysis.py`: analysis code captured from the successful run.",
    "- `references/`: provenance and reusable scientific context.", "",
  ].join("\n");
}

export async function writeSkill(input: Json, cwd = process.cwd()): Promise<Json> {
  const warnings: string[] = [];
  try {
    const projectRoot = resolve(input.root_dir || cwd);
    const smmt = normalizeSmmt(input.smmt || {});
    const validation = validateSmmt(smmt);
    warnings.push(...validation.warnings);
    if (!validation.ok) return { ok: false, errors: validation.errors, warnings, validate_skills: { status: "failed", issues: validation.errors, warnings } };

    const requestedFolder = canonicalLabel(smmt);
    const commandName = piName(smmt);
    const outputDir = safeOutputDir(input, projectRoot);
    await mkdir(outputDir, { recursive: true });
    const { folderName, skillDir } = await uniqueSkillDir(outputDir, requestedFolder);
    const scriptsDir = join(skillDir, "scripts");
    const referencesDir = join(skillDir, "references");
    await mkdir(scriptsDir, { recursive: true });
    await mkdir(referencesDir, { recursive: true });

    const written: string[] = [];
    const skillPath = join(skillDir, "SKILL.md");
    await writeFile(skillPath, skillMarkdown(input, folderName, commandName), "utf8");
    written.push(skillPath);

    const generatedCode = String(input.generated_code_path || "");
    const scriptPath = join(scriptsDir, "run_analysis.py");
    if (generatedCode && existsSync(generatedCode)) await copyFile(generatedCode, scriptPath);
    else await writeFile(scriptPath, "# No generated analysis code was available for this captured run.\n", "utf8");
    written.push(scriptPath);

    for (const [name, render] of Object.entries(REFERENCE_FILES)) {
      const path = join(referencesDir, name);
      await writeFile(path, render(input), "utf8");
      written.push(path);
    }

    const metadataPath = join(skillDir, "metadata.json");
    await writeFile(metadataPath, `${JSON.stringify({ schema_version: 1, created_at: new Date().toISOString(), run_id: input.run_id || null, smmt, folder_name: folderName, pi_name: commandName, source_run_dir: input.run_dir ? relative(projectRoot, resolve(input.run_dir)) : null }, null, 2)}\n`, "utf8");
    written.push(metadataPath);
    const index = await regenerateSkillIndex(outputDir);
    return { ok: true, skill_dir: skillDir, folder_name: folderName, pi_name: commandName, smmt, files_written: written, index_updated: index.path, validate_skills: { status: "passed", issues: [], warnings }, warnings };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), warnings, validate_skills: { status: "failed", issues: [String(error)], warnings } };
  }
}
