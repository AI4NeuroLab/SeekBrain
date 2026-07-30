import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Type } from "typebox";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { WorkflowJson } from "./run-lifecycle.ts";

export interface ReporterWorkflowDependencies {
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    images?: WorkflowJson[];
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
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
  hierarchicalEvidencePath: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  signal?: AbortSignal;
  onProgress?: (progress: WorkflowJson) => void;
  pdf?: { enabled?: boolean; command?: string; timeout_seconds?: number };
}

const subquestionSchema = Type.Object({
  subquestion_id: Type.String(),
  conclusion: Type.String(),
  key_results: Type.Array(Type.Object({
    finding: Type.String(),
    evidence_ids: Type.Array(Type.String(), { minItems: 1 }),
    figure_refs: Type.Array(Type.String()),
    table_refs: Type.Array(Type.String()),
  })),
  supporting_evidence_ids: Type.Array(Type.String(), { minItems: 1 }),
  contradictions: Type.Array(Type.String()),
  limitations: Type.Array(Type.String()),
  figure_refs: Type.Array(Type.String()),
  table_refs: Type.Array(Type.String()),
});

const overallSchema = Type.Object({
  answer: Type.String(),
  integrated_findings: Type.Array(Type.Object({
    finding: Type.String(),
    subquestion_ids: Type.Array(Type.String(), { minItems: 1 }),
    evidence_ids: Type.Array(Type.String(), { minItems: 1 }),
    figure_refs: Type.Array(Type.String()),
    table_refs: Type.Array(Type.String()),
  })),
  agreements: Type.Array(Type.String()),
  disagreements: Type.Array(Type.String()),
  limitations: Type.Array(Type.String()),
  supporting_subquestion_ids: Type.Array(Type.String(), { minItems: 1 }),
  supporting_evidence_ids: Type.Array(Type.String(), { minItems: 1 }),
});

function agentError(agent: StageAgentResult, stage: string): Error {
  return new Error(agent.error || `${stage} did not finalize.`);
}

function idsWithin(values: unknown, known: Set<string>): boolean {
  return Array.isArray(values) && values.length > 0 && values.every((value) => known.has(String(value)));
}

function markdownStructureError(markdown: string): string | undefined {
  const lines = markdown.split(/\r?\n/);
  if (lines.filter((line) => /^#\s+\S/.test(line)).length !== 1) return "Report Markdown must contain exactly one top-level title.";
  const required = ["Abstract", "Introduction", "Results", "Discussion", "Limitations", "Conclusion"];
  let cursor = -1;
  for (const heading of required) {
    const index = lines.findIndex((line, lineIndex) => lineIndex > cursor && line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
    if (index < 0) return `Report Markdown is missing the required '${heading}' section or has sections out of order.`;
    cursor = index;
  }
  return undefined;
}

export class ReporterWorkflow {
  constructor(readonly dependencies: ReporterWorkflowDependencies) {}

  async execute(input: GenerateReportInput): Promise<WorkflowJson> {
    input.onProgress?.({ stage: "loading_evidence", message: "Loading hierarchical Research Planning evidence" });
    const hierarchyPath = resolve(input.hierarchicalEvidencePath);
    const reportDir = dirname(hierarchyPath);
    let hierarchy: WorkflowJson;
    try {
      hierarchy = JSON.parse(await readFile(hierarchyPath, "utf8")) as WorkflowJson;
    } catch (error) {
      throw new Error(`Unable to read hierarchical evidence '${hierarchyPath}': ${String(error)}`);
    }
    if (hierarchy.schema_version !== 2 || hierarchy.kind !== "research_planning_hierarchical_evidence" || hierarchy.selection_authoritative !== true) {
      throw new Error("Report Agent requires authoritative hierarchical evidence from a completed Research Planning project.");
    }
    const planEvidence = Array.isArray(hierarchy.plan_evidence) ? hierarchy.plan_evidence : [];
    const subquestions = Array.isArray(hierarchy.subquestions) ? hierarchy.subquestions : [];
    const figures = Array.isArray(hierarchy.figures) ? hierarchy.figures : [];
    const tables = Array.isArray(hierarchy.tables) ? hierarchy.tables : [];
    const selection = hierarchy.selection || {};
    const reportScope = String(selection.report_scope || "partial");
    const selectedTaskCount = new Set(planEvidence.map((item: WorkflowJson) => String(item.task_id || item.evidence_id))).size;
    if (!planEvidence.length || !subquestions.length) throw new Error("Hierarchical report evidence is empty.");

    input.onProgress?.({ stage: "subquestion_synthesis", message: `Synthesizing ${subquestions.length} sub-questions`, subquestion_count: subquestions.length });
    let subquestionConclusions: WorkflowJson[];
    try {
      subquestionConclusions = await Promise.all(subquestions.map(async (subquestion: WorkflowJson) => {
        const evidenceIds = new Set((Array.isArray(subquestion.evidence_ids) ? subquestion.evidence_ids : []).map(String));
        const evidence = planEvidence.filter((item: WorkflowJson) => evidenceIds.has(String(item.evidence_id)));
        const relevantFigures = figures.filter((item: WorkflowJson) => evidenceIds.has(String(item.evidence_id)));
        const relevantTables = tables.filter((item: WorkflowJson) => evidenceIds.has(String(item.evidence_id)));
        const prompt = [
          "You are SeekBrain's Report Agent in sub-question synthesis mode.",
          "Return only by calling finalize_seekbrain_report. Use only the supplied evidence. Preserve exact numeric values and cite terminal-task evidence IDs for every result. Do not write report prose yet.",
          "Evidence IDs with the same task_id but different round_number are analysis versions of one task, not independent experiments or biological replicates. Compare their convergence or disagreement without inflating evidence strength.",
          `Research goal:\n${String(hierarchy.research_goal || "")}`,
          `Sub-question contract:\n${JSON.stringify(subquestion, null, 2)}`,
          `Plan-level evidence:\n${JSON.stringify(evidence, null, 2)}`,
          `Figure registry:\n${JSON.stringify(relevantFigures, null, 2)}`,
          `Table registry:\n${JSON.stringify(relevantTables, null, 2)}`,
          "Finalize with: { subquestion_id, conclusion, key_results, supporting_evidence_ids, contradictions, limitations, figure_refs, table_refs }.",
        ].join("\n\n");
        const agent = await this.dependencies.runAgent({ runDir: reportDir, prompt, agentConfig: input.agentConfig, finalizeSchema: subquestionSchema, images: [], signal: input.signal });
        if (!agent.ok || !agent.result) throw agentError(agent, `Sub-question ${subquestion.id} synthesis`);
        if (String(agent.result.subquestion_id) !== String(subquestion.id) || !idsWithin(agent.result.supporting_evidence_ids, evidenceIds)) {
          throw new Error(`Sub-question ${subquestion.id} synthesis produced invalid evidence provenance.`);
        }
        return agent.result;
      }));
    } catch (error) {
      const errorPath = join(reportDir, "report_error.json");
      await this.dependencies.writeJson(errorPath, { schema_version: 1, phase: "subquestion_synthesis", error: String(error), hierarchical_evidence_path: hierarchyPath, failed_at: new Date().toISOString() });
      return { ok: false, error: String(error), error_path: errorPath, report_dir: reportDir };
    }

    input.onProgress?.({ stage: "overall_synthesis", message: "Synthesizing the overall scientific conclusion" });
    const knownEvidence = new Set(planEvidence.map((item: WorkflowJson) => String(item.evidence_id)));
    const knownSubquestions = new Set(subquestions.map((item: WorkflowJson) => String(item.id)));
    const overallPrompt = [
      "You are SeekBrain's Report Agent in overall synthesis mode.",
      "Return only by calling finalize_seekbrain_report. Integrate the sub-question conclusions into a direct answer to the original research goal. Use only supplied evidence IDs and distinguish agreements, disagreements, and limitations. Do not write the formatted report yet.",
      `Report coverage is ${reportScope}. If it is partial, explicitly limit the answer to the selected tasks and sub-questions rather than implying complete coverage of the Research Plan.`,
      `Research goal:\n${String(hierarchy.research_goal || "")}`,
      `Approved synthesis strategy:\n${String(hierarchy.synthesis_strategy || "")}`,
      `Sub-question conclusions:\n${JSON.stringify(subquestionConclusions, null, 2)}`,
      "Finalize with: { answer, integrated_findings, agreements, disagreements, limitations, supporting_subquestion_ids, supporting_evidence_ids }.",
    ].join("\n\n");
    const overallAgent = await this.dependencies.runAgent({ runDir: reportDir, prompt: overallPrompt, agentConfig: input.agentConfig, finalizeSchema: overallSchema, images: [], signal: input.signal });
    if (!overallAgent.ok || !overallAgent.result) {
      const error = overallAgent.error || "Overall synthesis did not finalize.";
      const errorPath = join(reportDir, "report_error.json");
      await this.dependencies.writeJson(errorPath, { schema_version: 1, phase: "overall_synthesis", error, hierarchical_evidence_path: hierarchyPath, failed_at: new Date().toISOString() });
      return { ok: false, error, error_path: errorPath, report_dir: reportDir };
    }
    if (!idsWithin(overallAgent.result.supporting_evidence_ids, knownEvidence) || !idsWithin(overallAgent.result.supporting_subquestion_ids, knownSubquestions)) {
      return { ok: false, error: "Overall synthesis produced invalid Research Planning provenance.", report_dir: reportDir };
    }

    hierarchy = {
      ...hierarchy,
      subquestion_conclusions: subquestionConclusions,
      overall_synthesis: overallAgent.result,
      synthesized_at: new Date().toISOString(),
    };
    await this.dependencies.writeJson(hierarchyPath, hierarchy);

    input.onProgress?.({ stage: "generating", message: "Writing the academic report from hierarchical evidence", task_count: planEvidence.length, figure_count: figures.length });
    const finalPrompt = [
      input.rolePrompt.trim(),
      "",
      "You are the isolated SeekBrain Report Agent. Return only by calling finalize_seekbrain_report.",
      "The hierarchy below is authoritative. Write the final academic report without reopening raw task outputs or inventing evidence.",
      "Format numerical results according to established academic reporting conventions for each statistic. Use only scientifically meaningful precision, avoid machine-precision decimal strings, and preserve values whose scale requires additional significant digits.",
      "Multiple selected rounds from one task are related analysis versions, not independent experiments. Describe robustness or disagreement across rounds without double-counting them.",
      `This is a ${reportScope} report. A partial report must state its selected coverage in the Abstract, Discussion, and Limitations.`,
      `Hierarchical scientific evidence:\n${JSON.stringify({
        research_goal: hierarchy.research_goal,
        report_goal: hierarchy.report_goal,
        selection,
        subquestions: hierarchy.subquestions,
        subquestion_conclusions: hierarchy.subquestion_conclusions,
        overall_synthesis: hierarchy.overall_synthesis,
        plan_evidence_index: planEvidence.map((item: WorkflowJson) => ({ evidence_id: item.evidence_id, subquestion_id: item.subquestion_id, task_id: item.task_id, round_number: item.round_number, summary: item.summary, limitations: item.limitations, source_paths: item.source_paths })),
        figures,
        tables,
        literature: hierarchy.literature,
      }, null, 2)}`,
    ].join("\n\n");
    const agent = await this.dependencies.runAgent({ runDir: reportDir, prompt: finalPrompt, agentConfig: input.agentConfig, finalizeSchema: input.finalizeSchema, images: [], signal: input.signal });
    if (!agent.ok || !agent.result) {
      const error = agent.error || "Report Agent did not finalize.";
      const errorPath = join(reportDir, "report_error.json");
      await this.dependencies.writeJson(errorPath, { schema_version: 1, phase: "report_generation", error, hierarchical_evidence_path: hierarchyPath, failed_at: new Date().toISOString() });
      return { ok: false, error, error_path: errorPath, hierarchical_evidence_path: hierarchyPath, report_dir: reportDir };
    }

    input.onProgress?.({ stage: "validating", message: "Validating report structure and provenance" });
    const knownFigures = new Set(figures.map((item: WorkflowJson) => String(item.figure_id)));
    const keyClaims = Array.isArray(agent.result.key_claims) ? agent.result.key_claims : [];
    const invalidClaims = keyClaims.filter((claim: WorkflowJson) =>
      !idsWithin(claim.evidence_ids, knownEvidence)
      || !Array.isArray(claim.figure_refs)
      || claim.figure_refs.some((reference: WorkflowJson) => !knownFigures.has(String(reference.figure_id)) || !Array.isArray(reference.panels)));
    const reportMarkdown = String(agent.result.report_markdown || "");
    const structureError = markdownStructureError(reportMarkdown);
    const markdownFigurePaths = [...reportMarkdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
    const knownRelativePaths = new Set(figures.map((item: WorkflowJson) => String(item.relative_path || "")));
    const unknownFigurePaths = markdownFigurePaths.filter((path) => !knownRelativePaths.has(path));
    const figureLegends = Array.isArray(agent.result.figure_legends) ? agent.result.figure_legends : [];
    const invalidLegends = figureLegends.filter((legend: WorkflowJson) => !knownFigures.has(String(legend.figure_id)));
    if (invalidClaims.length || invalidLegends.length || unknownFigurePaths.length || structureError) {
      const errorPath = join(reportDir, "report_error.json");
      const error = structureError || "Report Agent produced invalid evidence or figure provenance.";
      await this.dependencies.writeJson(errorPath, { schema_version: 1, phase: "report_validation", error, invalid_claims: invalidClaims, invalid_legends: invalidLegends, unknown_figure_paths: unknownFigurePaths, hierarchical_evidence_path: hierarchyPath, failed_at: new Date().toISOString() });
      return { ok: false, error, error_path: errorPath, hierarchical_evidence_path: hierarchyPath, report_dir: reportDir };
    }

    const reportPath = join(reportDir, "report.md");
    const pdfPath = join(reportDir, "report.pdf");
    const reportJsonPath = join(reportDir, "report.json");
    input.onProgress?.({ stage: "writing", message: "Writing report artifacts" });
    await this.dependencies.writeText(reportPath, reportMarkdown);
    let pdf: WorkflowJson = { ok: false, skipped: true, reason: "disabled_by_user_config", error: "PDF export is disabled by configuration." };
    if (input.pdf?.enabled === true) {
      input.onProgress?.({ stage: "exporting_pdf", message: "Rendering the Nature-style report PDF" });
      try {
        pdf = this.dependencies.exportPdf
          ? await this.dependencies.exportPdf({ markdownPath: reportPath, pdfPath, command: input.pdf.command, timeoutSeconds: input.pdf.timeout_seconds, signal: input.signal })
          : { ok: false, error: "Built-in PDF renderer is unavailable." };
      } catch (error) {
        pdf = { ok: false, error: `PDF export failed: ${String(error)}` };
      }
    }
    const reportJson = {
      ...agent.result,
      key_claims: keyClaims,
      hierarchical_evidence_path: hierarchyPath,
      selected_evidence_ids: [...knownEvidence],
      selected_subquestion_ids: [...knownSubquestions],
      selection,
      pdf,
      generated_at: new Date().toISOString(),
    };
    await this.dependencies.writeJson(reportJsonPath, reportJson);
    return {
      ok: true,
      report_dir: reportDir,
      report_path: reportPath,
      report_json_path: reportJsonPath,
      hierarchical_evidence_path: hierarchyPath,
      task_count: selectedTaskCount,
      round_count: planEvidence.length,
      subquestion_count: subquestions.length,
      figure_count: figures.length,
      table_count: tables.length,
      title: agent.result.title,
      abstract: agent.result.abstract,
      limitations: agent.result.limitations || [],
      report_scope: reportScope,
      selected_evidence_ids: [...knownEvidence],
      pdf_generated: pdf.ok === true,
      pdf_path: pdf.ok === true ? pdfPath : undefined,
      pdf_note: pdf.ok === true ? undefined : pdf.error,
    };
  }
}
