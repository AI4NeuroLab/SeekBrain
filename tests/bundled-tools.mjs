import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, delimiter } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { configureBundledTools } from "../src/cli/bundled-tools.mjs";
import { TOOL_PACKAGES } from "../src/cli/tool-packages.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
test("all bundled platforms and licenses match the checksum manifest", async () => {
  const manifest = JSON.parse(await readFile(join(root, "assets/tools/manifest.json"), "utf8"));
  assert.equal(Object.keys(manifest.archives).length, Object.keys(TOOL_PACKAGES).length * 2);
  const main = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  assert.deepEqual(lock.packages[""].optionalDependencies, main.optionalDependencies);
  for (const [target, name] of Object.entries(TOOL_PACKAGES)) {
    const directory = join(root, "packages", name);
    const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    assert.equal(main.optionalDependencies[name], pkg.version);
    assert.deepEqual(pkg.os, [target.split("-")[0]]);
    assert.deepEqual(pkg.cpu, [target.split("-")[1]]);
    assert.equal(lock.packages[`node_modules/${name}`].version, pkg.version);
    assert.equal(lock.packages[`node_modules/${name}`].optional, true);
    const checksums = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
    assert.equal(Object.keys(checksums.archives).length, 2);
    for (const [path, expected] of Object.entries(checksums.files)) {
      const data = await readFile(join(directory, path));
      assert.equal(createHash("sha256").update(data).digest("hex"), expected, `${name}/${path}`);
    }
  }
  for (const platform of ["linux", "darwin"]) {
    for (const arch of ["x64", "arm64"]) {
      const env = { PATH: "/existing/tools" };
      const directory = configureBundledTools(env, root, platform, arch);
      assert.equal(directory, join(root, "packages", TOOL_PACKAGES[`${platform}-${arch}`], "bin"));
      configureBundledTools(env, root, platform, arch);
      assert.deepEqual(env.PATH.split(delimiter), [directory, "/existing/tools"]);
    }
  }
  assert.throws(() => configureBundledTools({}, "/nonexistent", "linux", "x64"), /--include=optional/);
  const windows = { Path: "C:\\Windows\\System32;C:\\Python" };
  const windowsDirectory = configureBundledTools(windows, root, "win32", "x64");
  configureBundledTools(windows, root, "win32", "x64");
  assert.deepEqual(windows.Path.split(";"), [windowsDirectory, "C:\\Windows\\System32", "C:\\Python"]);
  assert.equal(windows.PATH, undefined);
  assert.equal(configureBundledTools({}, root, "win32", "arm64"), undefined);
});

test("Pi resolves package tools with an empty agent cache and downloads disabled", async () => {
  const agent = await mkdtemp(join(tmpdir(), "seekbrain-bundled-tools-"));
  const previousPath = process.env.PATH;
  const previousAgent = process.env.PI_CODING_AGENT_DIR;
  const previousFetch = globalThis.fetch;
  try {
    process.env.PI_CODING_AGENT_DIR = agent;
    configureBundledTools();
    globalThis.fetch = () => { throw new Error("Unexpected network request for a bundled tool"); };
    const piEntry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
    const { ensureTool } = await import(pathToFileURL(join(dirname(piEntry), "utils/tools-manager.js")));
    for (const [tool, version] of [["fd", "fd 10.3.0"], ["rg", "ripgrep 14.1.1"]]) {
      const selected = await ensureTool(tool);
      assert.ok(selected, `Pi could not find ${tool}`);
      const result = spawnSync(selected, ["--version"], { encoding: "utf8" });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.startsWith(version), result.stdout);
    }
  } finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    if (previousAgent === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousAgent;
    globalThis.fetch = previousFetch;
    await rm(agent, { recursive: true, force: true });
  }
});
