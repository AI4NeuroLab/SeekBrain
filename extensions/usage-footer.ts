/**
 * Lightweight session-usage footer for SeekBrain.
 *
 * Shows only: model, context usage, input/output tokens, and reported cost.
 * It does not change the theme/title or track tools, cwd, or Git state.
 *
 * Usage: pi -e extensions/usage-footer.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

type MessageWithUsage = {
	usage?: {
		input?: number;
		output?: number;
		cost?: { total?: number };
	};
};

function finiteNumber(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function formatTokens(value: number): string {
	if (value < 1_000) return String(value);
	if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}k`;
	return `${(value / 1_000_000).toFixed(1)}m`;
}

export default function (pi: ExtensionAPI) {
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
						if (message.usage?.cost?.total !== undefined) {
							cost += finiteNumber(message.usage.cost.total);
							costReported = true;
						}
					}

					const rawPercent = finiteNumber(ctx.getContextUsage()?.percent);
					const contextPercent = Math.max(0, Math.min(100, Math.round(rawPercent)));
					const model = ctx.model?.id || "no-model";
					const costText = costReported ? `$${cost.toFixed(4)}` : "cost n/a";
					const line =
						theme.fg("dim", ` ${model}  `) +
						theme.fg("accent", `ctx ${contextPercent}%`) +
						theme.fg("dim", "  |  ") +
						theme.fg("success", `${formatTokens(inputTokens)} in`) +
						theme.fg("dim", " / ") +
						theme.fg("accent", `${formatTokens(outputTokens)} out`) +
						theme.fg("dim", "  |  ") +
						theme.fg("warning", costText) +
						theme.fg("dim", " ");

					return [truncateToWidth(line, width, "")];
				},
			};
		});
	});
}
