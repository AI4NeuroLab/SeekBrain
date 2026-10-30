import type { InteractionMode } from "../mode-controller.ts";

interface PromptOptions {
  sections: Record<string, string>;
}
/** Update only SeekBrain's own sections; preserve Pi's tools, project context and skills. */
export function applyAssistantPrompt(options: PromptOptions, input: {
  common: string; research: string; mode: InteractionMode; context: string; nonInteractive?: boolean;
}): void {
  options.sections.seekbrain = input.common;
  options.sections.seekbrain_context = [input.context,
    input.nonInteractive ? "This is a non-interactive request. Complete its requested scope without routine approval. If essential information is missing, report the specific limitation; do not invent inputs or outputs." : "",
  ].filter(Boolean).join("\n\n");
  if (["research", "deep-research"].includes(input.mode)) options.sections.seekbrain_research = input.research;
  else delete options.sections.seekbrain_research;
}
