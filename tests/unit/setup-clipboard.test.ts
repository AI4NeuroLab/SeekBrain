import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { readSetupClipboardText } from "../../src/platform/clipboard.mjs";
import { windowsPowerShellEnvironment } from "../../src/platform/environment.mjs";

const execute = promisify(execFile);

describe("Windows setup clipboard integration", () => {
  // Do not change a developer's desktop clipboard when they run unit tests.
  it.runIf(process.platform === "win32" && process.env.GITHUB_ACTIONS === "true")("reads a fixture from the native clipboard on the Windows runner", async () => {
    const options = { windowsHide: true, timeout: 10000, env: windowsPowerShellEnvironment() };
    await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-Command", "Set-Clipboard -Value 'sk-test-windows-clipboard-fixture'"], options);
    try {
      expect(await readSetupClipboardText()).toBe("sk-test-windows-clipboard-fixture");
    } finally {
      await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-Command", "Set-Clipboard -Value ''"], options);
    }
  }, 20000);
});
