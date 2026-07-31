import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { visibleWidth } from "@earendil-works/pi-tui";
import { runPiSetupWizard, SeekBrainSetupCard } from "../../src/extension/tui/setup-wizard.ts";

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
});
