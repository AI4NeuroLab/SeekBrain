import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const [operation, archive, destination] = process.argv.slice(2);
if (operation !== "extract-git" || process.platform !== "win32" || !archive || !destination) throw new Error("Expected extract-git <verified-exe> <destination> on Windows");
await mkdir(destination, { recursive: true });
const result = spawnSync(archive, ["-y", `-o${destination}`], { stdio: "inherit", windowsHide: true, timeout: 600000 });
if (result.error || result.status !== 0) throw result.error || new Error(`Git extraction failed (${result.status})`);
// The SFX parses only -y and -o; unsupported switches stop option parsing.
// Its exit status does not report post-install failures, so inspect the result.
for (const file of [join("cmd", "git.exe"), join("bin", "bash.exe")]) {
  await access(join(destination, file));
}
let pending = false;
try {
  await access(join(destination, "post-install.bat"));
  pending = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (pending) throw new Error("PortableGit initialization did not complete (post-install.bat remains)");
console.log("Private Git Bash extraction and initialization complete.");
