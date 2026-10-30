import { copyFile, mkdir, stat } from "node:fs/promises";
import { lexer } from "marked";
import { extname, join, resolve } from "node:path";
import { atomicWriteJson } from "../../core/index.ts";
import type { StudyReport } from "./contracts.ts";

type Json = Record<string, any>;
export const DEFAULT_REPORT_FORMAT = {
  abstract_sentences: 3, abstract_max_words: 70, main_min_words: 1000, main_max_words: 1500,
  no_main_headings: true, max_display_items: 3, max_references: 25,
};

/** The main agent can supply exact overrides; common plain-text limits also work directly. */
export function resolveReportFormat(request: string, overrides: Json = {}): typeof DEFAULT_REPORT_FORMAT {
  const format = { ...DEFAULT_REPORT_FORMAT };
  const value = (text: string) => Number(text.replaceAll(",", ""));
  const main = /main\s+text[^\n]{0,80}?(\d[\d,]*)\s*[-–—]\s*(\d[\d,]*)\s*words/i.exec(request);
  if (main) { format.main_min_words = value(main[1]); format.main_max_words = value(main[2]); }
  const abstract = /abstract[^\n]{0,100}?(\d+)\s+sentences?[^\n]{0,80}?(?:up\s+to|at\s+most|≤)\s*(\d+)\s*words/i.exec(request);
  if (abstract) { format.abstract_sentences = value(abstract[1]); format.abstract_max_words = value(abstract[2]); }
  const displays = /display\s+items?\s*[–—:-]?\s*(?:up\s+to|at\s+most|≤)\s*(\d+)/i.exec(request);
  const references = /references\s*[–—:-]?\s*(?:up\s+to|at\s+most|≤)\s*(\d+)/i.exec(request);
  if (displays) format.max_display_items = value(displays[1]);
  if (references) format.max_references = value(references[1]);
  for (const key of Object.keys(format)) if (overrides[key] !== undefined) (format as Json)[key] = overrides[key];
  if (format.main_min_words > format.main_max_words) throw new Error("Report minimum word count exceeds maximum");
  return format;
}

export function wordCount(text: string): number {
  return (text.replace(/\[@?[^\]]+\](?:\([^)]*\))?/g, "").replace(/[*_`#]/g, "").match(/[\p{L}\p{N}]+(?:[’'.\-][\p{L}\p{N}]+)*/gu) || []).length;
}

export function inspectReport(report: StudyReport, format: typeof DEFAULT_REPORT_FORMAT): Json {
  const words = wordCount(report.abstract), mainWords = wordCount(report.main_text);
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  const sentences = [...segmenter.segment(report.abstract)].filter(s => /[\p{L}\p{N}]/u.test(s.segment)).length;
  const issues: string[] = [];
  if (report.mode === "scientific_report") {
    if (sentences !== format.abstract_sentences) issues.push(`Abstract has ${sentences} sentences; expected ${format.abstract_sentences}`);
    if (words > format.abstract_max_words) issues.push(`Abstract has ${words} words; maximum ${format.abstract_max_words}`);
    if (/\[[^\]]+\]|https?:\/\/|\bdoi\s*:|\([A-Z][^)]{0,80}\b(?:19|20)\d{2}[a-z]?\)/.test(report.abstract)) issues.push("Abstract contains a reference");
    if (mainWords < format.main_min_words || mainWords > format.main_max_words) issues.push(`Main text has ${mainWords} words; expected ${format.main_min_words}–${format.main_max_words}`);
    if (format.no_main_headings && (lexer(report.main_text).some(token => token.type === "heading")
      || /(?:^|\n)\s*(?:(?:Introduction|Results|Discussion|Methods)\s*:?\s*(?:\n|$)|\*\*[^\n]+\*\*\s*(?:\n|$))/i.test(report.main_text))) issues.push("Main text contains a section heading");
  }
  if (report.display_items.length > format.max_display_items) issues.push(`Report has ${report.display_items.length} display items; maximum ${format.max_display_items}`);
  if (report.references.length > format.max_references) issues.push(`Report has ${report.references.length} references; maximum ${format.max_references}`);
  const citations = [...`${report.main_text}\n${report.display_items.map(d => d.caption).join("\n")}`.matchAll(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g)];
  for (const match of citations) for (const number of match[1].match(/\d+/g) || []) {
    if (Number(number) < 1 || Number(number) > report.references.length) issues.push(`Unknown bibliography number [${number}]`);
  }
  return { passed: !issues.length, mode: report.mode, abstract_sentences: sentences, abstract_words: words, main_words: mainWords,
    display_items: report.display_items.length, references: report.references.length, limits: format, issues };
}

/** Copy figures and small supporting files so a report never follows later task edits. */
export async function freezeReportArtifacts(bundle: Json, reportDir: string): Promise<void> {
  for (const evidence of bundle.evidence) {
    const artifactDir = join(reportDir, "artifacts", evidence.evidence_id);
    await mkdir(artifactDir, { recursive: true });
    const stats = join(artifactDir, "statistics.json");
    await atomicWriteJson(stats, evidence.statistics);
    evidence.original_statistics_path = evidence.statistics_path;
    evidence.statistics_path = stats;
    const artifacts: Json[] = [];
    for (const [index, artifact] of evidence.artifacts.entries()) {
      const frozen = { ...artifact };
      if (["figure", "code", "table", "data", "statistics", "log"].includes(artifact.kind)) {
        try {
          const before = await stat(artifact.path);
          const original = evidence.file_fingerprints.find((f: Json) => f.path === artifact.path);
          if (!original || before.size !== original.size || before.mtimeMs !== original.mtime_ms) throw new Error("artifact changed since evidence capture");
          if (["table", "data", "log"].includes(artifact.kind) && before.size > 10 * 1024 * 1024) {
            frozen.frozen = false; frozen.supplementary_only = true; artifacts.push(frozen); continue;
          }
          if (artifact.kind === "statistics") frozen.path = stats;
          else {
            const path = join(artifactDir, `${index}${extname(artifact.path)}`);
            await copyFile(artifact.path, path);
            const after = await stat(artifact.path);
            if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error("artifact changed during capture");
            frozen.path = path;
          }
          frozen.original_path = artifact.path;
          frozen.frozen = true;
        } catch (error) {
          evidence.snapshot_warnings ||= [];
          evidence.snapshot_warnings.push(`Artifact excluded from report: ${artifact.path}: ${error}`);
          continue;
        }
      }
      artifacts.push(frozen);
    }
    evidence.artifacts = artifacts;
    evidence.code_files = artifacts.filter(a => a.kind === "code");
    evidence.exec_log_path = artifacts.find(a => a.kind === "log" && a.original_path === evidence.exec_log_path)?.path || evidence.exec_log_path;
  }
}

export function assembleReport(report: StudyReport, bundle: Json): { markdown: string; supplementary: string; selectedArtifacts: Json[] } {
  const eligible = new Map<string, Json>(bundle.evidence.map((e: Json) => [e.evidence_id, e]));
  if (report.used_evidence_ids.some(id => !eligible.has(id))) throw new Error("Report cites unknown or unvalidated task evidence");
  if (eligible.size && !report.used_evidence_ids.length) throw new Error("Report must identify the evidence it uses");
  if (!eligible.size && report.mode !== "progress_report") throw new Error("No validated results: report must be a progress report");
  const selectedArtifacts: Json[] = [];
  const displays = report.display_items.map((item, index) => {
    if (item.evidence_ids.some(id => !eligible.has(id) || !report.used_evidence_ids.includes(id))) throw new Error("Display cites unknown or unused task evidence");
    const label = `${item.kind === "figure" ? "Figure" : "Table"} ${index + 1}`;
    const paths = item.artifact_paths.map(requested => {
      const artifact = item.evidence_ids.flatMap(id => eligible.get(id)!.artifacts).find((a: Json) =>
        resolve(a.path) === resolve(requested) || a.original_path && resolve(a.original_path) === resolve(requested));
      if (!artifact) throw new Error(`Display uses an unavailable or unvalidated artifact: ${requested}`);
      if (artifact.supplementary_only) throw new Error("Large supporting files are supplementary; use frozen statistics for a core display");
      if (item.kind === "figure" && (artifact.kind !== "figure" || !/\.(png|jpe?g)$/i.test(artifact.path))) throw new Error("Core figures must use validated PNG/JPEG images");
      if (item.kind === "table" && !["table", "data", "statistics"].includes(artifact.kind)) throw new Error("Core table must cite a validated table/data/statistics artifact");
      selectedArtifacts.push({ ...artifact, display_item: index + 1, evidence_ids: item.evidence_ids });
      return artifact.path;
    });
    if (item.kind === "table" && !item.table_markdown?.trim()) throw new Error("A core table needs table_markdown");
    const content = item.kind === "table" ? item.table_markdown : paths.map((path, panel) => `![${label}${paths.length > 1 ? String.fromCharCode(97 + panel) : ""}](<${path}>)`).join("\n\n");
    return `${content}\n\n**${label}.** ${item.caption}`;
  });
  const refs = report.references.map((ref, index) => `${index + 1}. ${ref.citation} ${ref.source}`).join("\n");
  const markdown = [`# ${report.title.replaceAll("\n", " ")}`, "<!-- seekbrain:abstract -->", report.abstract,
    "<!-- seekbrain:main -->", report.main_text, "<!-- seekbrain:displays -->", ...displays,
    "<!-- seekbrain:references -->", refs ? `## References\n\n${refs}` : "", "<!-- seekbrain:end -->"].filter(Boolean).join("\n\n") + "\n";
  const selected = new Set(selectedArtifacts.map(a => a.path));
  const extra = bundle.evidence.flatMap((e: Json) => e.artifacts.filter((a: Json) => !selected.has(a.path)).map((a: Json) => `- ${e.evidence_id}: ${a.kind} — [${a.name || a.kind}](<${a.path}>)`));
  const coverage = bundle.coverage.filter((c: Json) => !c.included).map((c: Json) => `- ${c.task_id}: ${c.status}${c.reason ? ` — ${c.reason}` : ""}`);
  return { markdown, selectedArtifacts, supplementary: `# Supplementary materials\n\n${report.supplementary_text?.trim() ? `${report.supplementary_text.trim()}\n\n` : ""}## Supporting artifacts\n\n${extra.join("\n") || "No additional artifacts."}\n\n## Execution coverage\n\n${coverage.join("\n") || "All tasks included."}\n` };
}
