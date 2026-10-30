import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

type MessageWithUsage = { usage?: { input?: number; output?: number; cost?: { total?: number } } };

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
export function formatTokens(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

function renderFooter(
  theme: any,
  width: number,
  model: string,
  contextPercent: number,
  inputTokens: number,
  outputTokens: number,
  costLabel: string,
  mode: string,
): string {
  const line = theme.fg("accent", ` ${mode} `) + theme.fg("dim", `| ${model}  `)
    + theme.fg("accent", `ctx ${contextPercent}%`)
    + theme.fg("dim", "  |  ")
    + theme.fg("success", `${formatTokens(inputTokens)} in`)
    + theme.fg("dim", " / ")
    + theme.fg("accent", `${formatTokens(outputTokens)} out`)
    + theme.fg("dim", "  |  ")
    + theme.fg("warning", costLabel)
    + theme.fg("dim", " ");
  return truncateToWidth(line, width, "");
}

export default function registerUsageFooter(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsubscribe = footerData.onBranchChange(() => tui.requestRender());
      return {
        dispose: unsubscribe,
        invalidate() {},
        render(width: number): string[] {
          let inputTokens = 0;
          let outputTokens = 0;
          let cost = 0;
          let costReported = false;
          for (const entry of ctx.sessionManager.getBranch()) {
            if (entry.type !== "message" || entry.message.role !== "assistant") continue;
            const message = entry.message as MessageWithUsage;
            inputTokens += finiteNumber(message.usage?.input);
            outputTokens += finiteNumber(message.usage?.output);
            if (message.usage?.cost?.total !== undefined) { cost += finiteNumber(message.usage.cost.total); costReported = true; }
          }
          const contextPercent = Math.max(0, Math.min(100, Math.round(finiteNumber(ctx.getContextUsage()?.percent))));
          const model = ctx.model?.id || "no-model";
          const costLabel = costReported ? `$${cost.toFixed(4)}` : "cost n/a";
          const mode = footerData.getExtensionStatuses().get("seekbrain-mode") || "Research";
          return [renderFooter(theme, width, model, contextPercent, inputTokens, outputTokens, costLabel, mode)];
        },
      };
    });
  });
}
