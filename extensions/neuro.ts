/**
 * NeuroScientist workflow selector.
 *
 * Commands:
 *   /neuro      — choose a NeuroScientist workflow level
 *
 * Usage: pi -e extensions/neuro.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { applyExtensionDefaults } from "./themeMap.ts";
import registerLevel1 from "./neuro/level1/index.ts";
import registerLevel2 from "./neuro/level2/index.ts";

type StageStatus = "pending" | "running" | "done" | "error";

interface StageState {
	name: string;
	status: StageStatus;
	elapsed: number;
	lastWork: string;
	startedAt?: number;
}

interface WorkflowDef {
	level: "level1" | "level2";
	label: string;
	description: string;
	promptPath: string;
	stages: string[];
	toolStages: Record<string, string>;
}

interface SubquestionCardState {
	index: number;
	status: StageStatus;
	subquestion: string;
	elapsed: number;
	lastWork: string;
	planDone: number;
	planTotal: number;
	startedAt?: number;
}

const EXT_DIR = dirname(fileURLToPath(import.meta.url));

const LEVEL1: WorkflowDef = {
	level: "level1",
	label: "Level 1",
	description: "Fixed NeuroScientist visualization and analysis workflow",
	promptPath: join(EXT_DIR, "neuro", "level1", "prompts", "entry.md"),
	stages: ["skill", "Plan", "Code", "Validate", "Analysis", "Conclude"],
	toolStages: {
		resolve_targeted_skill: "skill",
		neuro_plan: "Plan",
		neuro_code: "Code",
		neuro_validate: "Validate",
		neuro_refine_image: "Validate",
		neuro_analyze_image: "Analysis",
		neuro_conclude: "Conclude",
	},
};

const LEVEL2: WorkflowDef = {
	level: "level2",
	label: "Level 2",
	description: "Subquestion planning, SQ Level 1 execution, and evidence synthesis",
	promptPath: join(EXT_DIR, "neuro", "level2", "prompts", "entry.md"),
	stages: ["Input", "SubQ", "Methods", "Level1", "Evidence", "Report"],
	toolStages: {
		neuro_l2_ping: "Input",
		neuro_l2_start_run: "Input",
		neuro_l2_subquestion: "SubQ",
		neuro_l2_subquestion_review: "SubQ",
		neuro_l2_method_development: "Methods",
		neuro_l2_method_review: "Methods",
		neuro_l2_run_level1: "Level1",
		neuro_l2_subagent_conclusion: "Evidence",
		neuro_l2_subagent_conclusion_review: "Evidence",
		neuro_l2_question_conclusion: "Evidence",
		neuro_l2_paper_report: "Report",
		neuro_l2_export_report: "Report",
	},
};

const WORKFLOWS = [LEVEL1, LEVEL2];

function resetStages(workflow: WorkflowDef): StageState[] {
	return workflow.stages.map((name) => ({
		name,
		status: "pending" as const,
		elapsed: 0,
		lastWork: "",
	}));
}

function truncatePlain(value: string, max: number) {
	if (value.length <= max) return value;
	return value.slice(0, Math.max(0, max - 3)) + "...";
}

function renderCard(state: StageState, colWidth: number, theme: any): string[] {
	const w = colWidth - 2;
	const statusColor = state.status === "pending" ? "dim"
		: state.status === "running" ? "accent"
		: state.status === "done" ? "success" : "error";
	const statusIcon = state.status === "pending" ? "○"
		: state.status === "running" ? "●"
		: state.status === "done" ? "✓" : "✗";

	const name = truncatePlain(state.name, w);
	const nameStr = theme.fg("accent", theme.bold(name));
	const statusText = `${statusIcon} ${state.status}${state.status !== "pending" ? ` ${Math.round(state.elapsed / 1000)}s` : ""}`;
	const statusStr = theme.fg(statusColor, statusText);
	const work = state.lastWork ? truncatePlain(state.lastWork, Math.min(44, w)) : "-";
	const workStr = theme.fg(state.lastWork ? "muted" : "dim", work);

	const top = "┌" + "─".repeat(w) + "┐";
	const bottom = "└" + "─".repeat(w) + "┘";
	const border = (content: string, visible: number) =>
		theme.fg("dim", "│") + content + " ".repeat(Math.max(0, w - visible)) + theme.fg("dim", "│");

	return [
		theme.fg("dim", top),
		border(" " + nameStr, 1 + visibleWidth(name)),
		border(" " + statusStr, 1 + visibleWidth(statusText)),
		border(" " + workStr, 1 + visibleWidth(work)),
		theme.fg("dim", bottom),
	];
}

function blankCard(colWidth: number): string[] {
	return Array.from({ length: 5 }, () => " ".repeat(colWidth));
}

function padVisible(value: string, targetWidth: number) {
	return value + " ".repeat(Math.max(0, targetWidth - visibleWidth(value)));
}

function renderConnectorRow(colWidth: number, gapWidth: number, theme: any): string {
	const center = Math.max(0, Math.floor(colWidth / 2));
	return " ".repeat(center) + theme.fg("dim", "▼") + " ".repeat(Math.max(0, colWidth - center - 1))
		+ " ".repeat(gapWidth)
		+ " ".repeat(colWidth)
		+ " ".repeat(gapWidth)
		+ " ".repeat(colWidth);
}

function renderStageRow(
	rowStages: (StageState | undefined)[],
	colWidth: number,
	gapWidth: number,
	theme: any,
): string[] {
	const cards = rowStages.map((stage) => stage ? renderCard(stage, colWidth, theme) : blankCard(colWidth));
	const output: string[] = [];
	const arrowRow = 2;

	for (let line = 0; line < cards[0].length; line++) {
		let row = padVisible(cards[0][line], colWidth);
		for (let i = 1; i < cards.length; i++) {
			const hasConnector = Boolean(rowStages[i - 1] && rowStages[i]);
			row += line === arrowRow && hasConnector ? theme.fg("dim", " ──▶ ") : " ".repeat(gapWidth);
			row += padVisible(cards[i][line], colWidth);
		}
		output.push(row);
	}

	return output;
}

function stageByName(stages: StageState[], name: string) {
	return stages.find((stage) => stage.name === name);
}

function renderPipeline(stages: StageState[], width: number, theme: any): string {
	const parts = stages.map((stage) => {
		const icon = stage.status === "pending" ? "○"
			: stage.status === "running" ? "●"
			: stage.status === "done" ? "✓" : "✗";
		const color = stage.status === "pending" ? "dim"
			: stage.status === "running" ? "accent"
			: stage.status === "done" ? "success" : "error";
		return theme.fg(color, `${icon} ${stage.name}`);
	});
	return truncateToWidth(parts.join(theme.fg("dim", "  →  ")), width);
}

function renderCompactPipeline(stages: StageState[], width: number, theme: any): string[] {
	const parts = stages.map((stage) => {
		const icon = stage.status === "pending" ? "○"
			: stage.status === "running" ? "●"
			: stage.status === "done" ? "✓" : "✗";
		const color = stage.status === "pending" ? "dim"
			: stage.status === "running" ? "accent"
			: stage.status === "done" ? "success" : "error";
		const elapsed = stage.status !== "pending" ? `${Math.round(stage.elapsed / 1000)}s` : "";
		const label = `${stage.name} ${icon}${elapsed}`;
		return theme.fg(color, label);
	});
	return [truncateToWidth(parts.join(theme.fg("dim", "  ")), width)];
}

function renderWorkflowGraph(stages: StageState[], width: number, theme: any): string[] {
	const gapWidth = 5;
	const colWidth = Math.max(14, Math.floor((width - gapWidth * 2) / 3));

	const rows = [
		...renderStageRow([stageByName(stages, "skill"), undefined, undefined], colWidth, gapWidth, theme),
		renderConnectorRow(colWidth, gapWidth, theme),
		...renderStageRow([
			stageByName(stages, "Research"),
			stageByName(stages, "Plan"),
			stageByName(stages, "Code"),
		], colWidth, gapWidth, theme),
		"",
		...renderStageRow([
			stageByName(stages, "validate"),
			stageByName(stages, "analysis"),
			stageByName(stages, "conclude"),
		], colWidth, gapWidth, theme),
	];

	return rows.map((row) => truncateToWidth(row, width));
}

function renderSubquestionCard(card: SubquestionCardState, colWidth: number, theme: any): string[] {
	const w = colWidth - 2;
	const statusColor = card.status === "pending" ? "dim"
		: card.status === "running" ? "accent"
		: card.status === "done" ? "success" : "error";
	const statusIcon = card.status === "pending" ? "○"
		: card.status === "running" ? "●"
		: card.status === "done" ? "✓" : "✗";
	const title = truncatePlain(`SubQ ${card.index}`, w - 1);
	const question = truncatePlain(card.subquestion || "waiting for subquestion", Math.max(8, w - 1));
	const elapsed = card.status !== "pending" ? ` ${Math.round(card.elapsed / 1000)}s` : "";
	const plans = card.planTotal ? `plans ${card.planDone}/${card.planTotal}` : "plans -";
	const work = truncatePlain(card.lastWork || "-", Math.max(8, w - 1));
	const border = (content: string, visible: number) =>
		theme.fg("dim", "│") + content + " ".repeat(Math.max(0, w - visible)) + theme.fg("dim", "│");

	return [
		theme.fg("dim", "┌" + "─".repeat(w) + "┐"),
		border(" " + theme.fg("accent", theme.bold(title)), 1 + visibleWidth(title)),
		border(" " + theme.fg(statusColor, `${statusIcon} ${card.status}${elapsed}`), 1 + visibleWidth(`${statusIcon} ${card.status}${elapsed}`)),
		border(" " + theme.fg("muted", question), 1 + visibleWidth(question)),
		border(" " + theme.fg("muted", plans), 1 + visibleWidth(plans)),
		border(" " + theme.fg(card.lastWork ? "muted" : "dim", work), 1 + visibleWidth(work)),
		theme.fg("dim", "└" + "─".repeat(w) + "┘"),
	];
}

function renderLevel2Board(stages: StageState[], cards: SubquestionCardState[], width: number, theme: any): string[] {
	const lines = [
		renderPipeline(stages, width, theme),
		"",
	];
	if (!cards.length) {
		return lines.map((row) => truncateToWidth(row, width));
	}

	const gapWidth = 4;
	const cols = width >= 120 ? 3 : width >= 78 ? 2 : 1;
	const colWidth = Math.max(24, Math.floor((width - gapWidth * (cols - 1)) / cols));
	for (let start = 0; start < cards.length; start += cols) {
		const rowCards = cards.slice(start, start + cols).map((card) => renderSubquestionCard(card, colWidth, theme));
		for (let line = 0; line < rowCards[0].length; line++) {
			let row = "";
			for (let i = 0; i < rowCards.length; i++) {
				if (i) row += " ".repeat(gapWidth);
				row += padVisible(rowCards[i][line], colWidth);
			}
			lines.push(row);
		}
		if (start + cols < cards.length) lines.push("");
	}
	return lines.map((row) => truncateToWidth(row, width));
}

function stageSummary(workflow: WorkflowDef, stages: StageState[]) {
	const done = stages.filter((stage) => stage.status === "done").length;
	const failed = stages.find((stage) => stage.status === "error");
	if (failed) return `${workflow.label}: ${failed.name} failed`;
	return `${workflow.label}: ${done}/${stages.length} stages`;
}

function promptText(workflow: WorkflowDef) {
	if (!existsSync(workflow.promptPath)) {
		return "You are the NeuroScientist workflow orchestrator. Use the registered neuro tools to run the active workflow.";
	}
	return readFileSync(workflow.promptPath, "utf8");
}

export default function (pi: ExtensionAPI) {
	registerLevel1(pi);
	registerLevel2(pi);

	let activeWorkflow: WorkflowDef | null = null;
	let stages: StageState[] = [];
	let subquestionCards: SubquestionCardState[] = [];
	let widgetCtx: any;

	function updateWidget() {
		if (!widgetCtx) return;

		widgetCtx.ui.setWidget("neuro-workflow", (_tui: any, theme: any) => {
			const text = new Text("", 0, 1);
			return {
				render(width: number): string[] {
					if (!activeWorkflow) {
						text.setText(theme.fg("dim", "No NeuroScientist workflow active. Use /neuro to select one."));
						return text.render(width);
					}

					const lines = activeWorkflow.level === "level2"
						? renderLevel2Board(stages, subquestionCards, width, theme)
						: renderCompactPipeline(stages, width, theme);
					text.setText(lines.join("\n"));
					return text.render(width);
				},
				invalidate() {
					text.invalidate();
				},
			};
		});
	}

	function activate(workflow: WorkflowDef, ctx: any) {
		activeWorkflow = workflow;
		stages = resetStages(workflow);
		subquestionCards = [];
		widgetCtx = ctx;
		updateWidget();
		ctx.ui.setStatus("neuro", `NeuroScientist: ${workflow.level}`);
		ctx.ui.notify(`NeuroScientist ${workflow.label}`, "info");
	}

	function setStageFromTool(toolName: string, status: StageStatus, detail = "") {
		if (!activeWorkflow) return;
		const stageName = activeWorkflow.toolStages[toolName];
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
		stage.lastWork = detail || toolName;
		updateWidget();
		if (widgetCtx && activeWorkflow) {
			widgetCtx.ui.setStatus("neuro", stageSummary(activeWorkflow, stages));
		}
	}

	function toolParams(event: any): any {
		return event.params || event.arguments || event.args || event.input || event.toolCall?.params || event.toolCall?.arguments || {};
	}

	function toolDetails(event: any): any {
		return event.result?.details || event.result || event.output?.details || event.output || {};
	}

	function cardByIndex(index: number, subquestion = "") {
		let card = subquestionCards.find((item) => item.index === index);
		if (!card) {
			card = {
				index,
				status: "pending",
				subquestion,
				elapsed: 0,
				lastWork: "",
				planDone: 0,
				planTotal: 0,
			};
			subquestionCards.push(card);
			subquestionCards.sort((a, b) => a.index - b.index);
		}
		if (subquestion && !card.subquestion) card.subquestion = subquestion;
		return card;
	}

	function cardBySubquestion(subquestion: string, fallbackIndex?: number) {
		const text = String(subquestion || "").trim();
		const existing = text ? subquestionCards.find((item) => item.subquestion === text) : undefined;
		if (existing) return existing;
		const index = typeof fallbackIndex === "number"
			? fallbackIndex
			: Math.max(0, ...subquestionCards.map((item) => item.index)) + 1;
		return cardByIndex(index, text);
	}

	function updateCard(card: SubquestionCardState, status: StageStatus, lastWork: string) {
		if (status === "running" && card.status !== "running") {
			card.startedAt = Date.now();
			card.elapsed = 0;
		} else if (card.startedAt) {
			card.elapsed = Date.now() - card.startedAt;
		}
		card.status = status;
		card.lastWork = lastWork;
		updateWidget();
	}

	function updateLevel2CardStart(toolName: string, event: any) {
		if (activeWorkflow?.level !== "level2") return;
		const params = toolParams(event);
		if (toolName === "neuro_l2_method_development" || toolName === "neuro_l2_method_review") {
			const card = cardBySubquestion(params.subquestion, params.subquestion_index);
			updateCard(card, "running", toolName === "neuro_l2_method_development" ? "designing methods" : "reviewing methods");
			return;
		}
		if (toolName === "neuro_l2_run_level1") {
			const card = cardByIndex(Number(params.subquestion_index || 0), params.subquestion || "");
			const planIndex = params.plan_index !== undefined ? `plan ${params.plan_index}` : "plan";
			updateCard(card, "running", `headless level1 ${planIndex}`);
			return;
		}
		if (toolName === "neuro_l2_subagent_conclusion" || toolName === "neuro_l2_subagent_conclusion_review") {
			const card = cardBySubquestion(params.subquestion, params.subquestion_index);
			updateCard(card, "running", toolName === "neuro_l2_subagent_conclusion" ? "synthesizing evidence" : "reviewing evidence");
		}
	}

	function updateLevel2CardEnd(toolName: string, event: any) {
		if (activeWorkflow?.level !== "level2") return;
		const details = toolDetails(event);
		const result = details.result || {};
		if (toolName === "neuro_l2_subquestion") {
			const items = Array.isArray(result.subquestion_texts) ? result.subquestion_texts : [];
			subquestionCards = items.map((item: string, idx: number) => ({
				index: idx + 1,
				status: "pending" as const,
				subquestion: String(item || ""),
				elapsed: 0,
				lastWork: "subquestion ready",
				planDone: 0,
				planTotal: 0,
			}));
			updateWidget();
			return;
		}
		if (toolName === "neuro_l2_method_development") {
			const card = cardBySubquestion(details.subquestion, details.subquestion_index);
			const plans = Array.isArray(result.analysis_plans) ? result.analysis_plans.length : 0;
			if (plans) card.planTotal = plans;
			updateCard(card, event.isError ? "error" : "running", event.isError ? "method design failed" : "methods ready");
			return;
		}
		if (toolName === "neuro_l2_method_review") {
			const card = cardBySubquestion(details.subquestion, details.subquestion_index);
			updateCard(card, event.isError ? "error" : "running", event.isError ? "method review failed" : "methods reviewed");
			return;
		}
		if (toolName === "neuro_l2_run_level1") {
			const card = cardByIndex(Number(details.subquestion_index || 0), details.subquestion || "");
			if (!event.isError && details.ok !== false) card.planDone += 1;
			if (details.plan_index !== undefined && card.planTotal < Number(details.plan_index)) {
				card.planTotal = Number(details.plan_index);
			}
			const done = card.planTotal > 0 && card.planDone >= card.planTotal;
			updateCard(card, event.isError || details.ok === false ? "error" : done ? "done" : "running", done ? "level1 complete" : "level1 plan complete");
			return;
		}
		if (toolName === "neuro_l2_subagent_conclusion" || toolName === "neuro_l2_subagent_conclusion_review") {
			const card = cardBySubquestion(details.subquestion, details.subquestion_index);
			updateCard(card, event.isError ? "error" : "done", event.isError ? "evidence failed" : "evidence complete");
		}
	}

	pi.registerCommand("neuro", {
		description: "Select NeuroScientist workflow level",
		handler: async (_args, ctx) => {
			const options = WORKFLOWS.map((workflow) => `${workflow.level} - ${workflow.description}`);
			const choice = await ctx.ui.select("Select NeuroScientist Level", options);
			if (choice === undefined) return;
			const selected = WORKFLOWS[options.indexOf(choice)];
			activate(selected, ctx);
		},
	});

	pi.on("tool_execution_start", async (event: any) => {
		const toolName = event.toolName || event.name;
		if (typeof toolName === "string") {
			setStageFromTool(toolName, "running", "running");
			updateLevel2CardStart(toolName, event);
		}
	});

	pi.on("tool_execution_end", async (event: any) => {
		const toolName = event.toolName || event.name;
		if (typeof toolName !== "string") return;
		const status = event.isError ? "error" : "done";
		setStageFromTool(toolName, status, event.isError ? "failed" : "complete");
		updateLevel2CardEnd(toolName, event);
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		widgetCtx = ctx;
		if (!activeWorkflow) return {};

		updateWidget();
		return {
			systemPrompt: [
				`You are running the active NeuroScientist workflow: ${activeWorkflow.label}.`,
				"Use the registered NeuroScientist tools to execute the workflow. Do not bypass state updates by editing state.json directly.",
				"After the user provides question, dataset, work_dir, or path information, follow the workflow instructions below.",
				"",
				promptText(activeWorkflow),
			].join("\n"),
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		widgetCtx = ctx;
		activeWorkflow = null;
		stages = [];
		subquestionCards = [];
		ctx.ui.setWidget("neuro-workflow", undefined);
		ctx.ui.notify("Use /neuro to select a NeuroScientist workflow.", "info");
	});
}
