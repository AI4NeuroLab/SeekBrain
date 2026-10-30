import { existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { ensureRelayCompatibility } from "./relay-compat.mjs";

export async function launchWeb(args, runtime = {}) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: seekbrain web [--cwd <project>] [--port <port>] [--hostname <host>] [--dev]\nDefaults: current project, 30141, 127.0.0.1. Uses the bundled production UI when available.");
    return 0;
  }
  let cwd = runtime.cwd || process.cwd(), port = "30141", hostname = "127.0.0.1", dev = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--no-open") continue;
    if (flag === "--dev") { dev = true; continue; }
    if (!["--cwd", "--port", "--hostname"].includes(flag) || !args[i + 1]) throw new Error(`Unknown or incomplete web option: ${flag}`);
    const value = args[++i];
    if (flag === "--cwd") cwd = resolve(cwd, value);
    else if (flag === "--port") port = value;
    else hostname = value;
  }
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("Web port must be between 1 and 65535");
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) throw new Error(`Project directory does not exist: ${cwd}`);
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname) && !process.env.PI_WEB_PASSWORD) throw new Error("Set PI_WEB_PASSWORD before enabling LAN access");
  const root = runtime.packageRoot || resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const web = join(root, "web");
  let next;
  try { next = createRequire(join(web, "package.json")).resolve("next/dist/bin/next"); }
  catch { throw new Error("Web UI dependencies are missing. Reinstall SeekBrain, or run npm --prefix web ci in the source directory."); }
  const production = !dev && existsSync(join(web, ".next-release/BUILD_ID"));
  if (process.platform === "darwin") await import(pathToFileURL(join(web, "bin/prepare-terminal.js")).href);
  ensureRelayCompatibility();
  console.log(`SeekBrain Web: http://${hostname.includes(":") ? `[${hostname}]` : hostname}:${port}/?cwd=${encodeURIComponent(cwd)}\nProject: ${cwd}`);
  const child = spawn(process.execPath, [next, production ? "start" : "dev", "--hostname", hostname, "--port", port], {
    cwd: web, stdio: "inherit", env: {
      ...process.env,
      PI_CODING_AGENT_DIR: process.env.SEEKBRAIN_CODING_AGENT_DIR || process.env.PI_CODING_AGENT_DIR,
      PI_CODING_AGENT_SESSION_DIR: process.env.SEEKBRAIN_CODING_AGENT_SESSION_DIR || process.env.PI_CODING_AGENT_SESSION_DIR,
      SEEKBRAIN_PACKAGE_ROOT: root, SEEKBRAIN_WEB_CWD: cwd,
      SEEKBRAIN_WEB_BUILD_DIR: production ? ".next-release" : ".next",
      PI_WEB_APP_NAME: "SeekBrain", PI_WEB_SKIP_VERSION_CHECK: "1", PI_SKIP_VERSION_CHECK: "1",
    },
  });
  const stop = signal => child.kill(signal);
  const onInt = () => stop("SIGINT"), onTerm = () => stop("SIGTERM");
  process.on("SIGINT", onInt); process.on("SIGTERM", onTerm);
  try {
    return await new Promise((done, reject) => { child.once("error", reject); child.once("exit", code => done(code ?? 1)); });
  } finally { process.off("SIGINT", onInt); process.off("SIGTERM", onTerm); }
}
