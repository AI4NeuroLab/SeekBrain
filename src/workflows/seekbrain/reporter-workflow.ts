import { dirname, extname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { WorkflowJson } from "./run-lifecycle.ts";

export interface ReporterWorkflowDependencies {
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    images: WorkflowJson[];
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  loadImages(paths: string[]): Promise<{ images: WorkflowJson[]; warnings: string[]; loaded_paths?: string[] }>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  writeText(path: string, value: string): Promise<void>;
  exportPdf?(input: {
    markdownPath: string;
    pdfPath: string;
    command?: string;
    timeoutSeconds?: number;
    signal?: AbortSignal;
  }): Promise<WorkflowJson>;
}

export interface GenerateReportInput {
  evidenceBundlePath: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  signal?: AbortSignal;
  onProgress?: (progress: WorkflowJson) => void;
  pdf?: { enabled?: boolean; command?: string; timeout_seconds?: number };
}

export class ReporterWorkflow {
  constructor(readonly dependencies: ReporterWorkflowDependencies) {}

  async execute(input: GenerateReportInput): Promise<WorkflowJson> {
    input.onProgress?.({ stage: "loading_evidence", message: "Loading selected evidence" });
    const bundlePath = resolve(input.evidenceBundlePath);
    const reportDir = dirname(bundlePath);
    let bundle: WorkflowJson;
    try {
      bundle = JSON.parse(await readFile(bundlePath, "utf8")) as WorkflowJson;
    } catch (error) {
      throw new Error(`Unable to read evidence bundle '${bundlePath}': ${String(error)}`);
    }
    if (bundle.schema_version !== 1 || bundle.selection_authoritative !== true || !Array.isArray(bundle.evidence) || !bundle.evidence.length) {
      throw new Error("Reporter requires a non-empty authoritative evidence bundle produced by ReportEvidenceCompiler.");
    }
    const figures = bundle.evidence.flatMap((item: WorkflowJson) => Array.isArray(item.figures) ? item.figures : []);
    const supportedImages = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    const imagePaths = figures.map((figure: WorkflowJson) => String(figure.asset_path || ""))
      .filter((path: string) => supportedImages.has(extname(path).toLowerCase()));
    input.onProgress?.({ stage: "loading_figures", message: `Loading ${imagePaths.length} report figure${imagePaths.length === 1 ? "" : "s"}`, figure_count: imagePaths.length });
    const vision = imagePaths.length ? await this.dependencies.loadImages(imagePaths) : { images: [], warnings: [], loaded_paths: [] };
    const loadedPaths = vision.loaded_paths || imagePaths.slice(0, vision.images.length);
    const attachedIndexes = new Map(loadedPaths.map((path, index) => [path, index + 1]));
    const figureCatalog = figures.map((figure: WorkflowJson) => ({
      figure_id: figure.figure_id,
      figure_number: figure.figure_number,
      relative_path: figure.relative_path,
      description: figure.description,
      attached_image_index: attachedIndexes.get(String(figure.asset_path || "")) || null,
      supplemental_assets: figure.supplemental_assets || [],
    }));
    const selectedEvidence = bundle.evidence.map((item: WorkflowJson) => ({
      evidence_id: item.evidence_id,
      source_type: item.source_type,
      question: item.question,
      scientific_context: item.scientific_context,
      plan: { summary: item.plan?.summary || "" },
      validation: item.validation,
      interpretation: item.interpretation,
      statistics: item.statistics,
      data_artifacts: item.data_artifacts,
      table_paths: item.table_paths,
      figures: item.figures,
    }));
    const prompt = [
      input.rolePrompt.trim(),
      "",
      "You are the isolated SeekBrain Reporter. Return only by calling finalize_seekbrain_report.",
      "Each key claim must use evidence_ids: string[] and figure_refs: {figure_id, panels: string[]}[]. Use arrays even when a claim has only one source. Do not join identifiers with semicolons.",
      "",
      `Report goal:\n${String(bundle.report_goal || "Synthesize the selected findings.")}`,
      `Selected evidence IDs:\n${bundle.evidence.map((item: WorkflowJson) => `- ${item.evidence_id}`).join("\n")}`,
      `Figure catalog:\n${JSON.stringify(figureCatalog, null, 2)}`,
      `Authoritative selected evidence:\n${JSON.stringify(selectedEvidence, null, 2)}`,
      vision.warnings.length ? `Image loading warnings:\n${vision.warnings.join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
    input.onProgress?.({ stage: "generating", message: "Synthesizing the scientific report", selected_count: bundle.evidence.length, figure_count: figures.length });
    const agent = await this.dependencies.runAgent({
      runDir: reportDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      images: vision.images,
      signal: input.signal,
    });
    if (!agent.ok || !agent.result) {
      const error = agent.error || "Reporter did not finalize.";
      const errorPath = join(reportDir, "report_error.json");
      await this.dependencies.writeJson(errorPath, {
        schema_version: 1,
        phase: "model_generation",
        error,
        finalize_called: false,
        evidence_bundle_path: bundlePath,
        requested_image_paths: imagePaths,
        loaded_image_paths: loadedPaths,
        image_warnings: vision.warnings,
        failed_at: new Date().toISOString(),
      });
      return { ok: false, error, error_path: errorPath, evidence_bundle_path: bundlePath, report_dir: reportDir };
    }
    input.onProgress?.({ stage: "validating", message: "Validating report provenance" });
    const knownEvidence = new Set(bundle.evidence.map((item: WorkflowJson) => String(item.evidence_id)));
    const knownFigures = new Set(figures.map((item: WorkflowJson) => String(item.figure_id)));
    const keyClaims = Array.isArray(agent.result.key_claims) ? agent.result.key_claims : [];
    const invalidClaims = keyClaims.filter((claim: WorkflowJson) =>
      !Array.isArray(claim.evidence_ids)
      || !claim.evidence_ids.length
      || claim.evidence_ids.some((evidenceId: string) => !knownEvidence.has(evidenceId))
      || !Array.isArray(claim.figure_refs)
      || claim.figure_refs.some((reference: WorkflowJson) =>
        !reference || !knownFigures.has(String(reference.figure_id)) || !Array.isArray(reference.panels)));
    if (invalidClaims.length) {
      const errorPath = join(reportDir, "report_error.json");
      await this.dependencies.writeJson(errorPath, {
        schema_version: 1,
        phase: "provenance_validation",
        error: "Reporter produced an invalid evidence_ids or figure_refs provenance reference.",
        finalize_called: true,
        invalid_claims: invalidClaims,
        evidence_bundle_path: bundlePath,
        failed_at: new Date().toISOString(),
      });
      return {
        ok: false,
        error: "Reporter produced an invalid evidence_ids or figure_refs provenance reference.",
        invalid_claims: invalidClaims,
        error_path: errorPath,
        evidence_bundle_path: bundlePath,
        report_dir: reportDir,
      };
    }
    const reportPath = join(reportDir, "report.md");
    const pdfPath = join(reportDir, "report.pdf");
    const reportJsonPath = join(reportDir, "report.json");
    input.onProgress?.({ stage: "writing", message: "Writing report artifacts" });
    await this.dependencies.writeText(reportPath, String(agent.result.report_markdown || ""));
    let pdf: WorkflowJson = {
      ok: false,
      skipped: true,
      reason: "disabled_by_user_config",
      error: "PDF export is disabled by configuration.",
    };
    if (input.pdf?.enabled === true) {
      input.onProgress?.({ stage: "exporting_pdf", message: "Exporting report PDF" });
      try {
        pdf = this.dependencies.exportPdf
          ? await this.dependencies.exportPdf({
              markdownPath: reportPath,
              pdfPath,
              command: input.pdf.command,
              timeoutSeconds: input.pdf.timeout_seconds,
              signal: input.signal,
            })
          : { ok: false, error: "PDF export dependency is unavailable." };
      } catch (error) {
        pdf = { ok: false, error: `PDF export failed: ${String(error)}` };
      }
    }
    const reportJson = {
      ...agent.result,
      key_claims: keyClaims,
      selected_evidence_ids: [...knownEvidence],
      evidence_bundle_path: bundlePath,
      pdf,
      generated_at: new Date().toISOString(),
    };
    await this.dependencies.writeJson(reportJsonPath, reportJson);
    return {
      ok: true,
      report_dir: reportDir,
      report_path: reportPath,
      report_json_path: reportJsonPath,
      evidence_bundle_path: bundlePath,
      selected_count: knownEvidence.size,
      figure_count: figures.length,
      title: agent.result.title,
      abstract: agent.result.abstract,
      limitations: agent.result.limitations || [],
      pdf_generated: pdf.ok === true,
      pdf_path: pdf.ok === true ? pdfPath : undefined,
      pdf_note: pdf.ok === true ? undefined : pdf.error,
    };
  }
}
