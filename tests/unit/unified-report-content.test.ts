import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assembleReport, DEFAULT_REPORT_FORMAT, freezeReportArtifacts, inspectReport, resolveReportFormat, wordCount } from "../../src/workflows/unified/report-content.ts";
import { exportReportPdf } from "../../src/workflows/index.ts";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const report = (extra: any = {}): any => ({ mode: "scientific_report", title: "Donor measurements", abstract: "We measured donor values. The mean was 5.0 units. These data support a descriptive summary.",
  main_text: Array(1000).fill("measurement").join(" "), display_items: [], references: [], used_evidence_ids: ["a"], ...extra });
describe("unified report content and PDF", () => {
  it("counts abstract and continuous main text independently from legends and references", () => {
    const r = report({ display_items: [{ kind: "figure", artifact_paths: ["figure.png"], evidence_ids: ["a"], caption: Array(800).fill("legend").join(" ") }],
      references: [{ citation: "Actual source", source: "https://example.org/source" }] });
    expect(inspectReport(r, DEFAULT_REPORT_FORMAT)).toMatchObject({ passed: true, abstract_sentences: 3, main_words: 1000, display_items: 1, references: 1 });
    expect(wordCount("donor-level mean 5.0 [1]")).toBe(3);
  });
  it("reports heading, citation, word and display-count issues without an extra agent", () => {
    const checks = inspectReport(report({ abstract: "We measured donor values [1].", main_text: "Comparisons\n==========\n\nResults\n\nToo short.",
      display_items: Array(4).fill({ caption: "", artifact_paths: ["a"], evidence_ids: ["a"], kind: "figure" }),
      references: Array(26).fill({ citation: "source", source: "https://example.org" }) }), DEFAULT_REPORT_FORMAT);
    expect(checks.passed).toBe(false);
    expect(checks.issues.join("\n")).toMatch(/sentence|reference|heading|words|display/);
  });
  it("accepts normal plain-text limits and explicit overrides", () => {
    const f = resolveReportFormat("Abstract – 2 sentences, up to 50 words. Main text – 1,200–1,400 words. Display items – up to 2. References – up to 12.");
    expect(f).toMatchObject({ abstract_sentences: 2, abstract_max_words: 50, main_min_words: 1200, main_max_words: 1400, max_display_items: 2, max_references: 12 });
    expect(resolveReportFormat("", { main_min_words: 0, main_max_words: 500 }).main_max_words).toBe(500);
    expect(() => resolveReportFormat("", { main_min_words: 1500, main_max_words: 1000 })).toThrow(/minimum/);
  });
  it("requires an honest progress report with zero validated results and rejects invented artifacts", () => {
    const empty = { evidence: [], coverage: [] };
    expect(() => assembleReport(report({ used_evidence_ids: [] }), empty)).toThrow(/progress report/);
    expect(assembleReport(report({ mode: "progress_report", abstract: "", main_text: "No validated findings are available.", used_evidence_ids: [] }), empty).markdown).toContain("No validated findings");
    expect(() => assembleReport(report({ display_items: [{ kind: "figure", artifact_paths: ["invented.png"], evidence_ids: ["a"], caption: "Invented" }] }), { evidence: [{ evidence_id: "a", artifacts: [] }], coverage: [] })).toThrow(/unvalidated artifact/);
  });
  it("freezes a validated image and renders its actual bytes with Markdown and figure legends", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-real-report-")); dirs.push(cwd);
    const png = join(cwd, "figure.png");
    await writeFile(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAAQElEQVR4nO3PQQ0AIBDAMMC/50MEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oD2gUyKwM953EnbgAAAABJRU5ErkJggg==", "base64"));
    const details = await stat(png);
    const reportDir = join(cwd, "report"); await mkdir(reportDir);
    const bundle: any = { evidence: [{ evidence_id: "a", statistics: { mean: 5 }, statistics_path: join(cwd, "statistics.json"),
      artifacts: [{ name: "measurement", kind: "figure", path: png }], file_fingerprints: [{ path: png, size: details.size, mtime_ms: details.mtimeMs }] }], coverage: [] };
    await freezeReportArtifacts(bundle, reportDir);
    const assembled = assembleReport(report({ main_text: "The donor mean was 5 units.", display_items: [{ kind: "figure", artifact_paths: [png], evidence_ids: ["a"], caption: "Actual image supporting the measurement summary." }] }), bundle);
    const frozen = assembled.selectedArtifacts[0].path;
    await writeFile(png, "Changed after report capture");
    expect((await readFile(frozen)).subarray(1, 4).toString()).toBe("PNG");
    const md = join(reportDir, "report.md"), pdf = join(reportDir, "report.pdf");
    await writeFile(md, assembled.markdown);
    const result = await exportReportPdf({ markdownPath: md, pdfPath: pdf, style: "brief_communication" });
    expect(result).toMatchObject({ ok: true });
    const bytes = await readFile(pdf);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1")).toContain("/Subtype /Image");
    expect(assembled.markdown).toContain(frozen);
    expect(assembled.markdown).toContain("**Figure 1.**");
  });
});
