import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { capabilitiesResult, pingResult, type RunLifecycleWorkflow } from "../../../workflows/index.ts";
import { renderCapabilitiesResult, renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface SystemToolDependencies {
  lifecycle: RunLifecycleWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  content(details: Json): any;
}

export function createSystemTools(deps: SystemToolDependencies): SeekBrainToolDefinition[] {
  return [
    defineTool({
      name: "seekbrain_system_check",
      label: "Check Extension",
      description: "Verify that the project-local SeekBrain Pi extension is loaded. Does not create or modify runs.",
      parameters: Type.Object({}),
      async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
        const { runCount } = await deps.lifecycle.ping(ctx.cwd);
        return deps.content(pingResult(runCount));
      },
      renderResult: renderSeekBrainResult("seekbrain_system_check"),
    }),
    defineTool({
      name: "seekbrain_system_capabilities",
      label: "Show Capabilities",
      description: "Diagnostic tool that reports the complete SeekBrain workflow contract and current optional capabilities. Normal start, resume, and continuation calls already return the settings needed for that run; do not call this routinely.",
      parameters: Type.Object({}),
      async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        return deps.content(capabilitiesResult(config as any));
      },
      renderResult: renderCapabilitiesResult,
    }),
  ];
}

