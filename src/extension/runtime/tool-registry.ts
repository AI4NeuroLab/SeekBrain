import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SeekBrainToolDefinition } from "./runtime-types.ts";

export const TOOL_REGISTRATION_ORDER = [
  "web_search", "fetch_content", "get_search_content",
  "seekbrain_literature_search", "seekbrain_paper_read", "seekbrain_system_check", "seekbrain_data_resolve", "seekbrain_research_start",
  "seekbrain_plan_generate", "seekbrain_formulation_generate", "seekbrain_execution_run",
  "seekbrain_report_evidence_compile", "seekbrain_report_generate", "seekbrain_research_decide", "seekbrain_run_resume",
] as const;

export function registerTools(pi: ExtensionAPI, definitions: SeekBrainToolDefinition[]) {
  const byName = new Map<string, SeekBrainToolDefinition>();
  for (const definition of definitions) {
    if (byName.has(definition.name)) {
      throw new Error(`Duplicate SeekBrain tool definition: ${definition.name}`);
    }
    byName.set(definition.name, definition);
  }

  const expected = new Set<string>(TOOL_REGISTRATION_ORDER);
  const unexpected = [...byName.keys()].filter((name) => !expected.has(name));
  if (unexpected.length) {
    throw new Error(`Unexpected SeekBrain tool definitions: ${unexpected.join(", ")}`);
  }

  for (const name of TOOL_REGISTRATION_ORDER) {
    const definition = byName.get(name);
    if (!definition) throw new Error(`Missing SeekBrain tool definition: ${name}`);
    pi.registerTool(definition);
  }
}
