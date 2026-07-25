import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ReportEvidenceCompiler } from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface ReportingToolDependencies {
  compiler: ReportEvidenceCompiler;
  generate(input: {
    projectPath: string;
    selectedEvidence: string[];
    reportGoal?: string;
    signal?: AbortSignal;
    onProgress?: (progress: Json) => void;
  }): Promise<Json>;
  content(details: Json): any;
}

export function createReportingTools(deps: ReportingToolDependencies): SeekBrainToolDefinition[] {
  return [
    defineTool({
      name: "seekbrain_report_evidence_compile",
      label: "Compile Report Evidence",
      description: "Compile an immutable report input bundle from exactly the completed rounds or Research Planning analysis-task rounds explicitly selected by the user. Does not call the Report Agent.",
      parameters: Type.Object({
        project_path: Type.String(),
        selected_evidence: Type.Array(Type.String({ description: "ROUND:<n> or <task-id>:R<n>, for example ROUND:3 or SQ1-T1:R2." }), { minItems: 1 }),
        report_goal: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        return deps.content(await deps.compiler.compile({
          projectPath: params.project_path,
          selectedEvidence: params.selected_evidence,
          reportGoal: params.report_goal,
        }));
      },
      renderResult: renderSeekBrainResult("seekbrain_report_evidence_compile"),
    }),
    defineTool({
      name: "seekbrain_report_generate",
      label: "Generate Report",
      description: "On explicit user request, compile exactly the selected completed rounds/task rounds and call the Report Agent once. Unselected evidence is not loaded into the Report Agent context.",
      parameters: Type.Object({
        project_path: Type.String(),
        selected_evidence: Type.Array(Type.String({ description: "ROUND:<n> or <task-id>:R<n>." }), { minItems: 1 }),
        report_goal: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params, signal, onUpdate) {
        return deps.content(await deps.generate({
          projectPath: params.project_path,
          selectedEvidence: params.selected_evidence,
          reportGoal: params.report_goal,
          signal,
          onProgress: (progress) => onUpdate?.(deps.content({ progress: true, ...progress })),
        }));
      },
      renderResult: renderSeekBrainResult("seekbrain_report_generate"),
    }),
  ];
}

