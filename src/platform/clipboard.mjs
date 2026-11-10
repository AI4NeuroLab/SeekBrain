import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getNativeClipboard } from "@earendil-works/pi-tui";
import { windowsPowerShellEnvironment } from "./environment.mjs";

const execute = promisify(execFile);

// Read only in response to the user's explicit paste shortcut. Never put
// clipboard contents in command arguments, errors or diagnostic output.
export async function readSetupClipboardText() {
  try {
    const value = await getNativeClipboard()?.getText();
    if (value) return value;
  } catch { /* Fall back on Windows when the optional native helper is unavailable. */ }
  if (process.platform !== "win32") return null;
  try {
    const { stdout } = await execute("powershell.exe", [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-Command",
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $value = Get-Clipboard -Raw; if ($null -ne $value) { [Console]::Write($value) }",
    ], {
      encoding: "utf8", timeout: 5000, maxBuffer: 1024 * 1024,
      windowsHide: true, env: windowsPowerShellEnvironment(),
    });
    return stdout || null;
  } catch { return null; }
}
