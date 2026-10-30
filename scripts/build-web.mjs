import { cp, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "web");
// Release compilation must not disturb a running development server's .next.
const stage = await mkdtemp(join(root, ".web-build-"));
try {
  await cp(web, stage, {
    recursive: true,
    filter: path => !["node_modules", ".next", ".next-release", ".git", "demo"].some(name =>
      path === join(web, name) || path.startsWith(join(web, name) + "/")),
  });
  await symlink(join(web, "node_modules"), join(stage, "node_modules"), "dir");
  const child = spawn(process.execPath, [join(web, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
    cwd: stage, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", SEEKBRAIN_WEB_BUILD_DIR: ".next-release" },
  });
  const code = await new Promise((done, reject) => { child.once("error", reject); child.once("exit", done); });
  if (code !== 0) throw new Error(`Web release build failed (${code})`);
  await readFile(join(stage, ".next-release/BUILD_ID"));
  await rm(join(stage, ".next-release/cache"), { recursive: true, force: true });
  await rm(join(web, ".next-release"), { recursive: true, force: true });
  await rename(join(stage, ".next-release"), join(web, ".next-release"));
  console.log("SeekBrain production WebUI built: web/.next-release");
} finally { await rm(stage, { recursive: true, force: true }); }
