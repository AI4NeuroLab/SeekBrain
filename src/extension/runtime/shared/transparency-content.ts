import type { Json } from "../runtime-types.ts";

// --- transparency cards ---------------------------------------------------
// Pure markdown builders for the compact research/recipe panels. `pi.sendMessage`
// renders the returned string as themed markdown.
function researchCardMarkdown(state: Json): string {
  const research = state.deep_research;
  if (!research?.rounds) return "";
  const round = research.rounds.find((item: Json) => item.number === research.round);
  return [`## Deep Research · Round ${research.round}`, round?.decision?.reason || research.phase].filter(Boolean).join("\n");
}

function _parseSkillHeaders(targeted: string): { name: string; relevance?: string }[] {
  const out: { name: string; relevance?: string }[] = [];
  let m: RegExpExecArray | null;
  // Match the recipe-loader header while retaining compatibility with older SKILL headers.
  const re = /^\s*(?:RECIPE|SKILL)\s*:\s*(.+?)\s*(?:\(relevance:\s*([\d.]+)\))?\s*$/gm;
  while ((m = re.exec(targeted))) out.push({ name: m[1].trim(), relevance: m[2] });
  if (!out.length) {
    const re2 = /^###\s+(?:Recipe|Skill) from:\s*(.+)$/gim;
    while ((m = re2.exec(targeted))) out.push({ name: m[1].trim() });
  }
  return out;
}

function _skillOverview(targeted: string): string {
  const desc = targeted.match(/^\s*description:\s*["']?(.+?)["']?\s*$/im);
  if (desc && desc[1].trim()) return desc[1].trim();
  const ov = targeted.match(/##\s*Overview\s*\n+([^\n#].*)/i);
  if (ov && ov[1].trim()) return ov[1].trim();
  return "";
}

function _repositoryName(reference: Json): string {
  const url = String(reference?.repository_url || "").replace(/\/$/, "");
  if (url) return url.replace(/^https?:\/\/(?:www\.)?github\.com\//i, "");
  return String(reference?.repository_key || "").replace(/^github\.com\//i, "") || "repository";
}

function skillCardMarkdown(state: Json): string {
  const result = state.targeted_skill_result || {};
  const targeted = String(result.summary || state.targeted_skill || "");
  const source = String(result.source || (state.targeted_skill_path || targeted ? "existing_skill" : "none"));
  const label = source === "repository_reference" ? "repository method found"
    : source === "validated_repository_recipe" ? "validated repository recipe reused"
      : source === "method_pack" ? "scientific method pack assembled"
      : source === "composed_recipe_set" ? "composed from local and RAG candidates"
      : source === "generated_from_rag" || source === "crystallized" ? "crystallized from literature and code"
        : source === "existing_skill" || source === "repertoire" ? "retrieved from the Neuroscience Analysis Repertoire"
          : "no match";
  const lines = [`## 🧩 Analysis Recipe — ${label}`];
  if (!targeted.trim() || source === "none") {
    lines.push("", "_No matching analysis recipe was found for this question._");
    return lines.join("\n");
  }
  const repository = result.repository_reference || {};
  if (source === "method_pack") {
    const pack = result.method_pack || state.method_pack || {};
    if (pack.primary) lines.push(`- **Backbone:** ${String(pack.primary.title || "method")} (${String(pack.primary.transfer_level || "transferable")})`);
    if (pack.supporting) lines.push(`- **Supporting:** ${String(pack.supporting.title || "method")} (${String(pack.supporting.transfer_level || "transferable")})`);
    const constraints = Array.isArray(pack.downstream_constraints) ? pack.downstream_constraints : [];
    if (constraints.length) lines.push(`- **Preserved downstream constraints:** ${constraints.length}`);
    lines.push("", "_Repositories were inspected as temporary method evidence. Reusable Recipes crystallize only after successful execution and validation._");
    lines.push("", "→ `/seekbrain-show recipe` for the full MethodPack guidance");
    return lines.join("\n");
  }
  if (source === "repository_reference" || source === "validated_repository_recipe") {
    const name = _repositoryName(repository);
    const url = String(repository.repository_url || "");
    lines.push("", `- **Repository:** ${url ? `[${name}](${url})` : name}`);
    const files = Array.isArray(repository.reference_files) ? repository.reference_files : Array.isArray(result.reference_paths) ? result.reference_paths : [];
    if (files.length) lines.push(`- **Implementation reference:** ${files.slice(0, 2).map((path: unknown) => String(path).split(/[\\/]/).pop()).join(", ")}`);
    if (source === "repository_reference") lines.push("", "_Repository code is ready as implementation evidence; validated reusable scripts will be created only after successful execution and validation._");
    else lines.push("", "_Previously validated repository scripts are being reused directly._");
    lines.push("", "→ `/seekbrain-show recipe` for the full repository-backed method guidance");
    return lines.join("\n");
  }
  if (source === "composed_recipe_set") {
    const selected = Array.isArray(result.recipe_set?.selected) ? result.recipe_set.selected : [];
    for (const recipe of selected.slice(0, 4)) {
      lines.push(`- **${String(recipe.recipe_id || "Recipe")}** (${String(recipe.role || "supporting")})`);
    }
    const repositories = Array.isArray(result.repository_references) ? result.repository_references : [];
    if (repositories.length) lines.push("", `**Repository evidence:** ${repositories.slice(0, 3).map(_repositoryName).join(", ")}`);
    lines.push("", "→ `/seekbrain-show recipe` for the full composed Recipe set");
    return lines.join("\n");
  }
  for (const s of _parseSkillHeaders(targeted).slice(0, 4)) {
    lines.push(`- **${s.name}**${s.relevance ? ` (relevance ${s.relevance})` : ""}`);
  }
  const overview = _skillOverview(targeted);
  if (overview) lines.push("", overview.slice(0, 300));
  lines.push("", "→ `/seekbrain-show recipe` for the full recipe document (`SKILL.md`)");
  return lines.join("\n");
}


export { researchCardMarkdown, skillCardMarkdown };
