import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { npmInvocation } from "../src/platform/npm.mjs";

const npm = npmInvocation(["pack", "--dry-run", "--json"]);
const packed = spawnSync(npm.command, npm.args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
if (packed.error) throw packed.error;
if (packed.status !== 0) { process.stderr.write(packed.stderr); process.exit(packed.status || 1); }
const checked = spawnSync(process.execPath, [fileURLToPath(new URL("./pack-check.mjs", import.meta.url))], {
  input: packed.stdout, stdio: ["pipe", "inherit", "inherit"],
});
if (checked.error) throw checked.error;
process.exitCode = checked.status || 0;
