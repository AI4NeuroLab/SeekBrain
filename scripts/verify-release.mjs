import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "bundle.json"), "utf8"));
const option = name => process.argv[process.argv.indexOf(name) + 1];
if (process.argv.includes("--target")) assert.equal(manifest.target, option("--target"));
if (process.argv.includes("--version")) assert.equal(manifest.releaseVersion, option("--version"));
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.target, `${process.platform}-${process.arch}`);
assert.equal(process.versions.node, manifest.node.version);
const app = join(root, "app"), windows = process.platform === "win32";
const python = join(root, "runtime", "python", ...(windows ? ["python.exe"] : ["bin", "python3"]));
function probe(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 60000, windowsHide: true, ...options });
  if (result.error) throw new Error(`Runtime probe failed: ${command}\n${result.stdout || ""}\n${result.stderr || ""}`, { cause: result.error });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const { configureBundledTools } = await import(pathToFileURL(join(app, "src/cli/bundled-tools.mjs")));
configureBundledTools(process.env, app);
assert.equal(probe(process.execPath, [join(app, "bin", "seekbrain.mjs"), "--version"]), manifest.appVersion);
assert.match(probe(process.execPath, [join(app, "bin", "seekbrain.mjs"), "--help"]), /^SeekBrain /);
assert.equal(probe(python, ["-X", "utf8", "-I", "-c", "import sys,ssl,sqlite3,venv,ensurepip;print('.'.join(map(str,sys.version_info[:3])))"]), manifest.python.version);
probe(python, ["-X", "utf8", "-I", "-m", "pip", "--version"]);
probe(windows ? "fd.exe" : "fd", ["--version"]);
probe(windows ? "rg.exe" : "rg", ["--version"]);
// Load the actual SDK; --version alone does not check runtime dependencies.
// A file entry avoids --input-type leaking into node-pty's Windows Worker.
probe(process.execPath, [join(app, "bin", "check-runtime.mjs")], { cwd: app });
if (windows && process.argv.includes("--require-git")) {
  probe(join(root, "runtime", "git", "cmd", "git.exe"), ["--version"]);
  probe(join(root, "runtime", "git", "bin", "bash.exe"), ["--noprofile", "--norc", "-c", "printf 'Git Bash ready'"]);
}
if (manifest.features.web) await readFile(join(app, "web", ".next-release", "BUILD_ID"));
console.log(`Verified SeekBrain ${manifest.releaseVersion} (${manifest.target}) with private Node/Python and bundled tools.`);
