/**
 * SeekBrain's single public workflow entrypoint.
 *
 * Loaded automatically by the `seekbrain` CLI.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import registerSeekBrain from "./seekbrain-extension.ts";
import { applySeekBrainDefaults } from "./tui/extension-defaults.ts";
import { runPiSetupWizard } from "./tui/setup-wizard.ts";

export * from "./existing-pi-agent-adapter.ts";
export * from "./tool-adapter.ts";
export * from "./runtime-hooks.ts";
export * from "./commands/system-commands.ts";
export * from "./commands/show-command.ts";
export * from "./commands/save-skill-command.ts";
export * from "./commands/report-command.ts";
export * from "./tui/code-review-tui.ts";
export * from "./tui/review-selectors.ts";
export * from "./tui/transparency-card.ts";
export { default as registerSeekBrainTools } from "./seekbrain-extension.ts";

type StageStatus = "pending" | "running" | "done" | "error";

interface StageState {
	name: string;
	status: StageStatus;
	elapsed: number;
	lastWork: string;
	startedAt?: number;
}

const EXT_DIR = dirname(fileURLToPath(import.meta.url));
const ENTRY_PROMPT = join(EXT_DIR, "..", "..", "prompts", "entry.md");
const STAGE_NAMES = ["Skill", "Plan", "Code", "Validate", "Interpret"];
const TOOL_STAGES: Record<string, string> = {
	resolve_targeted_skill: "Skill",
	neuro_plan: "Plan",
	neuro_code: "Code",
	neuro_validate: "Validate",
	neuro_refine_image: "Validate",
	neuro_interpret: "Interpret",
};
const NEW_RUN_TOOLS = new Set([
	"neuro_start_research",
	"neuro_continue_research",
	"neuro_start_run",
]);

function resetStages(): StageState[] {
	return STAGE_NAMES.map((name) => ({ name, status: "pending", elapsed: 0, lastWork: "" }));
}

function promptText() {
	if (!existsSync(ENTRY_PROMPT)) {
		return "You are SeekBrain. Use the registered neuro tools to run the research workflow.";
	}
	return readFileSync(ENTRY_PROMPT, "utf8");
}

function renderPipeline(stages: StageState[], width: number, theme: any, roundLabel: string): string[] {
	const parts = stages.map((stage) => {
		const icon = stage.status === "pending" ? "○"
			: stage.status === "running" ? "●"
			: stage.status === "done" ? "✓" : "✗";
		const color = stage.status === "pending" ? "dim"
			: stage.status === "running" ? "accent"
			: stage.status === "done" ? "success" : "error";
		const elapsed = stage.status === "pending" ? "" : `${Math.round(stage.elapsed / 1000)}s`;
		return theme.fg(color, `${stage.name} ${icon}${elapsed}`);
	});
	const pipeline = parts.join(theme.fg("dim", "  "));
	if (!roundLabel) return [truncateToWidth(pipeline, width)];
	const round = theme.fg("accent", theme.bold(roundLabel));
	return [truncateToWidth(`${round}${theme.fg("dim", "  ───  ")}${pipeline}`, width)];
}

function summary(stages: StageState[]) {
	const failed = stages.find((stage) => stage.status === "error");
	if (failed) return `SeekBrain: ${failed.name} failed`;
	return `SeekBrain: ${stages.filter((stage) => stage.status === "done").length}/${stages.length} stages`;
}

function toolDetails(event: any): any {
	return event.result?.details || event.result || event.output?.details || event.output || {};
}

function researchRoundLabel(details: any) {
	const roundName = String(details?.round_name || details?.result?.round_name || "").trim();
	const roundMatch = /^round(\d+)$/i.exec(roundName);
	if (roundMatch) return `Round ${roundMatch[1]}`;
	const runId = String(details?.run_id || details?.result?.run_id || "").trim();
	const runMatch = /(?:^|[-_])round(\d+)$/i.exec(runId);
	return runMatch ? `Round ${runMatch[1]}` : roundName;
}

export default function registerSeekBrainEntry(pi: ExtensionAPI) {
	registerSeekBrain(pi);

	let stages = resetStages();
	let activeRoundLabel = "";
	let widgetCtx: any;
	let setupRunning = false;

	async function openSetup(ctx: any) {
		if (setupRunning) return;
		setupRunning = true;
		try {
			const result = await runPiSetupWizard(ctx);
			ctx.ui.notify(`Setup complete · Core: ${result.core.provider}/${result.core.model}`, "info");
			ctx.shutdown();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(message === "Setup cancelled" ? message : `Setup failed: ${message}`, message === "Setup cancelled" ? "warning" : "error");
			if (process.env.SEEKBRAIN_SETUP === "1") ctx.shutdown();
		} finally {
			setupRunning = false;
		}
	}

	function updateWidget() {
		if (!widgetCtx) return;
		widgetCtx.ui.setWidget("seekbrain-workflow", (_tui: any, theme: any) => {
			const text = new Text("", 0, 1);
			return {
				render(width: number): string[] {
					text.setText(renderPipeline(stages, width, theme, activeRoundLabel).join("\n"));
					return text.render(width);
				},
				invalidate() { text.invalidate(); },
			};
		});
	}

	function activate(ctx: any, notify = false) {
		widgetCtx = ctx;
		stages = resetStages();
		activeRoundLabel = "";
		updateWidget();
		ctx.ui.setStatus("seekbrain", summary(stages));
		if (notify) ctx.ui.notify("SeekBrain workflow ready", "info");
	}

	function setStageFromTool(toolName: string, status: StageStatus, detail: string) {
		const stageName = TOOL_STAGES[toolName];
		if (!stageName) return;
		const stage = stages.find((item) => item.name === stageName);
		if (!stage) return;
		if (status === "running") {
			stage.startedAt = Date.now();
			stage.elapsed = 0;
		} else if (stage.startedAt) {
			stage.elapsed = Date.now() - stage.startedAt;
		}
		stage.status = status;
		stage.lastWork = detail;
		updateWidget();
		widgetCtx?.ui.setStatus("seekbrain", summary(stages));
	}

	pi.registerCommand("seekbrain", {
		description: "Activate the SeekBrain research workflow",
		handler: async (_args, ctx) => activate(ctx, true),
	});

	pi.registerCommand("seekbrain-setup", {
		description: "Configure model APIs and choose Core/Fast models",
		handler: async (_args, ctx) => openSetup(ctx),
	});

	pi.on("tool_execution_start", async (event: any) => {
		const toolName = event.toolName || event.name;
		if (typeof toolName === "string") setStageFromTool(toolName, "running", "running");
	});

	pi.on("tool_execution_end", async (event: any) => {
		const toolName = event.toolName || event.name;
		if (typeof toolName !== "string") return;
		const details = toolDetails(event);
		if (NEW_RUN_TOOLS.has(toolName) && !event.isError && details.ok !== false) {
			stages = resetStages();
			const dataStage = stages.find((item) => item.name === "Data");
			if (dataStage) dataStage.status = "done";
			activeRoundLabel = researchRoundLabel(details);
			updateWidget();
		}
		setStageFromTool(toolName, event.isError ? "error" : "done", event.isError ? "failed" : "complete");
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		widgetCtx = ctx;
		updateWidget();
		return {
			systemPrompt: [
				"You are running SeekBrain's research workflow.",
				"Use the registered SeekBrain tools and never edit state.json directly.",
				"After the user provides the question, dataset, work_dir, or path, follow the workflow instructions below.",
				"",
				promptText(),
			].join("\n"),
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		applySeekBrainDefaults(ctx);
		activate(ctx);
		if (process.env.SEEKBRAIN_SETUP === "1") await openSetup(ctx);
	});
}
