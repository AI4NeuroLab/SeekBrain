import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

type Json = Record<string, any>;

export interface SaveSkillCommandAPI {
  registerCommand(name: string, command: Json): void;
  sendMessage(message: Json): void;
}

export interface SaveSkillCommandDependencies {
  workflowRoot: string;
  getActiveRunDir(): string | undefined;
  loadConfig(cwd: string): Promise<Json>;
  saveSkillEnabled(config: Json): boolean;
  readJson(path: string, fallback: Json): Promise<Json>;
  writeJson(path: string, value: Json): Promise<void>;
  resolveRun(cwd: string, runId: string): Promise<Json>;
  loadRunState(runId: string, runDir: string): Promise<Json>;
  runIndexPath(cwd: string): string;
  readRolePrompt(): Promise<string>;
  runNamer(input: { runDir: string; prompt: string; config: Json }): Promise<Json>;
  writeSkill(input: Json, cwd: string): Promise<Json>;
  updateState(run: Json, patch: Json): Promise<void>;
  appendEvent(event: Json): Promise<void>;
  registerRepositoryScripts?(input: {
    repositoryUrl: string;
    recipePath: string;
    scriptPath: string;
    utilityPath?: string;
    sourceCommit?: string;
    validationRunId: string;
  }): Promise<Json>;
}

function slug(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]+/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function messageText(message: Json): string {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) return message.content.map((item: any) => typeof item === "string" ? item : item?.text || "").filter(Boolean).join(" ");
  return String(message.text || "");
}

export function buildTranscriptDigest(sessionManager: any, maxChars = 4000): string {
  const entries = sessionManager?.getBranch?.() || sessionManager?.getEntries?.() || [];
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry?.type !== "message") continue;
    const message = entry.message || {};
    if (message.role === "user") {
      const text = messageText(message).trim();
      if (text) lines.push(`USER: ${text.slice(0, 400)}`);
    } else if (message.role === "assistant") {
      const names: string[] = [];
      if (message.toolName) names.push(String(message.toolName));
      if (Array.isArray(message.toolCalls)) for (const tool of message.toolCalls) if (tool?.name) names.push(String(tool.name));
      const neuro = names.filter((name) => name.startsWith("neuro"));
      if (neuro.length) lines.push(`TOOL: ${neuro.join(", ")}`);
    }
  }
  const digest = lines.join("\n");
  return digest.length > maxChars ? "...\n" + digest.slice(-maxChars) : digest;
}

function runIdArgument(args?: string): string | undefined {
  return String(args || "").trim().split(/\s+/).find((token) => token && !token.startsWith("-")) || undefined;
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [rolePrompt.trim(), "", "You are the isolated SeekBrain analysis-recipe naming agent for trajectory distillation.", "Return only by calling the finalize tool. Do not expose scratch reasoning.", "Required final tool: finalize_smmt", "", body].join("\n");
}

async function registerSkillPath(workflowRoot: string, skillDir: string): Promise<string | undefined> {
  try {
    const piDir = join(workflowRoot, ".pi");
    const settingsPath = join(piDir, "settings.json");
    let settings: Json;
    try { settings = JSON.parse(await readFile(settingsPath, "utf8")); } catch { settings = {}; }
    const path = relative(piDir, skillDir);
    const skills: string[] = Array.isArray(settings.skills) ? settings.skills : [];
    if (!skills.includes(path)) { skills.push(path); settings.skills = skills; await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8"); }
    return path;
  } catch { return undefined; }
}

export function registerSaveSkillCommand(pi: SaveSkillCommandAPI, dependencies: SaveSkillCommandDependencies): void {
  pi.registerCommand("seekbrain-save-recipe", {
    description: "Save a validated SeekBrain run as a reusable analysis recipe (Stage-Species-Modality-Method-Target). Optional args: <run_id> [--yes].",
    async handler(args: string, context: Json) {
      const config = await dependencies.loadConfig(context.cwd);
      if (!dependencies.saveSkillEnabled(config)) { context.ui?.notify?.("Analysis recipe saving is disabled by config (workflow.seekbrain.save_skill).", "info"); return; }
      let run: Json | undefined;
      try {
        const runId = runIdArgument(args);
        if (runId) run = await dependencies.resolveRun(context.cwd, runId);
        else if (dependencies.getActiveRunDir()) {
          const runDir = dependencies.getActiveRunDir()!;
          const state = await dependencies.readJson(join(runDir, "state.json"), {});
          if (state.run_id) run = await dependencies.loadRunState(state.run_id, runDir);
        }
        if (!run) {
          const index = await dependencies.readJson(dependencies.runIndexPath(context.cwd), { runs: {} });
          const ids = Object.keys(index.runs || {});
          if (!ids.length) { context.ui?.notify?.("No runs found. Finish a SeekBrain run first.", "error"); return; }
          let chosen = ids[ids.length - 1];
          if (context.hasUI && ids.length > 1) { const selected = await context.ui.select("Save which run as an analysis recipe?", ids); if (!selected) return; chosen = selected; }
          run = await dependencies.resolveRun(context.cwd, chosen);
        }
      } catch (error) { context.ui?.notify?.(`Could not locate run: ${error}`, "error"); return; }

      const generatedCode = join(run.runDir, "generated_code.py");
      if (!existsSync(generatedCode) && !(run.state.code?.code_files?.length > 0)) { context.ui?.notify?.("This run has no generated analysis code yet; there is no trajectory to distill.", "error"); return; }
      const validation = run.state.validation;
      const codeAttempt = Number(run.state.code_attempt || 0);
      const validatedAttempt = Number(validation?.validated_code_attempt ?? -1);
      if (validation?.pass !== true || validatedAttempt !== codeAttempt || run.state.validation_invalidated_by_code_edit === true) {
        context.ui?.notify?.("This run has not passed Validation for its current code; no reusable analysis recipe was saved.", "error");
        return;
      }
      const question = String(run.state.question || "").trim();
      const digest = buildTranscriptDigest(context.sessionManager);
      const codeText = existsSync(generatedCode) ? await readFile(generatedCode, "utf8").catch(() => "") : "";
      const metadataText = run.state.metadata_json_path
        ? await readFile(String(run.state.metadata_json_path), "utf8").catch(() => String(run.state.data_info || ""))
        : String(run.state.data_info || "");
      const planPath = String(run.state.plan?.path || join(run.runDir, "plan.md"));
      const planText = await readFile(planPath, "utf8").catch(() => String(run.state.plan?.plan_markdown || ""));
      const recipeText = run.state.targeted_skill_path
        ? await readFile(String(run.state.targeted_skill_path), "utf8").catch(() => String(run.state.targeted_skill || ""))
        : String(run.state.targeted_skill || "");
      const statisticsPath = String(run.state.code?.statistics_path || join(run.runDir, "statistics.json"));
      const statistics = run.state.code?.statistics && typeof run.state.code.statistics === "object"
        ? run.state.code.statistics
        : await dependencies.readJson(statisticsPath, {});
      const conclusionsPath = String(run.state.conclusions?.path || join(run.runDir, "conclusions.json"));
      const conclusions = await dependencies.readJson(conclusionsPath, run.state.conclusions || {});
      const rolePrompt = await dependencies.readRolePrompt();
      const body = [
        `Question:\n${question}`,
        `Data info (metadata):\n${metadataText.slice(0, 3000)}`,
        `Methodological schema summary:\n${planText.slice(0, 2000)}`,
        "Analysis code that actually ran:\n```python\n" + codeText.slice(0, 6000) + "\n```",
        `Statistics keys: ${Object.keys(statistics).join(", ") || "(none)"}`,
        `Conclusions:\n${JSON.stringify(conclusions).slice(0, 1500)}`,
        `Dialogue digest (intent & corrections):\n${digest}`,
        "Finalize with { stage, species, modality, method, target, rationale, proposed_description, triggers[5], tags[4-6] }.",
      ].join("\n\n");
      context.ui?.notify?.("Analyzing the validated trajectory to propose an analysis recipe name...", "info");
      const namer = await dependencies.runNamer({ runDir: run.runDir, prompt: finalizationPrompt(rolePrompt, body), config });
      if (!namer.ok || !namer.result) { context.ui?.notify?.(`Analysis recipe naming failed: ${namer.error || "no result"}`, "error"); return; }
      const result = namer.result;
      const smmt = { stage: slug(result.stage), species: slug(result.species), modality: slug(result.modality), method: slug(result.method), target: slug(result.target) };
      if (Object.values(smmt).some((value) => !value)) { context.ui?.notify?.("Namer returned an empty axis; aborting.", "error"); return; }
      const folderName = [smmt.stage, smmt.species, smmt.modality, smmt.method, smmt.target].join("-");
      const piName = folderName.replace(/_/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const warnings: string[] = [];
      if (!["ns_pre", "ns_seg", "ns_reg", "ns_feat", "ns_ana", "ns_multi"].includes(smmt.stage)) warnings.push(`stage '${smmt.stage}' is new`);
      if (!["zebrafish", "mouse", "marmoset", "human", "global"].includes(smmt.species)) warnings.push(`species '${smmt.species}' is unusual`);
      const summary = [`Recipe name : ${folderName}`, `Pi command  : /skill:${piName}`, `description : ${String(result.proposed_description || "").slice(0, 220)}`, `rationale   : ${String(result.rationale || "").slice(0, 220)}`, warnings.length ? `warnings    : ${warnings.join("; ")}` : "", "target dir  : .seekbrain/skills/from_expert/"].filter(Boolean).join("\n");
      const autoYes = /(^|\s)(--yes|-y|yes)(\s|$)/.test(String(args || ""));
      let approved: boolean;
      if (context.hasUI) approved = await context.ui.confirm("Save this run as an analysis recipe?", summary);
      else {
        approved = autoYes;
        if (!approved) {
          await dependencies.writeJson(join(run.runDir, "save_skill_proposal.json"), { folder_name: folderName, pi_name: piName, smmt, ...result });
          pi.sendMessage({ customType: "seekbrain-save-recipe", display: true, content: `Proposed analysis recipe:\n${summary}\n\nHeadless mode: re-run '/seekbrain-save-recipe ${run.runId} --yes' to write it, or inspect save_skill_proposal.json.` });
          return;
        }
      }
      if (!approved) { context.ui?.notify?.("Analysis recipe save cancelled.", "info"); return; }
      const targeted = config.modules?.targeted_skill || {};
      const payload = {
        run_dir: run.runDir, run_id: run.state.run_id, root_dir: dependencies.workflowRoot,
        output_dir: (Array.isArray(targeted.extra_skill_dirs) && targeted.extra_skill_dirs[0]) || ".seekbrain/skills/from_expert",
        smmt, folder_name: folderName, pi_name: piName, description: result.proposed_description, triggers: result.triggers, tags: result.tags,
        question, question_history: run.state.question_history || [], data_info: metadataText, plan_markdown: planText,
        statistics, conclusions, deep_research_context: run.state.deep_research_context || "", targeted_skill: recipeText,
        resource_profile: run.state.resource_profile || {}, image_analyses: [], deliverables: run.state.deliverables || [],
        transcript_digest: digest, generated_code_path: existsSync(generatedCode) ? generatedCode : "", use_llm_body: true,
      };
      context.ui?.notify?.("Distilling the validated trajectory into an analysis recipe...", "info");
      const authored = await dependencies.writeSkill(payload, dependencies.workflowRoot);
      if (!authored.ok) { context.ui?.notify?.(`Analysis recipe save failed: ${authored.error || JSON.stringify(authored.errors || authored.warnings || authored)}`, "error"); return; }
      let repositoryRegistration: Json | undefined;
      const repositoryReference = run.state.repository_reference;
      const scriptPath = join(String(authored.skill_dir || ""), "scripts", "run_analysis.py");
      if (dependencies.registerRepositoryScripts && repositoryReference?.repository_url && authored.skill_dir && existsSync(scriptPath)) {
        const utilityPath = join(String(authored.skill_dir), "scripts", "utils.py");
        repositoryRegistration = await dependencies.registerRepositoryScripts({
          repositoryUrl: String(repositoryReference.repository_url),
          recipePath: join(String(authored.skill_dir), "SKILL.md"),
          scriptPath,
          ...(existsSync(utilityPath) ? { utilityPath } : {}),
          ...(repositoryReference.source_commit ? { sourceCommit: String(repositoryReference.source_commit) } : {}),
          validationRunId: String(run.runId),
        });
      }
      await dependencies.updateState(run, { saved_skill: { skill_dir: authored.skill_dir, folder_name: authored.folder_name, pi_name: authored.pi_name, at: new Date().toISOString(), ...(repositoryRegistration ? { repository_registration: repositoryRegistration } : {}) } });
      await dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_recipe_save", ok: true, folder_name: authored.folder_name });
      const piRelative = authored.skill_dir ? await registerSkillPath(dependencies.workflowRoot, String(authored.skill_dir)) : undefined;
      const validationStatus = authored.validate_skills?.status || "unknown";
      context.ui?.notify?.(`Saved analysis recipe: ${authored.folder_name} (recipe validation: ${validationStatus})`, "info");
      pi.sendMessage({ customType: "seekbrain-save-recipe", display: true, content: [`## 🧩 Analysis recipe saved — \`${authored.folder_name}\``, String(result.proposed_description || "").trim(), "", `- Pi command: \`/skill:${authored.pi_name}\`${piRelative ? " _(active next Pi launch)_" : ""}`, `- directory: \`${authored.skill_dir}\``, `- recipe validation: **${validationStatus}**`, (authored.warnings || []).length ? `- warnings: ${(authored.warnings || []).join("; ")}` : "", "", "→ `/seekbrain-show recipe` for the full recipe document (`SKILL.md`)"].filter(Boolean).join("\n") });
    },
  });
}
