import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { pythonProcessEnvironment, resolvePythonCommand } from "../platform/python.mjs";
import type { RecipeCard, RecipeKind } from "./recipe-card.ts";
import { inferSemanticTerms, validateRecipeCard } from "./recipe-card.ts";

type Json = Record<string, any>;

export interface RecipeDraftQualityGate {
  schema_version: 1;
  passed: boolean;
  blocking_issues: string[];
  warnings: string[];
  checks: {
    structured_contract: boolean;
    procedural_content: boolean;
    evidence_available: boolean;
    no_instance_path_leakage: boolean;
    script_syntax: "passed" | "failed" | "not_applicable" | "unavailable";
  };
  checked_at: string;
}

export interface RecipeEvidenceManifest {
  schema_version: 1;
  evidence_level: "repository_backed" | "paper_only";
  question_sha256: string;
  paper: {
    title: string;
    sha256: string;
    provider?: string;
    doi?: string;
    pmid?: string;
    pmcid?: string;
  };
  repository?: {
    url: string;
    source_commit?: string;
    files: Array<{ path: string; sha256: string; chars: number }>;
  };
  context: {
    paper_sha256: string;
    repository_sha256: string;
    connection_sha256: string;
    reproduction_plan_sha256: string;
  };
}

function compact(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(compact).filter(Boolean))];
}

function terms(value: unknown): string[] {
  return [...new Set(strings(value).map((item) => item.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]+/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "")).filter(Boolean))];
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function inferredKind(value: unknown): RecipeKind {
  const kind = String(value || "");
  return ["analysis", "preprocess", "visualization", "validation", "reference"].includes(kind) ? kind as RecipeKind : "analysis";
}

export function buildRagRecipeCard(input: {
  authored: Json;
  question: string;
  evidenceLevel: "repository_backed" | "paper_only";
  repositoryUrl?: string;
  sourceCommit?: string;
}): RecipeCard {
  const authoredCard = input.authored.recipe_card && typeof input.authored.recipe_card === "object" ? input.authored.recipe_card as Json : {};
  const summary = compact(authoredCard.summary || input.authored.description || `Evidence-backed analysis Recipe for ${input.question}`);
  const aliases = strings(authoredCard.aliases || input.authored.triggers);
  const semantic = inferSemanticTerms([summary, input.question, ...aliases, ...strings(input.authored.tags)].join(" "));
  const accepted = authoredCard.accepts && typeof authoredCard.accepts === "object" ? authoredCard.accepts as Json : {};
  const kind = input.evidenceLevel === "paper_only" ? "reference" : inferredKind(authoredCard.kind);
  return {
    schema_version: 1,
    recipe_id: compact(authoredCard.recipe_id || input.authored.name || "repository-recipe"),
    version: compact(authoredCard.version || "0.1.0"),
    status: "candidate",
    kind,
    summary,
    aliases,
    does: kind === "reference" ? [] : terms(authoredCard.does).length ? terms(authoredCard.does) : semantic,
    evidence_for: kind === "reference" ? [] : terms(authoredCard.evidence_for),
    accepts: {
      species: terms(accepted.species),
      modalities: terms(accepted.modalities),
      observation_units: terms(accepted.observation_units || accepted.observation_unit),
      requires: terms(accepted.requires),
    },
    produces: kind === "reference" ? [] : terms(authoredCard.produces),
    use_when: strings(authoredCard.use_when || input.authored.triggers),
    avoid_when: strings(authoredCard.avoid_when),
    source: {
      type: "rag",
      evidence_refs: input.evidenceLevel === "repository_backed"
        ? ["references/evidence_manifest.json", "references/matched_paper_context.md", "references/matched_repo_context.md"]
        : ["references/evidence_manifest.json", "references/paper_context.md"],
      ...(input.repositoryUrl ? { repository_url: input.repositoryUrl } : {}),
      ...(input.sourceCommit ? { source_commit: input.sourceCommit } : {}),
    },
    quality: { passed_runs: 0, recipe_attributed_failures: 0 },
  };
}

function instancePathLeakage(text: string): string[] {
  const matches = text.match(/(?:\/mnt\/|\/home\/|\/Users\/|[A-Za-z]:\\)[^\s`'"),;]*/g) || [];
  return [...new Set(matches)].slice(0, 10);
}

function procedural(text: string): boolean {
  return /(?:^|\n)##\s+(?:Procedure|Workflow|Adaptation workflow)\b/i.test(text) || /(?:^|\n)\s*\d+[.)]\s+\S/m.test(text);
}

export function hasExecutablePython(text: string): boolean {
  const withoutComments = text.split("\n").filter((line) => !/^\s*(?:#|$)/.test(line)).join("\n");
  return /\b(?:def|class|import|from|if|for|while|with|return|print|raise)\b/.test(withoutComments);
}

async function pythonSyntax(script: string, env: NodeJS.ProcessEnv): Promise<{ status: RecipeDraftQualityGate["checks"]["script_syntax"]; error?: string }> {
  if (!script.trim() || !hasExecutablePython(script)) return { status: "not_applicable" };
  return await new Promise((done) => {
    const child = spawn(resolvePythonCommand(env), ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], { env: pythonProcessEnvironment(env), stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-2000); });
    child.on("error", () => done({ status: "unavailable" }));
    child.on("close", (code) => done(code === 0 ? { status: "passed" } : { status: "failed", error: stderr.trim() || "python syntax validation failed" }));
    child.stdin.end(script);
  });
}

export async function evaluateRecipeDraft(input: {
  card: RecipeCard;
  skillBody: string;
  analysisScript: string;
  utilityScript?: string;
  evidenceLevel: "repository_backed" | "paper_only";
  paperText: string;
  matchedFiles: Array<{ path: string; content: string }>;
}, env: NodeJS.ProcessEnv = process.env): Promise<RecipeDraftQualityGate> {
  const cardValidation = validateRecipeCard(input.card);
  const blocking = [...cardValidation.issues];
  const warnings = [...cardValidation.warnings];
  if (input.evidenceLevel === "repository_backed" && input.card.kind !== "reference" && !input.card.does.length) blocking.push("repository-backed RecipeCard must declare at least one scientific capability in does");
  const hasEvidence = Boolean(input.paperText.trim()) && (input.evidenceLevel === "paper_only" || input.matchedFiles.length > 0);
  if (!hasEvidence) blocking.push(input.evidenceLevel === "repository_backed" ? "repository-backed Recipe has no selected repository evidence" : "paper-only Recipe has no paper evidence");
  const hasProcedure = procedural(input.skillBody);
  if (input.card.kind !== "reference" && !hasProcedure) blocking.push("Recipe body has no explicit procedural workflow");
  const leakedPaths = instancePathLeakage(`${input.skillBody}\n${input.analysisScript}\n${input.utilityScript || ""}\n${JSON.stringify(input.card)}`);
  if (leakedPaths.length) blocking.push(`task-instance absolute paths are not reusable: ${leakedPaths.join(", ")}`);
  const namedScripts = [["analysis_script", input.analysisScript], ["utility_script", input.utilityScript || ""]] as const;
  const syntaxResults = await Promise.all(namedScripts.map(async ([name, script]) => ({ name, script, ...(await pythonSyntax(script, env)) })));
  const failed = syntaxResults.find((result) => result.status === "failed");
  const unavailable = syntaxResults.some((result) => result.status === "unavailable");
  const checked = syntaxResults.some((result) => result.status === "passed");
  const syntaxStatus: RecipeDraftQualityGate["checks"]["script_syntax"] = failed ? "failed" : unavailable ? "unavailable" : checked ? "passed" : "not_applicable";
  if (failed) blocking.push(`${failed.name} failed syntax validation: ${failed.error || "invalid Python"}`);
  if (unavailable) warnings.push("Python was unavailable; script syntax was not checked. Set SEEKBRAIN_PYTHON to a working interpreter.");
  for (const result of syntaxResults) if (result.script.trim() && !hasExecutablePython(result.script)) warnings.push(`${result.name} contains no executable Python statements and will not be installed as a script`);
  return {
    schema_version: 1,
    passed: blocking.length === 0,
    blocking_issues: blocking,
    warnings,
    checks: {
      structured_contract: cardValidation.ok,
      procedural_content: hasProcedure,
      evidence_available: hasEvidence,
      no_instance_path_leakage: leakedPaths.length === 0,
      script_syntax: syntaxStatus,
    },
    checked_at: new Date().toISOString(),
  };
}

export function buildEvidenceManifest(input: {
  question: string;
  title: string;
  paperText: string;
  provider?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  evidenceLevel: "repository_backed" | "paper_only";
  repositoryUrl?: string;
  sourceCommit?: string;
  matchedFiles: Array<{ path: string; content: string }>;
  matchedPaperContext: string;
  matchedRepoContext: string;
  connectionAnalysis: string;
  reproductionPlan: string;
}): RecipeEvidenceManifest {
  return {
    schema_version: 1,
    evidence_level: input.evidenceLevel,
    question_sha256: sha(input.question),
    paper: {
      title: input.title,
      sha256: sha(input.paperText),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.doi ? { doi: input.doi } : {}),
      ...(input.pmid ? { pmid: input.pmid } : {}),
      ...(input.pmcid ? { pmcid: input.pmcid } : {}),
    },
    ...(input.repositoryUrl ? {
      repository: {
        url: input.repositoryUrl,
        ...(input.sourceCommit ? { source_commit: input.sourceCommit } : {}),
        files: input.matchedFiles.map((file) => ({ path: file.path, sha256: sha(file.content), chars: file.content.length })),
      },
    } : {}),
    context: {
      paper_sha256: sha(input.matchedPaperContext),
      repository_sha256: sha(input.matchedRepoContext),
      connection_sha256: sha(input.connectionAnalysis),
      reproduction_plan_sha256: sha(input.reproductionPlan),
    },
  };
}
