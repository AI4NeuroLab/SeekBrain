import { spawn } from "node:child_process";
import { win32 } from "node:path";

export function stopProcessTree(child, platform = process.platform) {
  if (!child.pid) return;
  if (platform === "win32") {
    const killer = spawn(win32.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"),
      ["/F", "/T", "/PID", String(child.pid)], { windowsHide: true, stdio: "ignore" });
    killer.once("error", () => { child.kill(); });
  } else {
    child.kill("SIGTERM");
  }
}
