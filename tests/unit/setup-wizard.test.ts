import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { visibleWidth } from "@earendil-works/pi-tui";
import { activateSetupPrimaryModel, runPiSetupWizard, SeekBrainSetupCard } from "../../src/extension/tui/setup-wizard.ts";

const ansi = (code: number, value: string) => `\u001b[${code}m${value}\u001b[0m`;
const theme = {
	fg(_tone: string, value: string) { return value; },
	bg(_tone: string, value: string) { return ansi(7, value); },
	bold(value: string) { return ansi(1, value); },
};

function snapshot(overrides: Record<string, unknown> = {}) {
	const openai = {
		id: "openai",
		name: "OpenAI",
		mode: "none",
		runtimeProvider: "openai",
		connected: false,
		modelCount: 4,
		authOptions: [{ id: "api_key", label: "API key" }],
	};
	return {
		providers: [openai],
		connectedProviders: [],
		primary: undefined,
		fast: undefined,
		research: { selected: false, source: "", label: "Choose source", configured: false },
		status: "needs_setup",
		ready: false,
		firstTime: true,
		configExists: false,
		paths: {},
		...overrides,
	};
}

async function changeModel(options: { role?: "primary" | "fast"; closeOnly?: boolean; cancel?: boolean; saveError?: boolean; switchResult?: boolean; missingModel?: boolean } = {}) {
	const provider = { ...snapshot().providers[0], mode: "custom", runtimeProvider: "openai-relay", connected: true };
	const old = { provider: "openai-relay", id: "old-model" };
	const selected = { provider: "openai-relay", id: "new-model", name: "New model", input: ["text", "image"] };
	let currentModel = old;
	let refreshed = false;
	let settings = snapshot({
		status: "ready", ready: true, firstTime: false, configExists: true,
		providers: [provider], connectedProviders: [provider],
		primary: { provider: old.provider, model: old.id, available: true },
		fast: { provider: old.provider, model: "old-fast", available: true },
		research: { selected: true, source: "none", label: "None", configured: true },
	});
	const calls: string[] = [];
	const manager = {
		async snapshot() { return settings; },
		async listModels() { return [selected]; },
		setPrimary: vi.fn(async reference => {
			calls.push("save-primary");
			if (options.saveError) throw new Error("Configuration is read-only");
			settings = { ...settings, primary: reference };
			return settings;
		}),
		setFast: vi.fn(async reference => { calls.push("save-fast"); settings = { ...settings, fast: reference }; return settings; }),
	};
	const pi = { setModel: vi.fn(async model => {
		calls.push("switch");
		if (options.switchResult === false) return false;
		currentModel = model;
		return true;
	}) };
	const ctx: any = {
		hasUI: true, mode: "tui",
		modelRegistry: {
			refresh: vi.fn(async () => { calls.push("refresh"); refreshed = true; }),
			find: vi.fn(() => { calls.push("find"); return refreshed && !options.missingModel ? selected : undefined; }),
		},
		ui: {
			notify: vi.fn(),
			custom(factory: any) {
				return new Promise((resolve, reject) => {
					let component: any;
					component = factory({ requestRender() {} }, theme, {}, (value: any) => { component?.dispose?.(); resolve(value); });
					if (component instanceof SeekBrainSetupCard) {
						if (options.closeOnly) { component.handleInput("\u001b"); return; }
						void (component as any).onActivate({ id: `model:${options.role || "primary"}`, section: "models" })
							.then(() => component.handleInput("\u001b"), reject);
					} else if (!component.dispose) component.handleInput(options.cancel ? "\u001b" : "\r");
				});
			},
		},
	};
	const onPrimaryChanged = vi.fn(reference => activateSetupPrimaryModel(pi, ctx, reference));
	const result = await runPiSetupWizard(ctx, { manager, onPrimaryChanged });
	return { calls, ctx, pi, manager, onPrimaryChanged, result, selected, currentModel };
}

describe("SeekBrain Setup card", () => {
	it("renders the three simple setting groups responsively", () => {
		const requestRender = vi.fn();
		const card = new SeekBrainSetupCard(
			{ requestRender },
			theme,
			snapshot(),
			async () => {},
			() => {},
		);
		for (const width of [28, 44, 80]) {
			const lines = card.render(width);
			expect(lines.every((line) => visibleWidth(line) <= width)).toBe(true);
			const rendered = lines.join("\n");
			expect(rendered).toContain("PROVIDERS");
			expect(rendered).toContain("MODEL STRATEGY");
			expect(rendered).toContain("RESEARCH");
			expect(rendered).not.toMatch(/\b(?:Environment|Advanced|Thinking|Search)\b/i);
		}
	});

	it("guides an incomplete first setup from Provider to Primary to Research", () => {
		const card = new SeekBrainSetupCard(
			{ requestRender() {} },
			theme,
			snapshot(),
			async () => {},
			() => {},
		);
		expect(card.render(80).join("\n")).toMatch(/\u001b\[7m.*Add provider/);

		const connected = {
			...snapshot(),
			providers: [{ ...snapshot().providers[0], mode: "official", connected: true }],
			connectedProviders: [{ ...snapshot().providers[0], mode: "official", connected: true }],
		};
		card.updateSnapshot(connected);
		expect(card.render(80).join("\n")).toMatch(/\u001b\[7m.*Primary model/);

		card.updateSnapshot({
			...connected,
			primary: { provider: "openai", model: "gpt", providerName: "OpenAI", name: "GPT", available: true },
		});
		expect(card.render(80).join("\n")).toMatch(/\u001b\[7m.*Source/);
	});

	it("returns to the current Pi session when the card closes", async () => {
		const ready = snapshot({
			status: "ready",
			ready: true,
			firstTime: false,
			configExists: true,
			providers: [{ ...snapshot().providers[0], mode: "official", connected: true }],
			connectedProviders: [{ ...snapshot().providers[0], mode: "official", connected: true }],
			primary: { provider: "openai", model: "gpt", providerName: "OpenAI", name: "GPT", available: true },
			research: { selected: true, source: "none", label: "None", configured: true },
		});
		const manager = { async snapshot() { return ready; } };
		const ctx = {
			hasUI: true,
			mode: "tui",
			ui: {
				custom(factory: any, options: any) {
					expect(options.overlay).toBe(true);
					return new Promise((resolve) => {
						const component = factory({ requestRender() {} }, theme, {}, resolve);
						component.handleInput("\u001b");
					});
				},
			},
		};
		const result = await runPiSetupWizard(ctx, { manager });
		expect(result.ready).toBe(true);
		expect(result.primary.model).toBe("gpt");
	});

	it("uses Pi settings/select components with search disabled and masks secrets", async () => {
		const source = await readFile(new URL("../../src/extension/tui/setup-wizard.ts", import.meta.url), "utf8");
		expect(source).toMatch(/new SettingsList/);
		expect(source).toMatch(/enableSearch:\s*false/);
		expect(source).toMatch(/new SelectList/);
		expect(source).toMatch(/CancellableLoader/);
		expect(source).toContain('"•".repeat');
	});
	it("activates the saved Primary in the current Pi session after refreshing the relay model registry", async () => {
		const result = await changeModel();
		expect(result.calls).toEqual(["save-primary", "refresh", "find", "switch"]);
		expect(result.ctx.modelRegistry.refresh).toHaveBeenCalledWith({ allowNetwork: false, providers: ["openai-relay"] });
		expect(result.ctx.modelRegistry.find).toHaveBeenCalledWith("openai-relay", "new-model");
		expect(result.pi.setModel).toHaveBeenCalledWith(result.selected);
		expect(result.currentModel).toBe(result.selected);
		expect(result.result.primary).toEqual({ provider: "openai-relay", model: "new-model" });
	});

	it("keeps the current chat model when changing Fast", async () => {
		const result = await changeModel({ role: "fast" });
		expect(result.manager.setFast).toHaveBeenCalledWith({ provider: "openai-relay", model: "new-model" });
		expect(result.onPrimaryChanged).not.toHaveBeenCalled();
		expect(result.pi.setModel).not.toHaveBeenCalled();
		expect(result.currentModel.id).toBe("old-model");
	});

	it.each([{ closeOnly: true }, { cancel: true }])("does not reset a session model when setup or model selection is cancelled (%j)", async options => {
		const result = await changeModel(options);
		expect(result.manager.setPrimary).not.toHaveBeenCalled();
		expect(result.onPrimaryChanged).not.toHaveBeenCalled();
		expect(result.pi.setModel).not.toHaveBeenCalled();
	});

	it("does not switch the session when saving Primary fails", async () => {
		const result = await changeModel({ saveError: true });
		expect(result.pi.setModel).not.toHaveBeenCalled();
		expect(result.result.primary.model).toBe("old-model");
		expect(result.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Configuration is read-only"), "error");
	});

	it.each([{ switchResult: false }, { missingModel: true }])("retains saved settings and warns if session activation fails (%j)", async options => {
		const result = await changeModel(options);
		expect(result.result.primary.model).toBe("new-model");
		expect(result.currentModel.id).toBe("old-model");
		expect(result.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Primary model saved, but the current session could not switch"), "warning");
	});

});
