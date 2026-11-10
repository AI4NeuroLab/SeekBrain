import { afterEach, describe, expect, it, vi } from "vitest";
import { visibleWidth } from "@earendil-works/pi-tui";
import { useAsciiTui, terminalText, terminalTheme } from "../../src/extension/tui/terminal-style.ts";
import { applySeekBrainDefaults } from "../../src/extension/tui/extension-defaults.ts";
import { SeekBrainSetupCard } from "../../src/extension/tui/setup-wizard.ts";

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("Windows console presentation", () => {
  it("uses plain decoration on unidentified Windows consoles, with explicit overrides", () => {
    expect(useAsciiTui({}, "win32")).toBe(true);
    expect(useAsciiTui({}, "linux")).toBe(false);
    for (const env of [{ WT_SESSION: "id" }, { TERM_PROGRAM: "vscode" }, { WEZTERM_PANE: "1" }]) {
      expect(useAsciiTui(env, "win32")).toBe(false);
    }
    expect(useAsciiTui({ SEEKBRAIN_TUI_STYLE: "ascii", WT_SESSION: "id" }, "win32")).toBe(true);
    expect(useAsciiTui({ SEEKBRAIN_TUI_STYLE: "unicode" }, "win32")).toBe(false);
  });

  it("preserves ANSI sequences, cell widths and Chinese content", () => {
    vi.stubEnv("SEEKBRAIN_TUI_STYLE", "ascii");
    const text = "\x1b[35m╭─│● › … — ↑↓ 中文\x1b[0m";
    const rendered = terminalText(text);
    expect(rendered).toBe("\x1b[35m+-|* > . - ^v 中文\x1b[0m");
    expect(visibleWidth(rendered)).toBe(visibleWidth(text));
    const fg = vi.fn((_tone: string, text: string) => text);
    terminalTheme({ fg }).fg("dim", "hint");
    expect(fg).toHaveBeenCalledWith("text", "hint");
  });

  it("renders the header and setup with aligned ASCII borders at different widths", () => {
    vi.stubEnv("SEEKBRAIN_TUI_STYLE", "ascii");
    vi.useFakeTimers();
    const theme = { fg: (_tone: string, text: string) => text, bg: (_tone: string, text: string) => text, bold: (text: string) => text };
    let header: any;
    applySeekBrainDefaults({ hasUI: true, ui: {
      setTheme() {}, setTitle() {}, setHeader(factory: any) { header = factory({}, theme); },
    } } as any);
    const card = new SeekBrainSetupCard({ requestRender() {} }, theme, {
      providers: [], connectedProviders: [], research: { selected: false }, firstTime: true,
    }, async () => {}, () => {});
    for (const width of [28, 44, 80, 126]) {
      for (const component of [header, card]) {
        const lines = component.render(width);
        expect(lines.every((line: string) => visibleWidth(line) === width)).toBe(true);
        expect(lines.join("\n")).not.toMatch(/[╭╮╰╯│─█●↑↓]/);
      }
    }
    expect(header.render(126).join("\n")).toContain("SeekBrain");
    expect(card.render(80).join("\n")).toContain("^v Move");
    vi.stubEnv("SEEKBRAIN_TUI_STYLE", "unicode");
    expect(header.render(126).join("\n")).toContain("█▀▀");
  });
});
