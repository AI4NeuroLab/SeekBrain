import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	Box,
	CancellableLoader,
	Container,
	Input,
	Key,
	matchesKey,
	SelectList,
	SettingsList,
	Spacer,
	Text,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import {
	createSetupManager,
	literatureSourceOptions,
	validateLiteratureProvider,
} from "../../cli/setup.mjs";

type PrimaryModelReference = { provider: string; model: string };
type PrimaryModelChanged = (model: PrimaryModelReference) => Promise<void>;

export async function activateSetupPrimaryModel(
	pi: Pick<ExtensionAPI, "setModel">,
	ctx: Pick<ExtensionContext, "modelRegistry">,
	reference: PrimaryModelReference,
): Promise<void> {
	await ctx.modelRegistry.refresh({ allowNetwork: false, providers: [reference.provider] });
	const model = ctx.modelRegistry.find(reference.provider, reference.model);
	if (!model) throw new Error(`Model unavailable in this session: ${reference.provider}/${reference.model}`);
	if (!await pi.setModel(model)) throw new Error(`Authentication is not configured for ${reference.provider}/${reference.model}`);
}

type SetupSnapshot = any;
type SetupManager = any;
type SetupRow = {
	id: string;
	section: "providers" | "models" | "research";
	label: string;
	value: string;
	description: string;
	tone?: "accent" | "success" | "warning" | "error" | "muted" | "text";
};
type SelectOption = { value: string; label: string; description?: string };
type OperationResult<T> = { value?: T; error?: unknown; cancelled?: boolean };

const CARD_OVERLAY = {
	overlay: true,
	overlayOptions: { width: "82%" as const, maxHeight: "92%" as const, anchor: "center" as const, margin: 1 },
};

const DIALOG_OVERLAY = {
	overlay: true,
	overlayOptions: { width: "72%" as const, maxHeight: "86%" as const, anchor: "center" as const, margin: 1 },
};

function fit(text: string, width: number): string {
	if (width <= 0) return "";
	const clipped = truncateToWidth(text, width, "");
	return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

function framed(theme: any, lines: string[], width: number): string[] {
	if (width <= 2) return lines.map((line) => truncateToWidth(line, Math.max(1, width), ""));
	const bodyWidth = width - 2;
	const horizontal = "─".repeat(bodyWidth);
	const border = (value: string) => theme.fg("border", value);
	return [
		border(`╭${horizontal}╮`),
		...lines.map((line) => `${border("│")}${fit(line, bodyWidth)}${border("│")}`),
		border(`╰${horizontal}╯`),
	];
}

function renderPanel(
	theme: any,
	width: number,
	renderBody: (bodyWidth: number) => string[],
	options: { paddingY?: number } = {},
): string[] {
	if (width <= 2) return renderBody(Math.max(1, width));
	const paddingX = width < 48 ? 1 : 2;
	const box = new Box(paddingX, options.paddingY ?? 1);
	box.addChild({
		render: (bodyWidth: number) => renderBody(bodyWidth),
		invalidate() {},
	});
	return framed(theme, box.render(width - 2), width);
}

function wrap(text: string, width: number): string[] {
	return new Text(text, 0, 0).render(Math.max(1, width));
}

function selectListTheme(theme: any) {
	return {
		selectedPrefix: (text: string) => theme.fg("accent", text),
		selectedText: (text: string) => theme.bg("selectedBg", theme.fg("accent", text)),
		description: (text: string) => theme.fg("muted", text),
		scrollInfo: (text: string) => theme.fg("dim", text),
		noMatch: (text: string) => theme.fg("warning", text),
	};
}

function settingsListTheme(theme: any) {
	return {
		label: (text: string, selected: boolean) => selected ? theme.fg("accent", theme.bold(text)) : text,
		value: (text: string, selected: boolean) => selected ? theme.fg("accent", text) : theme.fg("muted", text),
		description: (text: string) => theme.fg("muted", text),
		cursor: theme.fg("accent", "› "),
		hint: (text: string) => theme.fg(
			"dim",
			text.replace("Enter/Space", "Enter").replace("Esc to cancel", "Esc to go back"),
		),
	};
}

function statusPresentation(snapshot: SetupSnapshot) {
	if (snapshot.status === "ready") return { label: "Ready", tone: "success" };
	if (snapshot.status === "needs_attention") return { label: "Needs attention", tone: "warning" };
	return { label: "Needs setup", tone: "warning" };
}

function providerConnectionValue(provider: any): string {
	const mode = provider.mode === "custom" ? "Custom" : "Official";
	return provider.connected ? `${mode} · Connected` : `${mode} · Check connection`;
}

function providerDescription(provider: any): string {
	const descriptions: Record<string, string> = {
		openai: "GPT models",
		anthropic: "Claude models",
		google: "Gemini models",
		openrouter: "Multi-provider model gateway",
		deepseek: "DeepSeek models",
		xai: "Grok models",
		groq: "Fast hosted inference",
		mistral: "Mistral models",
		together: "Open model platform",
		cerebras: "Fast hosted inference",
		fireworks: "Hosted open models",
		huggingface: "Hugging Face inference",
		nvidia: "NVIDIA hosted models",
		"kimi-coding": "Kimi coding models",
	};
	return descriptions[provider.id] || "Models available through Pi";
}

function modelDisplay(model: any): string {
	if (!model) return "Choose model";
	return `${model.providerName || model.provider} · ${model.name || model.model}`;
}

function compactNumber(value: unknown): string | undefined {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) return undefined;
	if (number >= 1_000_000) return `${Math.round(number / 100_000) / 10}m context`;
	if (number >= 1_000) return `${Math.round(number / 100) / 10}k context`;
	return `${number} context`;
}

function modelDescription(model: any, provider: any): string {
	return [
		provider.name,
		(model.input || []).includes("image") ? "Vision" : "Text",
		model.reasoning ? "Reasoning" : "Standard",
		compactNumber(model.contextWindow),
	].filter(Boolean).join(" · ");
}

export class SeekBrainSetupCard {
	private snapshot: SetupSnapshot;
	private selectedId = "";
	private busy = false;
	private guided: boolean;

	constructor(
		private readonly tui: any,
		private readonly theme: any,
		initialSnapshot: SetupSnapshot,
		private readonly onActivate: (row: SetupRow) => Promise<void>,
		private readonly onClose: () => void,
	) {
		this.snapshot = initialSnapshot;
		this.guided = Boolean(initialSnapshot.firstTime || !initialSnapshot.primary || !initialSnapshot.research.selected);
		this.selectedId = this.initialSelection();
	}

	getSnapshot() {
		return this.snapshot;
	}

	private providerRows(): SetupRow[] {
		const configured = this.snapshot.providers.filter((provider: any) => provider.mode !== "none");
		const rows = configured.map((provider: any) => ({
			id: `provider:${provider.id}`,
			section: "providers" as const,
			label: provider.name,
			value: providerConnectionValue(provider),
			description: `${provider.modelCount} models · Enter to manage this connection`,
			tone: provider.connected ? "success" as const : "warning" as const,
		}));
		rows.push({
			id: "provider:add",
			section: "providers",
			label: "Add provider…",
			value: "+",
			description: configured.length ? "Connect another model provider" : "Start here — connect a model provider",
			tone: "accent",
		});
		return rows;
	}

	private modelRows(): SetupRow[] {
		const primary = this.snapshot.primary;
		const fast = this.snapshot.fast;
		return [
			{
				id: "model:primary",
				section: "models",
				label: "Primary model",
				value: modelDisplay(primary),
				description: primary
					? "Used for planning, analysis, validation, and interpretation"
					: "Required — choose the main model SeekBrain will use",
				tone: !primary || !primary.available ? "warning" : "text",
			},
			{
				id: "model:fast",
				section: "models",
				label: "Fast model",
				value: fast ? modelDisplay(fast) : "Not set",
				description: fast
					? "Used by lightweight helper stages"
					: "Optional — helper stages use Primary when this is not set",
				tone: fast && !fast.available ? "warning" : fast ? "text" : "muted",
			},
		];
	}

	private researchRows(): SetupRow[] {
		const research = this.snapshot.research;
		return [{
			id: "research:source",
			section: "research",
			label: "Source",
			value: research.selected ? research.label : "Choose source",
			description: !research.selected
				? "Required once — choose a literature source or explicitly choose None"
				: research.source === "none"
					? "Literature retrieval is off; local data and reference exploration remain available"
					: "Used by literature-grounded research stages",
			tone: !research.selected || !research.configured ? "warning" : research.source === "none" ? "muted" : "text",
		}];
	}

	private rows(): SetupRow[] {
		return [...this.providerRows(), ...this.modelRows(), ...this.researchRows()];
	}

	private initialSelection(): string {
		if (!this.snapshot.connectedProviders.length) return "provider:add";
		if (!this.snapshot.primary) return "model:primary";
		if (!this.snapshot.research.selected) return "research:source";
		return this.providerRows()[0]?.id || "model:primary";
	}

	updateSnapshot(snapshot: SetupSnapshot) {
		this.snapshot = snapshot;
		const currentStillExists = this.rows().some((row) => row.id === this.selectedId);
		if (!currentStillExists) this.selectedId = this.initialSelection();
		if (this.guided) {
			if (!snapshot.connectedProviders.length) this.selectedId = "provider:add";
			else if (!snapshot.primary) this.selectedId = "model:primary";
			else if (!snapshot.research.selected) this.selectedId = "research:source";
			else this.guided = false;
		}
		this.tui.requestRender();
	}

	private move(delta: number) {
		const rows = this.rows();
		const current = Math.max(0, rows.findIndex((row) => row.id === this.selectedId));
		this.selectedId = rows[(current + delta + rows.length) % rows.length]?.id || this.selectedId;
		this.tui.requestRender();
	}

	handleInput(data: string) {
		if (this.busy) return;
		if (matchesKey(data, Key.up)) this.move(-1);
		else if (matchesKey(data, Key.down)) this.move(1);
		else if (matchesKey(data, Key.enter)) {
			const row = this.rows().find((candidate) => candidate.id === this.selectedId);
			if (!row) return;
			this.busy = true;
			void this.onActivate(row).finally(() => {
				this.busy = false;
				this.tui.requestRender();
			});
		} else if (matchesKey(data, Key.escape)) {
			this.onClose();
		}
	}

	private visibleProviderRows(rows: SetupRow[]): SetupRow[] {
		if (rows.length <= 6) return rows;
		const selectedIndex = rows.findIndex((row) => row.id === this.selectedId);
		if (selectedIndex < 0) return [...rows.slice(0, 5), rows.at(-1)!];
		const start = Math.max(0, Math.min(selectedIndex - 2, rows.length - 6));
		return rows.slice(start, start + 6);
	}

	private renderRow(row: SetupRow, width: number): string[] {
		const selected = row.id === this.selectedId;
		const marker = selected ? this.theme.fg("accent", "› ") : "  ";
		const label = selected ? this.theme.bold(row.label) : row.label;
		const value = this.theme.fg(row.tone || "text", row.value);
		let lines: string[];
		if (width >= 44) {
			const gap = Math.max(2, width - visibleWidth(marker) - visibleWidth(label) - visibleWidth(value));
			lines = [truncateToWidth(`${marker}${label}${" ".repeat(gap)}${value}`, width, "")];
		} else {
			lines = [truncateToWidth(`${marker}${label}`, width, ""), truncateToWidth(`    ${value}`, width, "")];
		}
		if (selected) lines = lines.map((line) => this.theme.bg("selectedBg", fit(line, width)));
		if (selected && row.description) {
			lines.push(...wrap(this.theme.fg("muted", `  ${row.description}`), width));
		}
		return lines;
	}

	private renderSection(title: string, rows: SetupRow[], width: number): string[] {
		const output = [this.theme.fg("muted", this.theme.bold(title))];
		for (const row of rows) output.push(...this.renderRow(row, width));
		return output;
	}

	render(width: number): string[] {
		return renderPanel(this.theme, width, (bodyWidth) => {
			const status = statusPresentation(this.snapshot);
			const title = this.theme.fg("accent", this.theme.bold("SeekBrain Setup"));
			const statusText = this.theme.fg(status.tone, `● ${status.label}`);
			const headerGap = Math.max(1, bodyWidth - visibleWidth(title) - visibleWidth(statusText));
			const providerRows = this.providerRows();
			const visibleProviders = this.visibleProviderRows(providerRows);
			const lines = [
				truncateToWidth(`${title}${" ".repeat(headerGap)}${statusText}`, bodyWidth, ""),
				this.theme.fg("dim", this.snapshot.firstTime
					? "Connect a provider, choose Primary, then choose a research source"
					: "Models and research · changes save immediately"),
				"",
				...this.renderSection("PROVIDERS", visibleProviders, bodyWidth),
			];
			if (providerRows.length > visibleProviders.length) {
				lines.push(this.theme.fg("dim", `  ${providerRows.length - 1} configured providers · move to scroll`));
			}
			lines.push(
				"",
				...this.renderSection("MODEL STRATEGY", this.modelRows(), bodyWidth),
				"",
				...this.renderSection("RESEARCH", this.researchRows(), bodyWidth),
				"",
				this.theme.fg("dim", "↑↓ Move     Enter Select     Esc Close"),
			);
			return lines;
		});
	}

	invalidate() {}
}

async function selectOption(
	ctx: any,
	title: string,
	description: string,
	items: SelectOption[],
	currentValue?: string,
): Promise<string | undefined> {
	if (!items.length) return undefined;
	return await ctx.ui.custom((tui: any, theme: any, _keybindings: any, done: (value?: string) => void) => {
		const list = new SelectList(items, Math.min(items.length, 12), selectListTheme(theme), {
			minPrimaryColumnWidth: 16,
			maxPrimaryColumnWidth: 34,
		});
		const currentIndex = items.findIndex((item) => item.value === currentValue);
		if (currentIndex >= 0) list.setSelectedIndex(currentIndex);
		list.onSelect = (item) => done(item.value);
		list.onCancel = () => done(undefined);
		return {
			render(width: number) {
				return renderPanel(theme, width, (bodyWidth) => [
					theme.fg("accent", theme.bold(title)),
					...wrap(theme.fg("muted", description), bodyWidth),
					"",
					...list.render(bodyWidth),
					"",
					theme.fg("dim", "↑↓ Move     Enter Select     Esc Back"),
				]);
			},
			handleInput(data: string) {
				list.handleInput(data);
				tui.requestRender();
			},
			invalidate() { list.invalidate(); },
		};
	}, DIALOG_OVERLAY);
}

async function promptInput(
	ctx: any,
	options: { title: string; description?: string; initialValue?: string; placeholder?: string; secret?: boolean },
): Promise<string | undefined> {
	return await ctx.ui.custom((tui: any, theme: any, _keybindings: any, done: (value?: string) => void) => {
		const input = new Input();
		input.focused = true;
		if (options.initialValue) input.setValue(options.initialValue);
		let error = "";
		input.onSubmit = (raw) => {
			const value = raw.trim();
			if (!value) {
				error = "A value is required";
				tui.requestRender();
				return;
			}
			done(value);
		};
		input.onEscape = () => done(undefined);
		return {
			render(width: number) {
				return renderPanel(theme, width, (bodyWidth) => {
					const value = input.getValue();
					const inputLines = options.secret
						? [theme.bg("selectedBg", fit(value
							? `  ${"•".repeat(Math.min(value.length, Math.max(1, bodyWidth - 4)))}`
							: `  ${theme.fg("dim", options.placeholder || "Enter credential")}`, bodyWidth))]
						: input.render(bodyWidth);
					return [
						theme.fg("accent", theme.bold(options.title)),
						...(options.description ? wrap(theme.fg("muted", options.description), bodyWidth) : []),
						"",
						...inputLines,
						...(error ? [theme.fg("error", error)] : []),
						"",
						theme.fg("dim", "Enter Save     Esc Back"),
					];
				});
			},
			handleInput(data: string) {
				input.handleInput(data);
				tui.requestRender();
			},
			invalidate() { input.invalidate(); },
		};
	}, DIALOG_OVERLAY);
}

async function runLoading<T>(
	ctx: any,
	title: string,
	message: string,
	task: (signal: AbortSignal, setMessage: (message: string) => void) => Promise<T>,
): Promise<OperationResult<T>> {
	return await ctx.ui.custom((tui: any, theme: any, _keybindings: any, done: (result: OperationResult<T>) => void) => {
		const loader = new CancellableLoader(tui, (text) => theme.fg("accent", text), (text) => theme.fg("text", text), message);
		let settled = false;
		const finish = (result: OperationResult<T>) => {
			if (settled) return;
			settled = true;
			done(result);
		};
		loader.onAbort = () => finish({ cancelled: true });
		void task(loader.signal, (nextMessage) => loader.setMessage(nextMessage))
			.then((value) => finish({ value }))
			.catch((error) => finish({ error }));
		return {
			render(width: number) {
				return renderPanel(theme, width, (bodyWidth) => [
					theme.fg("accent", theme.bold(title)),
					...loader.render(bodyWidth),
					"",
					theme.fg("dim", "Esc Cancel"),
				]);
			},
			handleInput(data: string) { loader.handleInput(data); },
			invalidate() { loader.invalidate(); },
			dispose() { loader.dispose(); },
		};
	}, DIALOG_OVERLAY);
}

class AuthDialog {
	private readonly loader: CancellableLoader;
	private input?: Input;
	private selection?: SelectList;
	private promptInfo?: any;
	private promptResolve?: (value: string) => void;
	private promptReject?: (error: Error) => void;
	private promptCleanup?: () => void;
	private messages: string[] = [];

	constructor(
		private readonly tui: any,
		private readonly theme: any,
		private readonly title: string,
		private readonly onCancel: () => void,
	) {
		this.loader = new CancellableLoader(
			tui,
			(text) => theme.fg("accent", text),
			(text) => theme.fg("text", text),
			`Connecting to ${title}…`,
		);
		this.loader.onAbort = () => {
			this.rejectPrompt(new Error("Login cancelled"));
			this.onCancel();
		};
	}

	interaction() {
		return {
			signal: this.loader.signal,
			prompt: (prompt: any) => this.showPrompt(prompt),
			notify: (event: any) => this.notify(event),
		};
	}

	private clearPrompt() {
		this.promptCleanup?.();
		this.promptCleanup = undefined;
		this.promptInfo = undefined;
		this.input = undefined;
		this.selection = undefined;
		this.promptResolve = undefined;
		this.promptReject = undefined;
		this.tui.requestRender();
	}

	private resolvePrompt(value: string) {
		const resolve = this.promptResolve;
		this.clearPrompt();
		resolve?.(value);
	}

	private rejectPrompt(error: Error) {
		const reject = this.promptReject;
		this.clearPrompt();
		reject?.(error);
	}

	private showPrompt(prompt: any): Promise<string> {
		if (this.loader.signal.aborted) return Promise.reject(new Error("Login cancelled"));
		this.promptInfo = prompt;
		this.input = undefined;
		this.selection = undefined;
		return new Promise<string>((resolve, reject) => {
			this.promptResolve = resolve;
			this.promptReject = reject;
			if (prompt.type === "select") {
				const options = prompt.options.map((option: any) => ({
					value: option.id,
					label: option.label,
					description: option.description,
				}));
				this.selection = new SelectList(options, Math.min(options.length, 8), selectListTheme(this.theme));
				this.selection.onSelect = (item) => this.resolvePrompt(item.value);
				this.selection.onCancel = () => this.loader.handleInput("\u001b");
			} else {
				this.input = new Input();
				this.input.focused = true;
				this.input.onSubmit = (value) => this.resolvePrompt(value);
				this.input.onEscape = () => this.loader.handleInput("\u001b");
			}
			if (prompt.signal) {
				const abort = () => this.rejectPrompt(new Error("Login cancelled"));
				prompt.signal.addEventListener("abort", abort, { once: true });
				this.promptCleanup = () => prompt.signal.removeEventListener("abort", abort);
			}
			this.tui.requestRender();
		});
	}

	private notify(event: any) {
		if (event.type === "progress") {
			this.loader.setMessage(event.message);
			return;
		}
		if (event.type === "auth_url") {
			const link = `\u001b]8;;${event.url}\u0007${event.url}\u001b]8;;\u0007`;
			this.messages = ["Open this authorization link:", link, event.instructions].filter(Boolean);
			this.loader.setMessage("Waiting for authorization…");
		} else if (event.type === "device_code") {
			const link = `\u001b]8;;${event.verificationUri}\u0007${event.verificationUri}\u001b]8;;\u0007`;
			this.messages = ["Open the verification page:", link, `Code: ${event.userCode}`];
			this.loader.setMessage("Waiting for authorization…");
		} else if (event.type === "info") {
			const links = (event.links || []).map((link: any) => {
				const label = link.label ? `${link.label}: ${link.url}` : link.url;
				return `\u001b]8;;${link.url}\u0007${label}\u001b]8;;\u0007`;
			});
			this.messages = [event.message, ...links].filter(Boolean);
		}
		this.tui.requestRender();
	}

	render(width: number): string[] {
		return renderPanel(this.theme, width, (bodyWidth) => {
			const lines = [this.theme.fg("accent", this.theme.bold(`Connect ${this.title}`))];
			for (const message of this.messages.slice(-6)) {
				lines.push(...wrap(this.theme.fg("muted", message), bodyWidth));
			}
			if (this.messages.length) lines.push("");
			if (this.promptInfo) {
				lines.push(...wrap(this.promptInfo.message, bodyWidth), "");
				if (this.selection) lines.push(...this.selection.render(bodyWidth));
				else if (this.input) {
					if (this.promptInfo.type === "secret") {
						const value = this.input.getValue();
						const masked = value ? "•".repeat(Math.min(value.length, Math.max(1, bodyWidth - 4))) : this.theme.fg("dim", this.promptInfo.placeholder || "Enter credential");
						lines.push(this.theme.bg("selectedBg", fit(`  ${masked}`, bodyWidth)));
					} else {
						lines.push(...this.input.render(bodyWidth));
					}
				}
			} else {
				lines.push(...this.loader.render(bodyWidth));
			}
			lines.push("", this.theme.fg("dim", this.promptInfo ? "Enter Continue     Esc Cancel" : "Esc Cancel"));
			return lines;
		});
	}

	handleInput(data: string) {
		if (matchesKey(data, Key.escape)) {
			this.loader.handleInput(data);
			return;
		}
		if (this.selection) this.selection.handleInput(data);
		else if (this.input) this.input.handleInput(data);
		this.tui.requestRender();
	}

	invalidate() {
		this.loader.invalidate();
		this.selection?.invalidate();
		this.input?.invalidate();
	}

	dispose() { this.loader.dispose(); }
}

async function connectOfficial(ctx: any, manager: SetupManager, provider: any, authType: string): Promise<OperationResult<SetupSnapshot>> {
	return await ctx.ui.custom((tui: any, theme: any, _keybindings: any, done: (result: OperationResult<SetupSnapshot>) => void) => {
		let settled = false;
		const finish = (result: OperationResult<SetupSnapshot>) => {
			if (settled) return;
			settled = true;
			done(result);
		};
		const dialog = new AuthDialog(tui, theme, provider.name, () => finish({ cancelled: true }));
		void manager.connectOfficial(provider.id, authType, dialog.interaction())
			.then((value: SetupSnapshot) => finish({ value }))
			.catch((error: unknown) => finish({ error }));
		return dialog;
	}, DIALOG_OVERLAY);
}

async function providerAction(ctx: any, provider: any): Promise<string | undefined> {
	return await ctx.ui.custom((tui: any, theme: any, _keybindings: any, done: (value?: string) => void) => {
		const opposite = provider.mode === "custom" ? "Official" : "Custom";
		const items = [
			{
				id: "reconnect",
				label: provider.connected ? "Reconnect…" : "Repair connection…",
				description: `Authenticate this ${provider.mode === "custom" ? "custom endpoint" : "official connection"} again`,
				currentValue: "›",
				values: ["open"],
			},
			{
				id: "switch",
				label: `Switch to ${opposite}…`,
				description: `Replace the current connection with ${opposite.toLowerCase()} access`,
				currentValue: "›",
				values: ["open"],
			},
			{
				id: "disconnect",
				label: "Disconnect…",
				description: "Remove this connection when no configured model uses it",
				currentValue: "›",
				values: ["open"],
			},
		];
		const list = new SettingsList(
			items,
			items.length,
			settingsListTheme(theme),
			(id) => done(id),
			() => done(undefined),
			{ enableSearch: false },
		);
		return {
			render(width: number) {
				return renderPanel(theme, width, (bodyWidth) => [
					theme.fg("accent", theme.bold(provider.name)),
					theme.fg("muted", `Connection   ${provider.mode === "custom" ? "Custom" : "Official"}`),
					theme.fg(provider.connected ? "success" : "warning", `Status       ${provider.connected ? "Connected" : "Needs attention"}`),
					theme.fg("muted", `Models       ${provider.modelCount}`),
					"",
					...list.render(bodyWidth),
				]);
			},
			handleInput(data: string) {
				list.handleInput(data);
				tui.requestRender();
			},
			invalidate() { list.invalidate(); },
		};
	}, DIALOG_OVERLAY);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function notifyOperationError(ctx: any, prefix: string, result: OperationResult<unknown>) {
	if (result.cancelled) return;
	if (result.error) ctx.ui.notify(`${prefix}: ${errorMessage(result.error)}`, "error");
}

async function chooseOfficialAuthType(ctx: any, provider: any): Promise<string | undefined> {
	if (provider.authOptions.length === 1) return provider.authOptions[0].id;
	return await selectOption(
		ctx,
		`Connect ${provider.name}`,
		"Choose how to authenticate with the official provider.",
		provider.authOptions.map((option: any) => ({ value: option.id, label: option.label })),
		provider.authOptions[0]?.id,
	);
}

async function configureProvider(ctx: any, manager: SetupManager, provider: any, mode: "official" | "custom") {
	if (mode === "official") {
		const authType = await chooseOfficialAuthType(ctx, provider);
		if (!authType) return undefined;
		const result = await connectOfficial(ctx, manager, provider, authType);
		notifyOperationError(ctx, `Could not connect ${provider.name}`, result);
		return result.value;
	}

	const baseUrl = await promptInput(ctx, {
		title: `${provider.name} custom endpoint`,
		description: "Enter the API base URL for the third-party or private endpoint.",
		initialValue: provider.mode === "custom" ? provider.baseUrl : "",
		placeholder: "https://…",
	});
	if (!baseUrl) return undefined;
	const apiKey = await promptInput(ctx, {
		title: `${provider.name} credential`,
		description: "Stored by Pi and never written to SeekBrain config.yaml.",
		placeholder: "API key",
		secret: true,
	});
	if (!apiKey) return undefined;
	const result = await runLoading(ctx, `Connect ${provider.name}`, "Validating custom endpoint…", async (signal) => (
		await manager.connectCustom(provider.id, baseUrl, apiKey, signal)
	));
	notifyOperationError(ctx, `Could not connect ${provider.name}`, result);
	return result.value;
}

async function chooseConnectionMode(ctx: any, provider: any, current?: "official" | "custom") {
	return await selectOption(ctx, `Connect ${provider.name}`, "Choose one connection for this provider.", [
		{ value: "official", label: "Official", description: `Use the official ${provider.name} service` },
		{ value: "custom", label: "Custom", description: "Use a third-party or private compatible endpoint" },
	], current);
}

async function handleProviderRow(ctx: any, manager: SetupManager, card: SeekBrainSetupCard, row: SetupRow) {
	const snapshot = card.getSnapshot();
	if (row.id === "provider:add") {
		const candidates = snapshot.providers.filter((provider: any) => provider.mode === "none");
		if (!candidates.length) {
			ctx.ui.notify("All supported Setup providers are already configured", "info");
			return;
		}
		const selected = await selectOption(
			ctx,
			"Add Provider",
			"Only providers with a straightforward connection flow are shown here.",
			candidates.map((provider: any) => ({
				value: provider.id,
				label: provider.name,
				description: providerDescription(provider),
			})),
		);
		if (!selected) return;
		const provider = candidates.find((candidate: any) => candidate.id === selected);
		const mode = await chooseConnectionMode(ctx, provider);
		if (!mode) return;
		const next = await configureProvider(ctx, manager, provider, mode as "official" | "custom");
		if (next) card.updateSnapshot(next);
		return;
	}

	const providerId = row.id.slice("provider:".length);
	const provider = snapshot.providers.find((candidate: any) => candidate.id === providerId);
	if (!provider) return;
	const action = await providerAction(ctx, provider);
	if (!action) return;
	if (action === "reconnect") {
		const next = await configureProvider(ctx, manager, provider, provider.mode);
		if (next) card.updateSnapshot(next);
		return;
	}
	if (action === "switch") {
		const nextMode = provider.mode === "custom" ? "official" : "custom";
		const next = await configureProvider(ctx, manager, provider, nextMode);
		if (next) card.updateSnapshot(next);
		return;
	}
	const confirmation = await selectOption(ctx, `Disconnect ${provider.name}?`, "Models using this provider must be changed first.", [
		{ value: "cancel", label: "Keep connected", description: "Go back without changing anything" },
		{ value: "disconnect", label: "Disconnect", description: "Remove the saved connection" },
	], "cancel");
	if (confirmation !== "disconnect") return;
	const result = await runLoading(ctx, `Disconnect ${provider.name}`, "Removing connection…", async () => (
		await manager.disconnectProvider(provider.id)
	));
	if (result.value) card.updateSnapshot(result.value);
	else notifyOperationError(ctx, `Could not disconnect ${provider.name}`, result);
}

async function chooseModel(ctx: any, manager: SetupManager, card: SeekBrainSetupCard, role: "primary" | "fast", onPrimaryChanged?: PrimaryModelChanged) {
	const snapshot = card.getSnapshot();
	const providers = snapshot.providers.filter((provider: any) => provider.connected);
	if (!providers.length) {
		ctx.ui.notify("Connect a provider before choosing a model", "warning");
		return;
	}
	if (role === "fast") {
		const choice = await selectOption(ctx, "Fast Model", "Fast is optional. Choose Primary to leave it unset.", [
			{ value: "none", label: "Use Primary Model", description: "No separate Fast model" },
			...providers.map((provider: any) => ({
				value: provider.id,
				label: provider.name,
				description: `${provider.mode === "custom" ? "Custom" : "Official"} · ${provider.modelCount} models`,
			})),
		], snapshot.fast ? snapshot.providers.find((provider: any) => provider.runtimeProvider === snapshot.fast.provider)?.id : "none");
		if (!choice) return;
		if (choice === "none") {
			try { card.updateSnapshot(await manager.setFast(undefined)); }
			catch (error) { ctx.ui.notify(`Could not update Fast model: ${errorMessage(error)}`, "error"); }
			return;
		}
		await chooseProviderModel(ctx, manager, card, role, providers.find((provider: any) => provider.id === choice), onPrimaryChanged);
		return;
	}

	let provider = providers[0];
	if (providers.length > 1) {
		const currentProvider = snapshot.providers.find((candidate: any) => candidate.runtimeProvider === snapshot.primary?.provider)?.id;
		const choice = await selectOption(ctx, "Primary Model", "Choose a connected provider first.", providers.map((candidate: any) => ({
			value: candidate.id,
			label: candidate.name,
			description: `${candidate.mode === "custom" ? "Custom" : "Official"} · ${candidate.modelCount} models`,
		})), currentProvider);
		if (!choice) return;
		provider = providers.find((candidate: any) => candidate.id === choice);
	}
	await chooseProviderModel(ctx, manager, card, role, provider, onPrimaryChanged);
}

async function chooseProviderModel(ctx: any, manager: SetupManager, card: SeekBrainSetupCard, role: "primary" | "fast", provider: any, onPrimaryChanged?: PrimaryModelChanged) {
	const snapshot = card.getSnapshot();
	const current = role === "primary" ? snapshot.primary : snapshot.fast;
	const loaded = await runLoading(ctx, `Load ${provider.name} models`, "Checking available models…", async (_signal, setMessage) => {
		const models = await manager.listModels(provider.id, { current });
		setMessage(`${models.length} compatible models available`);
		return models;
	});
	if (!loaded.value) {
		notifyOperationError(ctx, `Could not load ${provider.name} models`, loaded);
		return;
	}
	if (!loaded.value.length) {
		ctx.ui.notify(`${provider.name} has no authenticated vision-capable model`, "warning");
		return;
	}
	const selected = await selectOption(
		ctx,
		`Choose ${role === "primary" ? "Primary" : "Fast"} Model`,
		`${provider.name} · only compatible, authenticated models are shown.`,
		loaded.value.map((model: any) => ({
			value: model.id,
			label: model.name || model.id,
			description: modelDescription(model, provider),
		})),
		current?.provider === provider.runtimeProvider ? current.model : undefined,
	);
	if (!selected) return;
	const model = loaded.value.find((candidate: any) => candidate.id === selected);
	const reference = { provider: model.provider || provider.runtimeProvider, model: model.id };
	try {
		const next = role === "primary" ? await manager.setPrimary(reference) : await manager.setFast(reference);
		card.updateSnapshot(next);
	} catch (error) {
		ctx.ui.notify(`Could not update ${role === "primary" ? "Primary" : "Fast"} model: ${errorMessage(error)}`, "error");
		return;
	}
	if (role === "primary" && onPrimaryChanged) {
		try { await onPrimaryChanged(reference); }
		catch (error) { ctx.ui.notify(`Primary model saved, but the current session could not switch: ${errorMessage(error)}`, "warning"); }
	}
}

function literatureValidationMessage(error: string): string {
	if (error === "authentication_failed") return "The credential was rejected";
	if (error === "connection_timeout") return "The source did not respond in time";
	return "The literature source could not be reached";
}

async function chooseResearch(ctx: any, manager: SetupManager, card: SeekBrainSetupCard) {
	const snapshot = card.getSnapshot();
	const options = literatureSourceOptions();
	const selected = await selectOption(
		ctx,
		"Research Source",
		"Choose where literature-grounded stages retrieve papers. None is a valid choice.",
		options.map((option: any) => ({ value: option.id, label: option.label, description: option.description })),
		snapshot.research.source || undefined,
	);
	if (!selected) return;
	if (selected === "none") {
		try { card.updateSnapshot(await manager.setResearch({ source: "none", label: "None" })); }
		catch (error) { ctx.ui.notify(`Could not update Research Source: ${errorMessage(error)}`, "error"); }
		return;
	}

	const source: any = options.find((option: any) => option.id === selected);
	if (!source) {
		ctx.ui.notify("Unsupported Research Source", "error");
		return;
	}
	let baseUrl = String(source.defaultBaseUrl || "");
	if (selected === "ailab_rag") {
		const enteredBaseUrl = await promptInput(ctx, {
			title: "Shanghai AI Lab Paper RAG",
			description: "Enter the deployment base URL.",
			initialValue: snapshot.research.source === selected
				? snapshot.research.baseUrl
				: String(process.env.SEEKBRAIN_AILAB_RAG_BASE_URL || ""),
			placeholder: "https://…",
		});
		if (!enteredBaseUrl) return;
		baseUrl = enteredBaseUrl;
	}
	if (!baseUrl) {
		ctx.ui.notify("Research Source requires a base URL", "error");
		return;
	}
	let apiKey = "";
	if (source.requiresKey) {
		apiKey = await promptInput(ctx, {
			title: `${source.label} credential`,
			description: "Stored in SeekBrain's protected credential store, never in config.yaml.",
			placeholder: selected === "pubmed" ? "NCBI API key" : "API key",
			secret: true,
		}) || "";
		if (!apiKey) return;
	}
	const literature = {
		source: selected,
		label: source.label,
		baseUrl,
		...(source.requiresKey ? { credentialRef: `${selected}_default`, apiKey } : {}),
	};
	const validation = await runLoading(ctx, `Validate ${source.label}`, "Checking literature source…", async (signal) => (
		await validateLiteratureProvider(literature, { signal })
	));
	if (!validation.value) {
		notifyOperationError(ctx, `Could not validate ${source.label}`, validation);
		return;
	}
	if (!validation.value.ok) {
		ctx.ui.notify(literatureValidationMessage(validation.value.error || "connection_failed"), "error");
		return;
	}
	for (const warning of validation.value.warnings || []) ctx.ui.notify(warning, "warning");
	try { card.updateSnapshot(await manager.setResearch(literature)); }
	catch (error) { ctx.ui.notify(`Could not update Research Source: ${errorMessage(error)}`, "error"); }
}

export async function runPiSetupWizard(ctx: any, options: { manager?: SetupManager; onPrimaryChanged?: PrimaryModelChanged } = {}) {
	if (!ctx.hasUI || ctx.mode !== "tui") {
		throw new Error("SeekBrain setup requires the interactive Pi interface");
	}
	let manager = options.manager;
	if (!manager) {
		const loaded = await runLoading(ctx, "SeekBrain Setup", "Loading providers and current settings…", async () => (
			await createSetupManager({
				userConfigPath: process.env.SEEKBRAIN_USER_CONFIG,
				env: process.env,
			})
		));
		if (loaded.cancelled) throw new Error("Setup cancelled");
		if (loaded.error || !loaded.value) throw loaded.error || new Error("Unable to initialize Setup");
		manager = loaded.value;
	}
	const initialSnapshot = await manager.snapshot();
	return await ctx.ui.custom((tui: any, theme: any, _keybindings: any, done: (result: any) => void) => {
		let card: SeekBrainSetupCard;
		const activate = async (row: SetupRow) => {
			if (row.section === "providers") await handleProviderRow(ctx, manager, card, row);
			else if (row.id === "model:primary") await chooseModel(ctx, manager, card, "primary", options.onPrimaryChanged);
			else if (row.id === "model:fast") await chooseModel(ctx, manager, card, "fast", options.onPrimaryChanged);
			else await chooseResearch(ctx, manager, card);
		};
		card = new SeekBrainSetupCard(tui, theme, initialSnapshot, activate, () => {
			const snapshot = card.getSnapshot();
			done({ ok: true, ...snapshot });
		});
		return card;
	}, CARD_OVERLAY);
}
