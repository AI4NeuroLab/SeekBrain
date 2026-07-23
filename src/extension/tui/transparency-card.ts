import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Box, Markdown } from "@earendil-works/pi-tui";

export interface TransparencyCardData {
  content: string;
  run_id?: string;
  tool?: string;
  timestamp: number;
}

export const RESEARCH_CARD_ENTRY = "seekbrain-research-card";
export const SKILL_CARD_ENTRY = "seekbrain-skill-card";

interface TransparencyRendererAPI {
  registerEntryRenderer?: (type: string, renderer: (entry: any, options: any, theme: any) => any) => void;
}

export function registerTransparencyCardRenderers(pi: TransparencyRendererAPI): void {
  if (typeof pi.registerEntryRenderer !== "function") return;
  for (const type of [RESEARCH_CARD_ENTRY, SKILL_CARD_ENTRY]) {
    pi.registerEntryRenderer(type, (entry, _options, theme) => {
      const data = entry.data as TransparencyCardData | undefined;
      if (!data?.content) return undefined;
      const box = new Box(1, 1, (text: string) => theme.bg("customMessageBg", text));
      box.addChild(new Markdown(data.content, 0, 0, getMarkdownTheme()));
      return box;
    });
  }
}
