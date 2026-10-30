import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createBashToolDefinition } from "@earendil-works/pi-coding-agent";
import { resolvePythonCommand } from "../src/platform/python.mjs";
import { mergeEnvironment } from "../src/platform/environment.mjs";
import { stopProcessTree } from "../src/platform/process-tree.mjs";

const windows = process.platform === "win32";

test("Windows native TUI and PTY modules load without compiling", { skip: !windows, timeout: 20_000 }, async () => {
  const require = createRequire(import.meta.url);
  const tuiRoot = resolve(dirname(require.resolve("@earendil-works/pi-tui")), "..");
  const native = require(join(tuiRoot, "native", "win32", "prebuilds", "win32-x64", "win32-platform.node"));
  assert.equal(typeof native.enableVirtualTerminalInput, "function");
  const pty = require("node-pty").spawn("cmd.exe", ["/d", "/c", "echo seekbrain-pty"], {
    cols: 80, rows: 24, cwd: tmpdir(), env: process.env,
  });
  let output = "";
  await new Promise((done, reject) => {
    pty.onData(data => { output += data; });
    pty.onExit(({ exitCode }) => exitCode === 0 ? done() : reject(new Error(`PTY exit ${exitCode}: ${output}`)));
  });
  assert.match(output, /seekbrain-pty/);
});

test("native Windows Git Bash executes Python in a Unicode directory containing spaces", { skip: !windows, timeout: 30_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "seekbrain 中文 project "));
  try {
    const python = resolvePythonCommand().replace(/\\/g, "/");
    await writeFile(join(dir, "input.csv"), "value\n2\n4\n6\n");
    await writeFile(join(dir, "analysis.py"), [
      "import csv, json, pathlib, statistics",
      "rows = list(csv.DictReader(open('input.csv', encoding='utf-8')))",
      "result = {'n': len(rows), 'mean': statistics.mean(float(r['value']) for r in rows)}",
      "pathlib.Path('statistics.json').write_text(json.dumps(result), encoding='utf-8')",
    ].join("\n"));
    const bash = createBashToolDefinition(dir, {
      spawnHook: context => ({ ...context, env: mergeEnvironment(context.env, { SEEKBRAIN_PYTHON: python }) }),
    });
    const result = await bash.execute("windows-analysis", { command: '"$SEEKBRAIN_PYTHON" analysis.py', timeout: 15 });
    assert.ok(!result.isError, JSON.stringify(result));
    assert.deepEqual(JSON.parse(await readFile(join(dir, "statistics.json"), "utf8")), { n: 3, mean: 4 });
    await writeFile(join(dir, "report.md"), "# Windows analysis\n\nThree observations; mean 4.\n");
    const rendered = spawnSync(process.execPath, [fileURLToPath(new URL("../bin/seekbrain-pdf.mjs", import.meta.url)), "report.md"], { cwd: dir, encoding: "utf8" });
    assert.equal(rendered.status, 0, rendered.stderr);
    assert.equal((await readFile(join(dir, "report.pdf"))).subarray(0, 5).toString(), "%PDF-");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Windows cancellation stops descendant processes", { skip: !windows, timeout: 20_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "seekbrain cancellation "));
  const heartbeat = join(dir, "heartbeat.txt");
  const childCode = `const fs = require('node:fs'); setInterval(() => fs.writeFileSync(${JSON.stringify(heartbeat)}, String(Date.now())), 50);`;
  const parentCode = `const { spawn } = require('node:child_process'); const child = spawn(process.execPath, ['-e', ${JSON.stringify(childCode)}], { stdio: 'ignore' }); console.log(child.pid); setInterval(() => {}, 1000);`;
  const parent = spawn(process.execPath, ["-e", parentCode], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let descendant;
  try {
    descendant = Number((await once(parent.stdout, "data"))[0].toString().trim());
    for (let i = 0; i < 50; i++) {
      try { await readFile(heartbeat); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    await readFile(heartbeat);
    const closed = once(parent, "close");
    stopProcessTree(parent);
    await closed;
    await new Promise(resolve => setTimeout(resolve, 200));
    const stopped = await readFile(heartbeat, "utf8");
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(await readFile(heartbeat, "utf8"), stopped);
  } finally {
    stopProcessTree(parent);
    if (descendant) stopProcessTree({ pid: descendant, kill() {} });
    await new Promise(resolve => setTimeout(resolve, 200));
    await rm(dir, { recursive: true, force: true });
  }
});
