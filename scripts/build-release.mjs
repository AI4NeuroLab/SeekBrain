import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { npmInvocation } from "../src/platform/npm.mjs";
import { TOOL_PACKAGES } from "../src/cli/tool-packages.mjs";
import { prependPath } from "../src/platform/environment.mjs";
import { ROOT, RELEASE_CONFIG, artifactName, releaseVersion, downloadVerified, extract, nodeExecutable, pythonExecutable, run, sha256 } from "./release-lib.mjs";

const args = process.argv.slice(2);
const valued = new Set(["--target", "--version", "--output", "--cache", "--npm-cache", "--work-dir"]);
for (let i = 0; i < args.length; i++) {
  if (valued.has(args[i])) { if (!args[++i] || args[i].startsWith("--")) throw new Error("Missing option value"); }
  else if (!["--offline", "--cli-only", "--keep-work"].includes(args[i])) throw new Error(`Unknown option: ${args[i]}`);
}
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name}`);
  return args[index + 1];
}
const target = option("--target", `${process.platform}-${process.arch}`);
if (target !== `${process.platform}-${process.arch}`) throw new Error("Build each release on its own OS/architecture; native npm modules cannot be cross-copied.");
const spec = RELEASE_CONFIG.targets[target];
if (!spec) throw new Error(`Unsupported target ${target}`);
const main = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
const version = releaseVersion(option("--version", process.env.RELEASE_VERSION || main.version));
const output = resolve(option("--output", join(ROOT, "releases", version)));
const cache = resolve(option("--cache", join(tmpdir(), "seekbrain-release-cache")));
const npmCache = resolve(option("--npm-cache", join(tmpdir(), "seekbrain-npm-cache")));
const work = resolve(option("--work-dir", tmpdir()));
const offline = args.includes("--offline"), web = !args.includes("--cli-only");
await mkdir(work, { recursive: true });
await mkdir(output, { recursive: true });
const stage = await mkdtemp(join(work, "seekbrain-bundle-"));
const payload = join(stage, "payload"), runtime = join(payload, "runtime"), app = join(payload, "app");
let succeeded = false;
try {
  await mkdir(runtime, { recursive: true });
  const nodeArchive = await downloadVerified(spec.node, cache, { offline });
  await extract(nodeArchive, runtime);
  const nodeDirectory = spec.node.file.replace(/\.(?:tar\.gz|zip)$/, "");
  await rename(join(runtime, nodeDirectory), join(runtime, "node"));
  const node = nodeExecutable(payload);
  await run(node, ["--version"]);
  const pythonArchive = await downloadVerified(spec.python, cache, { offline });
  await extract(pythonArchive, runtime);
  const python = pythonExecutable(payload);
  await run(python, ["-I", "-c", "import sys, ssl, sqlite3, venv, ensurepip; print(sys.version)"]);
  await run(python, ["-I", "-m", "pip", "--version"]);

  if (web) await readFile(join(ROOT, "web", ".next-release", "BUILD_ID"));
  // npm pack applies the reviewed package allowlist; no developer tree/cache is copied.
  const pack = npmInvocation(["pack", "--json", "--ignore-scripts", "--pack-destination", stage, "--cache", npmCache]);
  const packed = spawnSync(pack.command, pack.args, { cwd: ROOT, encoding: "utf8", timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  if (packed.error || packed.status !== 0) throw packed.error || new Error(packed.stderr);
  await extract(join(stage, JSON.parse(packed.stdout)[0].filename), payload);
  await rename(join(payload, "package"), app);
  if (!web) await rm(join(app, "web", ".next-release"), { recursive: true, force: true });
  const appManifest = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(join(ROOT, "package-lock.json"), "utf8"));
  // The unpublished first-party tool packages come from this checkout, never npm.
  delete appManifest.optionalDependencies;
  appManifest.private = true;
  delete lock.packages[""].optionalDependencies;
  for (const name of Object.values(TOOL_PACKAGES)) delete lock.packages[`node_modules/${name}`];
  await writeFile(join(app, "package.json"), JSON.stringify(appManifest, null, 2) + "\n");
  await writeFile(join(app, "package-lock.json"), JSON.stringify(lock, null, 2) + "\n");
  const npm = join(runtime, "node", ...(process.platform === "win32" ? [] : ["lib"]), "node_modules", "npm", "bin", "npm-cli.js");
  await run(node, [npm, "ci", "--omit=dev", "--include=optional", "--no-audit", "--no-fund", "--cache", npmCache, ...(offline ? ["--offline"] : [])], {
    cwd: app, env: prependPath({ ...process.env }, dirname(node)),
  });
  const toolName = TOOL_PACKAGES[target];
  await cp(join(ROOT, "packages", toolName), join(app, "node_modules", toolName), { recursive: true });
  const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  if (revision.status !== 0) throw new Error("Release build requires a Git commit for provenance");
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).stdout.trim().length > 0;
  const manifest = { schemaVersion: 1, releaseVersion: version, appVersion: main.version, target,
    sourceCommit: revision.stdout.trim(), sourceDirty: dirty, builtAt: new Date().toISOString(),
    features: { web }, node: { version: RELEASE_CONFIG.nodeVersion, ...spec.node },
    python: { version: RELEASE_CONFIG.pythonVersion, ...spec.python }, ...(spec.git ? { git: spec.git } : {}) };
  await writeFile(join(payload, "bundle.json"), JSON.stringify(manifest, null, 2) + "\n");
  await cp(join(ROOT, "scripts", "verify-release.mjs"), join(payload, "verify-release.mjs"));
  await cp(join(ROOT, "scripts", "release-launcher.mjs"), join(payload, "launch.mjs"));
  if (spec.git) await cp(join(ROOT, "scripts", "install-helpers.mjs"), join(payload, "install-helpers.mjs"));
  await run(node, [join(payload, "verify-release.mjs"), "--target", target, "--version", version]);
  const name = artifactName(version, target), archive = join(output, name);
  const temporaryArchive = join(stage, name);
  if (process.platform === "win32") {
    // Compress-Archive skips hidden files; .next-release must be retained.
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:SEEKBRAIN_ZIP_SOURCE, $env:SEEKBRAIN_ZIP_OUTPUT, [IO.Compression.CompressionLevel]::Optimal, $false)"],
      { env: { ...process.env, SEEKBRAIN_ZIP_SOURCE: payload, SEEKBRAIN_ZIP_OUTPUT: temporaryArchive } });
  } else await run("tar", ["-czf", temporaryArchive, "-C", payload, "."]);
  const hash = await sha256(temporaryArchive);
  // Stage on the output filesystem before rename, including when work is on /tmp.
  const destinationPartial = archive + `.${process.pid}.partial`;
  await cp(temporaryArchive, destinationPartial);
  await rename(destinationPartial, archive);
  await writeFile(archive + ".sha256", `${hash}  ${name}\n`);
  await writeFile(join(output, `${target}.json`), JSON.stringify({ ...manifest, file: name, sha256: hash }, null, 2) + "\n");
  succeeded = true;
  console.log(`Release artifact: ${archive}\nSHA-256: ${hash}`);
} finally {
  if (!args.includes("--keep-work")) await rm(stage, { recursive: true, force: true });
  else console.log(`Build directory retained: ${stage} (${succeeded ? "complete" : "failed"})`);
}
