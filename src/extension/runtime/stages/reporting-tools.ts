import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ReportEvidenceCompiler } from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface ReportingToolDependencies {
  compiler: ReportEvidenceCompiler;
  generate(input: {
    projectPath: string;
    selectedEvidenceIds?: string[];
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
      label: "Compile Research Planning Report Evidence",
      description: "Compile selected completed Research Planning task rounds into an authoritative hierarchical evidence bundle without calling the Report Agent. Standard projects are rejected.",
      parameters: Type.Object({
        project_path: Type.String(),
        selected_evidence_ids: Type.Optional(Type.Array(Type.String())),
        report_goal: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        return deps.content(await deps.compiler.compile({ projectPath: params.project_path, selectedEvidenceIds: params.selected_evidence_ids, reportGoal: params.report_goal }));
      },
      renderResult: renderSeekBrainResult("seekbrain_report_evidence_compile"),
    }),
    defineTool({
      name: "seekbrain_report_generate",
      label: "Generate Research Planning Report",
      description: "On explicit user request, synthesize selected completed Research Planning task rounds and generate academic Markdown and PDF. Multiple rounds from one task are allowed and are treated as related analysis versions, not independent experiments.",
      parameters: Type.Object({
        project_path: Type.String(),
        selected_evidence_ids: Type.Optional(Type.Array(Type.String())),
        report_goal: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params, signal, onUpdate) {
        return deps.content(await deps.generate({
          projectPath: params.project_path,
          selectedEvidenceIds: params.selected_evidence_ids,
          reportGoal: params.report_goal,
          signal,
          onProgress: (progress) => onUpdate?.(deps.content({ progress: true, ...progress })),
        }));
      },
      renderResult: renderSeekBrainResult("seekbrain_report_generate"),
    }),
  ];
}
