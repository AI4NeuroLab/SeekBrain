import type { Json } from "../runtime-types.ts";

// --- transparency cards ---------------------------------------------------
// Pure markdown builders for the compact research/recipe panels. `pi.sendMessage`
// renders the returned string as themed markdown.
function _firstMeaningfulLine(text: string): string {
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line || line === "[Deep Research Background]") continue;
    if (/^#{1,6}\s/.test(line)) return line.replace(/^#{1,6}\s*/, "").trim();
    return line;
  }
  return "";
}

function _year(pubTime: any): string {
  const m = String(pubTime || "").match(/\d{4}/);
  return m ? m[0] : "";
}

function researchCardMarkdown(state: Json): string {
  const ctxText = String(state.deep_research_context || "");
  const sources: Json[] = Array.isArray(state.deep_research_sources) ? state.deep_research_sources : [];
  const summary = String(state.deep_research?.summary || "").trim() || _firstMeaningfulLine(ctxText);
  const lines = ["## 🔬 Deep Research"];
  if (summary) lines.push(summary.slice(0, 300));
  if (sources.length) {
    lines.push("", `**Sources (${sources.length}):**`);
    for (const s of sources.slice(0, 3)) {
      const title = String(s.title || "(untitled paper)").trim();
      const meta = [String(s.magazine || "").trim(), _year(s.pub_time)].filter(Boolean).join(" ");
      const gh = Array.isArray(s.github_links) && s.github_links[0] ? ` · [repo](${s.github_links[0]})` : "";
      lines.push(`- **${title}**${meta ? ` — ${meta}` : ""}${gh}`);
    }
    if (sources.length > 3) lines.push(`- …and ${sources.length - 3} more`);
  } else if (ctxText.trim()) {
    lines.push("", "_Background synthesized without external sources._");
  } else {
    lines.push("", "_Research ran but produced no usable background._");
  }
  lines.push("", "→ `/seekbrain-show research` for the full Deep Research background");
  return lines.join("\n");
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

function skillCardMarkdown(state: Json): string {
  const targeted = String(state.targeted_skill || "");
  const source = String(state.targeted_skill_result?.source || (targeted ? "existing_skill" : "none"));
  const label = source === "generated_from_rag" ? "crystallized from literature and code" : source === "existing_skill" ? "retrieved from the Neuroscience Analysis Repertoire" : "no match";
  const lines = [`## 🧩 Analysis Recipe — ${label}`];
  if (!targeted.trim() || source === "none") {
    lines.push("", "_No matching analysis recipe was found for this question._");
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
