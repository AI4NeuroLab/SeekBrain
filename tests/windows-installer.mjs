import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile, access, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { npmInvocation } from "../src/platform/npm.mjs";

const installer = fileURLToPath(new URL("../scripts/install.ps1", import.meta.url));
const windows = process.platform === "win32";
function run(args, timeout = 30_000) {
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", installer, ...args], {
    encoding: "utf8", windowsHide: true, timeout,
  });
}

test("PowerShell installer parses and displays help without installing", { skip: !windows }, () => {
  const result = run(["-Help"]);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /private Node 24/);
});

test("Windows installer installs, upgrades offline and preserves a release after an npm failure", {
  skip: !windows || process.env.SEEKBRAIN_TEST_WINDOWS_INSTALLER_E2E !== "1", timeout: 360_000,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), "seekbrain install e2e 中文 "));
  try {
    const source = fileURLToPath(new URL("..", import.meta.url));
    const fixture = join(dir, "fixture");
    await mkdir(join(fixture, "bin"), { recursive: true });
    await cp(join(source, "src", "cli"), join(fixture, "src", "cli"), { recursive: true });
    await cp(join(source, "src", "platform"), join(fixture, "src", "platform"), { recursive: true });
    await writeFile(join(fixture, "package.json"), JSON.stringify({
      name: "seekbrain", version: "0.0.0-windows-test", type: "module",
      optionalDependencies: { "seekbrain-tools-win32-x64": "0.1.0" },
    }));
    await writeFile(join(fixture, "bin", "seekbrain.mjs"), "console.log(process.argv.includes('--version') ? '0.0.0-windows-test' : JSON.stringify(process.argv.slice(2)));\n");
    await writeFile(join(fixture, "bin", "seekbrain-pdf.mjs"), "console.log('pdf-fixture');\n");
    function pack(cwd) {
      const npm = npmInvocation(["pack", "--json", "--ignore-scripts", "--pack-destination", dir]);
      const result = spawnSync(npm.command, npm.args, { cwd, encoding: "utf8", timeout: 30_000 });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      return join(dir, JSON.parse(result.stdout)[0].filename);
    }
    const main = pack(fixture);
    const tools = pack(join(source, "packages", "seekbrain-tools-win32-x64"));
    const prefix = join(dir, "private app");
    const options = ["-NoModifyPath", "-Prefix", prefix, "-Cache", join(dir, "cache"), "-Package", main, "-ToolsPackage", tools];
    const installed = run(options, 180_000);
    assert.ifError(installed.error);
    assert.equal(installed.status, 0, installed.stderr);
    const pointer = join(prefix, "current.cmd");
    const first = await readFile(pointer, "utf8");
    const upgraded = run([...options, "-Offline"], 60_000);
    assert.ifError(upgraded.error);
    assert.equal(upgraded.status, 0, upgraded.stderr);
    const current = await readFile(pointer, "utf8");
    assert.notEqual(current, first);
    for (const name of ["seekbrain", "seekbrain-014"]) {
      const launcher = join(prefix, "bin", `${name}.cmd`);
      const result = spawnSync("cmd.exe", ["/d", "/s", "/c", `""${launcher}" "argument with spaces" "中文""`], {
        encoding: "utf8", windowsHide: true, windowsVerbatimArguments: true, timeout: 15_000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), ["argument with spaces", "中文"]);
    }
    const broken = run(["-NoModifyPath", "-Offline", "-Prefix", prefix, "-Cache", join(dir, "cache"), "-Package", "seekbrain-missing-offline-fixture@0.0.0"], 60_000);
    assert.notEqual(broken.status, 0);
    assert.equal(await readFile(pointer, "utf8"), current);
    await assert.rejects(access(join(prefix, ".install.lock")));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("offline Windows installation preserves the previous release and releases its lock", { skip: !windows }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "seekbrain installer 中文 "));
  try {
    const prefix = join(dir, "app");
    await mkdir(prefix);
    const pointer = join(prefix, "current.cmd");
    const sentinel = "@rem SeekBrain managed launcher\r\n@rem previous release\r\n";
    await writeFile(pointer, sentinel);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = run(["-Offline", "-NoModifyPath", "-Prefix", prefix, "-Cache", join(dir, "empty-cache")]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Offline cache is missing/);
      assert.equal(await readFile(pointer, "utf8"), sentinel);
      await assert.rejects(access(join(prefix, ".install.lock")));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
