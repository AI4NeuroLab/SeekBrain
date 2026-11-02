import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const [operation, archive, destination] = process.argv.slice(2);
if (operation !== "extract-git" || process.platform !== "win32" || !archive || !destination) throw new Error("Expected extract-git <verified-exe> <destination> on Windows");
await mkdir(destination, { recursive: true });
const result = spawnSync(archive, ["-y", "-gm2", `-o${destination}`], { stdio: "inherit", windowsHide: true, timeout: 600000 });
if (result.error || result.status !== 0) throw result.error || new Error(`Git extraction failed (${result.status})`);
