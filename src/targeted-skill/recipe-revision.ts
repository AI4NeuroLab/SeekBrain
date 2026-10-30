import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadRecipeCard, validateRecipeCard, type RecipeCard } from "./recipe-card.ts";

type Json = Record<string, any>;

export type RecipeFailureAttribution = "recipe_defect" | "retrieval_mismatch" | "implementation_defect" | "data_mismatch" | "environment" | "inconclusive";

export interface RecipeRevisionAuthorInput {
  runDir: string;
  recipeId: string;
  sourceRecipe: string;
  sourceCard: RecipeCard;
  diagnosis: Json;
  validation: Json;
  signal?: AbortSignal;
}

export interface RecipeRevisionAuthorResult {
  revised_skill_body: string;
  recipe_card: Json;
  change_summary: string;
  executor_guidance: string;
  expected_acceptance_signals: string[];
  preserved_checks: string[];
}

export type RecipeRevisionAuthor = (input: RecipeRevisionAuthorInput) => Promise<RecipeRevisionAuthorResult>;

export interface RecipeRevisionHandleInput {
  runDir: string;
  state: Json;
  validation: Json;
  enabled: boolean;
  budget: number;
  generatedOnly: boolean;
  signal?: AbortSignal;
}

export interface RecipeRevisionHandleResult {
  state_patch: Json;
  validation_patch: Json;
  feedback_path?: string;
}

function compact(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(compact).filter(Boolean))];
}

function bumpPatch(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : `${version || "0.1.0"}-rev1`;
}

function bodyOnly(value: string): string {
  const text = value.trim();
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  return end >= 0 ? text.slice(end + 4).trim() : text;
}

function frontmatter(value: string): string {
  if (!value.startsWith("---")) return "";
  const end = value.indexOf("\n---", 3);
  return end >= 0 ? value.slice(0, end + 4).trim() : "";
}

function leakedPaths(value: string): string[] {
  return [...new Set(value.match(/(?:\/mnt\/|\/home\/|\/Users\/|[A-Za-z]:\\)[^\s`'"),;]*/g) || [])];
}

function procedural(value: string): boolean {
  return /(?:^|\n)##\s+(?:Procedure|Workflow|Inputs and outputs|Preconditions|Validation criteria)\b/i.test(value) || /(?:^|\n)\s*\d+[.)]\s+\S/m.test(value);
}

function revisedCard(source: RecipeCard, patch: Json): RecipeCard {
  const accepts = patch.accepts && typeof patch.accepts === "object" ? patch.accepts : {};
  return {
    ...source,
    ...patch,
    schema_version: 1,
    recipe_id: source.recipe_id,
    version: bumpPatch(source.version),
    status: "candidate",
    aliases: strings(patch.aliases || source.aliases),
    does: strings(patch.does || source.does),
    evidence_for: strings(patch.evidence_for || source.evidence_for),
    accepts: {
      species: strings(accepts.species || source.accepts.species),
      modalities: strings(accepts.modalities || source.accepts.modalities),
      observation_units: strings(accepts.observation_units || source.accepts.observation_units),
      requires: strings(accepts.requires || source.accepts.requires),
    },
    produces: strings(patch.produces || source.produces),
    use_when: strings(patch.use_when || source.use_when),
    avoid_when: strings(patch.avoid_when || source.avoid_when),
    source: source.source,
    quality: source.quality,
  };
}

async function writeJson(path: string, value: Json): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function selectedPaths(state: Json): string[] {
  const direct = Array.isArray(state.targeted_skill_result?.skill_paths) ? state.targeted_skill_result.skill_paths.map(String) : [];
  const selected = Array.isArray(state.targeted_skill_result?.recipe_set?.selected)
    ? state.targeted_skill_result.recipe_set.selected.map((item: Json) => String(item.path || "")).filter(Boolean)
    : [];
  return [...new Set([...direct, ...selected])];
}

function selectSourcePath(state: Json, diagnosis: Json): string | undefined {
  const paths = selectedPaths(state);
  const recipeId = compact(diagnosis.recipe_id);
  if (recipeId) {
    const selected = Array.isArray(state.targeted_skill_result?.recipe_set?.selected)
      ? state.targeted_skill_result.recipe_set.selected as Json[]
      : [];
    const bound = selected.find((item) => compact(item.recipe_id) === recipeId && compact(item.path));
    if (bound) return String(bound.path);
    const exact = paths.find((path) => basename(path) === recipeId || path.includes(recipeId));
    if (exact) return exact;
  }
  return paths.length === 1 ? paths[0] : undefined;
}

function revisionPublic(record: Json): Json {
  return {
    revision_id: record.revision_id,
    recipe_id: record.recipe_id,
    status: record.status,
    change_summary: record.change_summary,
    expected_acceptance_signals: record.expected_acceptance_signals,
    candidate_path: record.candidate_path,
    base_code_attempt: record.base_code_attempt,
  };
}

export class RecipeRevisionManager {
  constructor(readonly author: RecipeRevisionAuthor) {}

  async handle(input: RecipeRevisionHandleInput): Promise<RecipeRevisionHandleResult | undefined> {
    const current = input.state.recipe_revision_candidate && typeof input.state.recipe_revision_candidate === "object"
      ? input.state.recipe_revision_candidate as Json
      : undefined;
    const codeAttempt = Number(input.validation.validated_code_attempt || input.state.code_attempt || 0);
    if (current?.status === "candidate" && codeAttempt > Number(current.base_code_attempt || 0)) {
      const passed = input.validation.pass === true;
      const status = passed ? "provisional" : "rejected";
      const settled = { ...current, status, settled_at: new Date().toISOString(), settled_by_code_attempt: codeAttempt };
      if (current.record_path) await writeJson(String(current.record_path), settled);
      if (passed && current.card_path) {
        try {
          const card = JSON.parse(await readFile(String(current.card_path), "utf8")) as RecipeCard;
          await writeJson(String(current.card_path), { ...card, status: "provisional", quality: { ...card.quality, passed_runs: card.quality.passed_runs + 1 } });
        } catch { /* keep settlement record even if the sidecar is unreadable */ }
      }
      return {
        state_patch: { recipe_revision_candidate: settled },
        validation_patch: { recipe_revision: revisionPublic(settled) },
      };
    }

    const diagnosis = input.validation.recipe_feedback && typeof input.validation.recipe_feedback === "object" ? input.validation.recipe_feedback as Json : undefined;
    const attribution = String(diagnosis?.attribution || "") as RecipeFailureAttribution;
    if (!input.enabled || input.validation.pass === true || input.validation.route !== "retry_code" || !["recipe_defect", "retrieval_mismatch"].includes(attribution)) return undefined;
    const used = Number(input.state.recipe_revision_count || 0);
    if (used >= Math.max(0, Math.min(1, input.budget))) return {
      state_patch: {},
      validation_patch: { recipe_revision: { status: "skipped", reason: "revision_budget_exhausted" } },
    };
    const sourcePath = selectSourcePath(input.state, diagnosis || {});
    if (!sourcePath) return {
      state_patch: {},
      validation_patch: { recipe_revision: { status: "skipped", reason: "recipe_attribution_is_not_bound_to_one_selected_recipe" } },
    };
    let sourceRecipe: string;
    try { sourceRecipe = await readFile(join(sourcePath, "SKILL.md"), "utf8"); }
    catch {
      return { state_patch: {}, validation_patch: { recipe_revision: { status: "skipped", reason: "selected_recipe_is_unreadable" } } };
    }
    const sourceCard = await loadRecipeCard(sourcePath, sourceRecipe);
    if (input.generatedOnly && sourceCard.source.type !== "rag") return {
      state_patch: {},
      validation_patch: { recipe_revision: { status: "skipped", reason: "online_revision_is_limited_to_rag_candidates" } },
    };

    let authored: RecipeRevisionAuthorResult;
    try {
      authored = await this.author({
        runDir: input.runDir,
        recipeId: sourceCard.recipe_id,
        sourceRecipe,
        sourceCard,
        diagnosis: diagnosis || {},
        validation: input.validation,
        signal: input.signal,
      });
    } catch (error) {
      return {
        state_patch: { recipe_revision_count: used + 1 },
        validation_patch: { recipe_revision: { status: "skipped", reason: "revision_author_failed", error: compact(error) } },
      };
    }
    const card = revisedCard(sourceCard, authored.recipe_card || {});
    const cardValidation = validateRecipeCard(card);
    const body = bodyOnly(String(authored.revised_skill_body || ""));
    const fullRecipe = [frontmatter(sourceRecipe), body].filter(Boolean).join("\n\n").trimEnd() + "\n";
    const issues = [...cardValidation.issues];
    if (!body || !procedural(body)) issues.push("revision has no procedural contract");
    const paths = leakedPaths(`${fullRecipe}\n${authored.executor_guidance}\n${JSON.stringify(card)}`);
    if (paths.length) issues.push(`revision retained task-instance paths: ${paths.join(", ")}`);
    if (!compact(authored.executor_guidance)) issues.push("executor_guidance is required for bounded re-execution");
    if (issues.length) return {
      state_patch: { recipe_revision_count: used + 1 },
      validation_patch: { recipe_revision: { status: "rejected_by_static_gate", issues } },
    };

    const revisionId = `recipe-revision-${used + 1}`;
    const directory = join(input.runDir, "recipe_revision", revisionId);
    await mkdir(directory, { recursive: true });
    const candidatePath = join(directory, "SKILL.md");
    const cardPath = join(directory, "recipe-card.json");
    const recordPath = join(directory, "revision.json");
    await writeFile(candidatePath, fullRecipe, "utf8");
    await writeJson(cardPath, card as unknown as Json);
    const record = {
      schema_version: 1,
      revision_id: revisionId,
      recipe_id: sourceCard.recipe_id,
      source_recipe_path: sourcePath,
      source_version: sourceCard.version,
      candidate_version: card.version,
      candidate_path: candidatePath,
      card_path: cardPath,
      record_path: recordPath,
      status: "candidate",
      attribution,
      diagnosis,
      preserve: strings(diagnosis?.preserve),
      preserved_checks: strings(authored.preserved_checks),
      change_summary: compact(authored.change_summary),
      executor_guidance: compact(authored.executor_guidance),
      expected_acceptance_signals: strings(authored.expected_acceptance_signals),
      base_code_attempt: codeAttempt,
      created_at: new Date().toISOString(),
    };
    await writeJson(recordPath, record);
    const feedback = [
      String(input.validation.next_code_feedback || "").trim(),
      "Recipe revision candidate guidance (bounded revision 1/1):",
      `Read and apply the run-local candidate Recipe at ${candidatePath}.`,
      record.executor_guidance,
      record.expected_acceptance_signals.length ? `Acceptance signals: ${record.expected_acceptance_signals.join("; ")}` : "",
      record.preserve.length ? `Preserve already-passing behavior: ${record.preserve.join("; ")}` : "",
    ].filter(Boolean).join("\n");
    return {
      state_patch: { recipe_revision_count: used + 1, recipe_revision_candidate: record },
      validation_patch: { next_code_feedback: feedback, recipe_revision: revisionPublic(record) },
    };
  }
}
