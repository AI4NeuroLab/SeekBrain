import { describe, expect, it, vi } from "vitest";
import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui";
import { SetupInput } from "../../src/extension/tui/setup-input.ts";

function field(secret = true, readClipboard = vi.fn(async () => "sk-test-clipboard" as string | null)) {
  const options = { secret, placeholder: "API key", readClipboard, requestRender: vi.fn(), onPasteError: vi.fn() };
  const input = new SetupInput(options);
  input.focused = true;
  input.onSubmit = vi.fn();
  input.onEscape = vi.fn();
  return { input, options };
}

describe("Setup credential input", () => {
  it("shows a cursor before and after typing without exposing the credential", () => {
    const { input } = field();
    expect(input.render(36).join("\n")).toContain(CURSOR_MARKER);
    input.handleInput("sk-test-secret");
    const shown = input.render(36).join("\n");
    expect(shown).toContain(CURSOR_MARKER);
    expect(shown).toContain("**************");
    expect(shown).not.toContain("sk-test-secret");
    expect(input.getValue()).toBe("sk-test-secret");
    input.handleInput("\r");
    expect(input.onSubmit).toHaveBeenCalledWith("sk-test-secret");
  });

  it("keeps editing positions, scrolling and real values intact across masked renders", () => {
    const { input } = field();
    input.handleInput("abcdef");
    input.handleInput("\u001b[D");
    input.render(6);
    input.handleInput("X");
    expect(input.getValue()).toBe("abcdeXf");
    input.render(6);
    input.handleInput("\u007f");
    expect(input.getValue()).toBe("abcdef");
    input.handleInput("-".repeat(180));
    for (const width of [1, 2, 3, 8, 36]) {
      const lines = input.render(width);
      expect(lines.every(line => visibleWidth(line) <= width)).toBe(true);
      expect(lines.join("\n")).not.toMatch(/abcdef|---/);
      if (width >= 3) expect(lines.join("\n")).toContain(CURSOR_MARKER);
    }
    input.focused = false;
    expect(input.render(36).join("\n")).not.toContain(CURSOR_MARKER);
  });

  it.each(["\u0016", "\u001b[118;5u", "\u001b[2;2~"])("reads an explicit paste shortcut %j", async shortcut => {
    const { input, options } = field();
    input.handleInput(shortcut);
    await vi.waitFor(() => expect(input.getValue()).toBe("sk-test-clipboard"));
    expect(options.readClipboard).toHaveBeenCalledTimes(1);
    expect(input.render(40).join("\n")).not.toContain("sk-test-clipboard");
    expect(input.render(40).join("\n")).toContain("*****************");
  });

  it("queues Enter until an asynchronous paste has completed", async () => {
    let resolve!: (value: string) => void;
    const read = vi.fn(() => new Promise<string>(done => { resolve = done; }));
    const { input } = field(true, read);
    input.handleInput("\u0016");
    input.handleInput("\r");
    expect(input.onSubmit).not.toHaveBeenCalled();
    resolve("sk-test-paste-first\r\n");
    await vi.waitFor(() => expect(input.onSubmit).toHaveBeenCalledWith("sk-test-paste-first"));
  });

  it("accepts terminal bracketed paste without reading the clipboard a second time", () => {
    const { input, options } = field();
    input.handleInput("\u001b[200~sk-test-");
    input.handleInput("bracketed\r\n\u001b[201~");
    input.handleInput("\r");
    expect(input.onSubmit).toHaveBeenCalledWith("sk-test-bracketed");
    expect(options.readClipboard).not.toHaveBeenCalled();
  });

  it("reports unavailable clipboard contents without exposing errors or blocking typing", async () => {
    const { input, options } = field(true, vi.fn(async () => { throw new Error("private clipboard details"); }));
    input.handleInput("\u0016");
    await vi.waitFor(() => expect(options.onPasteError).toHaveBeenCalledWith());
    input.handleInput("manual-test");
    input.handleInput("\r");
    expect(input.onSubmit).toHaveBeenCalledWith("manual-test");
  });

  it("discards late paste results after a dialog closes", async () => {
    let resolve!: (value: string) => void;
    const { input } = field(true, vi.fn(() => new Promise<string>(done => { resolve = done; })));
    input.handleInput("\u0016");
    input.handleInput("\r");
    input.handleInput("\u001b");
    expect(input.onEscape).toHaveBeenCalledTimes(1);
    resolve("sk-test-discarded");
    await new Promise(done => setTimeout(done, 0));
    expect(input.getValue()).toBe("");
    expect(input.onSubmit).not.toHaveBeenCalled();
  });

  it("keeps endpoint text visible while sharing the same paste support", async () => {
    const { input } = field(false, vi.fn(async () => "https://relay.example/v1"));
    input.handleInput("\u0016");
    await vi.waitFor(() => expect(input.getValue()).toBe("https://relay.example/v1"));
    expect(input.render(40).join("\n")).toContain("https://relay.example/v1");
  });
});
