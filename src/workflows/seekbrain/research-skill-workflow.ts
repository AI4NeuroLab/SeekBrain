import { join, resolve } from "node:path";
import { literatureQueryConfig } from "../../core/index.ts";
import { readCanonicalMetadata, type RunLifecycleWorkflow, type WorkflowJson, type WorkflowRunContext } from "./run-lifecycle.ts";

export interface ResearchSkillFlags {
  targeted_skill_match: boolean;
  targeted_skill_generate: boolean;
  rag_recipe_crystallization?: boolean;
  literature_provider?: string;
  has_literature_provider?: boolean;
}

export interface StageAgentResult {
  ok: boolean;
  result?: WorkflowJson;
  error?: string;
  output_path?: string;
  subagent_dir?: string;
  snapshot_dir?: string;
}

export interface ResearchSkillDependencies {
  lifecycle: RunLifecycleWorkflow;
  resolveSkill(input: WorkflowJson, cwd: string, signal?: AbortSignal): Promise<WorkflowJson>;
  writeText(path: string, value: string): Promise<void>;
  appendEvent(event: WorkflowJson): Promise<void>;
  summarize(value: WorkflowJson): WorkflowJson;
}

export interface TargetedSkillInput {
  cwd: string;
  workflowRoot: string;
  runId: string;
  question?: string;
  params: WorkflowJson;
  config: WorkflowJson;
  flags: ResearchSkillFlags;
  signal?: AbortSignal;
}

function skipped(runId: string, tool: string, key: string): WorkflowJson {
  return {
    ok: true,
    skipped: true,
    skipped_by_config: true,
    reason: "disabled_by_user_config",
    message: `${tool} is disabled by user configuration workflow.seekbrain.${key}; this is not a tool failure.`,
    run_id: runId,
    config_key: `workflow.seekbrain.${key}`,
  };
}

function question(run: WorkflowRunContext, requested?: string): string {
  const value = String(requested || run.state.original_question || run.state.question || "").trim();
  if (!value) {
    throw new Error("question is required. Pass it to the tool, or persist it first via seekbrain_run_start/seekbrain_run_resume.");
  }
  return value;
}

function fromCwd(cwd: string, value: unknown, fallback: string): string {
  return resolve(cwd, String(value || fallback));
}

export function compactRecipeMethodContract(recipe: unknown): string {
  const text = String(recipe || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return "";
  const skillStart = text.indexOf("[SKILL.md]");
  const source = skillStart >= 0 ? text.slice(skillStart + "[SKILL.md]".length) : text;
  const title = source.match(/^#\s+(.+)$/m)?.[0] || "";
  const wanted = new Set(["preconditions", "inputs and outputs", "procedure", "key parameters", "pitfalls"]);
  const headings = [...source.matchAll(/^##\s+(.+)$/gm)];
  const sections: string[] = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (!wanted.has(String(heading[1] || "").trim().toLowerCase())) continue;
    const start = Number(heading.index);
    const end = index + 1 < headings.length ? Number(headings[index + 1].index) : source.length;
    sections.push(source.slice(start, end).trim());
  }
  if (sections.length) return [title, ...sections].filter(Boolean).join("\n\n");
  const withoutBundledFiles = source.split(/^##\s+Bundled files\s*$/m)[0];
  return withoutBundledFiles.trim();
}

export class ResearchSkillWorkflow {
  constructor(readonly dependencies: ResearchSkillDependencies) {}

  async resolveTargetedSkill(input: TargetedSkillInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    if (!input.flags.targeted_skill_match && !input.flags.targeted_skill_generate) {
      return skipped(run.runId, "seekbrain_recipe_retrieve", "targeted_skill_match/targeted_skill_generate");
    }
    const configured = literatureQueryConfig(
      input.config,
      input.config.modules?.targeted_skill || input.config.targeted_skill || {},
    );
    const paths = input.config.paths || {};
    const traceDir = join(run.runDir, "targeted_skill_trace");
    const projectDir = input.params.project_dir || paths.project_dir
      ? fromCwd(input.cwd, input.params.project_dir || paths.project_dir, ".")
      : undefined;
    const rootDir = input.params.root_dir || paths.root_dir
      ? fromCwd(input.cwd, input.params.root_dir || paths.root_dir, ".")
      : input.workflowRoot;
    const result = await this.dependencies.resolveSkill({
      ...configured,
      ...input.params,
      question: question(run, input.question),
      dataset_metadata: await readCanonicalMetadata(run),
      skill_enable: true,
      match_skill_enable: input.flags.targeted_skill_match,
      generate_skill_enable: input.flags.targeted_skill_generate,
      repository_recipe_crystallization_enabled: input.params.repository_recipe_crystallization_enabled
        ?? (input.flags.rag_recipe_crystallization === true),
      ...(projectDir ? { project_dir: projectDir } : {}),
      root_dir: rootDir,
      trace_dir: traceDir,
    }, input.cwd, input.signal);
    const targetedSkillPath = join(run.runDir, "targeted_skill.md");
    if (result.targeted_skill) await this.dependencies.writeText(targetedSkillPath, String(result.targeted_skill));
    const { targeted_skill: _fullSkill, targeted_skill_preview: _skillPreview, ...resultWithoutSkill } = result;
    const summarized = this.dependencies.summarize(resultWithoutSkill);
    const methodContract = compactRecipeMethodContract(result.targeted_skill);
    const recipeSummary = (methodContract || String(result.targeted_skill || "")).trim().slice(0, 500);
    await this.dependencies.lifecycle.updateState(run, {
      targeted_skill_path: result.targeted_skill ? targetedSkillPath : "",
      targeted_skill_result: { ...summarized, summary: recipeSummary, method_contract: methodContract },
      ...(result.method_pack ? { method_pack: result.method_pack } : {}),
      ...(result.artifacts?.method_pack_json ? { method_pack_path: result.artifacts.method_pack_json } : {}),
      ...(result.repository_reference ? { repository_reference: result.repository_reference } : {}),
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_recipe_retrieve",
      ok: result.ok,
      matched: result.matched,
      source: result.source,
      trace_id: result.trace_id,
    });
    return {
      ...summarized,
      summary: recipeSummary,
      run_id: run.runId,
      targeted_skill_path: result.targeted_skill ? targetedSkillPath : undefined,
      trace_dir: traceDir,
    };
  }

}
