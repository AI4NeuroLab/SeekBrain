import { Input, truncateToWidth } from "@earendil-works/pi-tui";
import { runSetup } from "../../cli/setup.mjs";

type SetupOption = { id: string; label: string; description?: string };

class MaskedInput {
	readonly input = new Input();
	focused = true;

	constructor(
		private readonly tui: any,
		private readonly theme: any,
		private readonly title: string,
		private readonly done: (value: string | undefined) => void,
	) {
		this.input.focused = true;
		this.input.onSubmit = (value: string) => {
			if (value.trim()) this.done(value.trim());
		};
		this.input.onEscape = () => this.done(undefined);
	}

	handleInput(data: string) {
		this.input.handleInput(data);
		this.tui.requestRender();
	}

	render(width: number): string[] {
		const value = this.input.getValue();
		return [
			truncateToWidth(this.theme.fg("accent", this.theme.bold(this.title)), width),
			truncateToWidth(`${this.theme.fg("dim", "API key  ")}${"•".repeat(value.length)}${this.theme.fg("accent", "▌")}`, width),
			truncateToWidth(this.theme.fg("dim", "Enter to continue · Esc to cancel · the key is stored by Pi"), width),
		];
	}

	invalidate() {
		this.input.invalidate();
	}
}

function displayOption(option: SetupOption) {
	return option.description ? `${option.label} — ${option.description}` : option.label;
}

export function createPiSetupPrompter(ctx: any) {
	return {
		async select(message: string, options: SetupOption[]) {
			if (!options.length) throw new Error(`No choices available for: ${message}`);
			const labels = options.map(displayOption);
			const selected = await ctx.ui.select(message, labels);
			if (selected === undefined) throw new Error("Setup cancelled");
			return options[labels.indexOf(selected)]?.id;
		},

		async confirm(message: string, defaultValue = false) {
			return await ctx.ui.confirm(
				"SeekBrain setup",
				`${message}\n\n${defaultValue ? "Recommended default: Yes" : "Recommended default: No"}`,
			);
		},

		async text(message: string, options: { defaultValue?: string; required?: boolean } = {}) {
			const value = await ctx.ui.input(message, options.defaultValue || "");
			if (value === undefined) throw new Error("Setup cancelled");
			const normalized = value.trim() || options.defaultValue || "";
			if (options.required !== false && !normalized) throw new Error(`${message} is required`);
			return normalized;
		},

		async secret(message: string) {
			const value = await ctx.ui.custom((tui: any, theme: any, _keybindings: any, done: any) => (
				new MaskedInput(tui, theme, message, done)
			), { overlay: true });
			if (!value) throw new Error("Setup cancelled");
			return value;
		},

		close() {},
	};
}

export async function runPiSetupWizard(ctx: any) {
	if (!ctx.hasUI || ctx.mode !== "tui") {
		throw new Error("SeekBrain setup requires the interactive Pi interface");
	}
	ctx.ui.notify("SeekBrain setup. Existing model, literature, and credential choices can be reused.", "info");
	return await runSetup({
		prompter: createPiSetupPrompter(ctx),
		userConfigPath: process.env.SEEKBRAIN_USER_CONFIG,
		userTemplate: "workflow:\n  seekbrain: {}\nagents: {}\n",
		output: { write() {} },
	});
}
