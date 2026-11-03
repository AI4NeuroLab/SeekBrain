import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readlink, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { stopProcessTree } from "../src/platform/process-tree.mjs";
import { windowsPowerShellEnvironment } from "../src/platform/environment.mjs";

const windows = process.platform === "win32";
const source = fileURLToPath(new URL("..", import.meta.url));
const shell = windows ? "powershell.exe" : "bash";
function run(command, args, env, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: windows && command.toLowerCase().endsWith("powershell.exe") ? windowsPowerShellEnvironment(env) : env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", data => { stdout += data; }); child.stderr.on("data", data => { stderr += data; });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Timed out: ${command}\n${stdout}\n${stderr}`)); }, timeout);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", status => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
}
function installerArgs(options, piped = false) {
  if (windows) return ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", join(source, "scripts", "install.ps1"), ...options];
  if (piped) return ["-c", 'set -o pipefail; cat "$1" | bash -s -- "${@:2}"', "seekbrain-test", join(source, "scripts", "install.sh"), ...options];
  return [join(source, "scripts", "install.sh"), ...options];
}

test("release installer help works without Node or Python", async () => {
  const result = await run(shell, installerArgs([windows ? "-Help" : "--help"]), process.env, 15000);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /GitHub Release installer/);
  assert.match(result.stdout, /private Node 24, Python/);
});

test("release version injection is rejected before installation", { skip: windows }, async () => {
  const result = await run(shell, installerArgs(["--version", "0.1.4;touch unexpected"]), process.env, 15000);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid release version/);
});

test("real release installs, upgrades and preserves Python/configuration after a failed download", {
  skip: !process.env.SEEKBRAIN_TEST_RELEASE_DIR,
  timeout: 900000,
}, async () => {
  const output = resolve(process.env.SEEKBRAIN_TEST_RELEASE_DIR);
  const target = `${process.platform}-${process.arch}`;
  const metadata = JSON.parse(await readFile(join(output, `${target}.json`), "utf8"));
  const version = metadata.releaseVersion;
  const parent = process.env.SEEKBRAIN_TEST_ROOT || tmpdir();
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, "seekbrain install 中文 ' "));
  let corruptChecksums = false;
  const server = createServer((request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    if (path.endsWith("/version.txt")) return response.end(version + "\n");
    if (path.endsWith("/SHA256SUMS")) return response.end(`${corruptChecksums ? "0".repeat(64) : metadata.sha256}  ${metadata.file}\n`);
    if (path.endsWith("/" + metadata.file)) return createReadStream(join(output, metadata.file)).pipe(response);
    response.writeHead(404); response.end("not found");
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const prefix = join(root, "private app"), home = join(root, "home"), bin = windows ? join(prefix, "bin") : join(root, "commands");
    const fake = join(root, "broken system runtimes"); await mkdir(fake); await mkdir(home);
    for (const name of ["node", "npm", "python", "python3"]) await writeFile(join(fake, name + (windows ? ".cmd" : "")), windows ? "@exit /b 77\r\n" : "#!/bin/sh\nexit 77\n", { mode: 0o755 });
    const env = { ...process.env, HOME: home, USERPROFILE: home, SEEKBRAIN_RELEASE_BASE_URL: `http://127.0.0.1:${server.address().port}/releases`,
      SEEKBRAIN_INSTALL_CACHE: join(root, "cache"), SEEKBRAIN_INSTALL_PREFIX: prefix, PATH: `${fake}${windows ? ";" : ":"}${process.env.PATH || process.env.Path || ""}` };
    if (windows) { delete env.Path; }
    for (const key of ["CONDA_PREFIX", "CONDA_DEFAULT_ENV", "VIRTUAL_ENV", "SEEKBRAIN_PYTHON", "PI_CODING_AGENT_DIR", "SEEKBRAIN_CODING_AGENT_DIR", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY"]) delete env[key];
    const config = join(home, ".pi", "agent"); await mkdir(config, { recursive: true });
    await writeFile(join(config, "settings.json"), '{"fixture":"keep"}');
    const options = windows ? ["-NoModifyPath"] : ["--bin-dir", bin];
    let result = await run(shell, installerArgs(options, !windows), env);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const command = name => join(bin, name + (windows ? ".cmd" : ""));
    async function launch(name, args) {
      if (!windows) return run(command(name), args, env, 60000);
      // Invoke through PowerShell's argument array to preserve Unicode and spaces.
      const script = join(root, "launch-test.ps1");
      await writeFile(script, '$v = Get-Content -Raw -Encoding UTF8 -LiteralPath $env:SEEKBRAIN_TEST_ARGS | ConvertFrom-Json\n& $env:SEEKBRAIN_TEST_COMMAND @v\nexit $LASTEXITCODE\n');
      const params = join(root, "arguments.json"); await writeFile(params, JSON.stringify(args));
      return run(shell, ["-NoProfile", "-NonInteractive", "-File", script], { ...env, SEEKBRAIN_TEST_ARGS: params, SEEKBRAIN_TEST_COMMAND: command(name) }, 60000);
    }
    result = await launch("seekbrain", ["--version"]); assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), metadata.appVersion);
    result = await launch("seekbrain-014", ["--help"]); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /^SeekBrain /);
    result = await launch("seekbrain", ["doctor"]); assert.equal(result.status, 0, result.stdout + result.stderr); assert.match(result.stdout, /Python 3\./);
    const report = join(root, "installation report.md"), pdf = join(root, "installation report.pdf");
    await writeFile(report, "# Installation test\n\nThree observations; mean 4.\n");
    result = await launch("seekbrain-pdf", [report, "--output", pdf]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal((await readFile(pdf)).subarray(0, 5).toString(), "%PDF-");
    if (metadata.features.web) {
      const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
      const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
      const releases = await readdir(join(prefix, "releases")); assert.equal(releases.length, 1);
      const release = join(prefix, "releases", releases[0]);
      const node = join(release, "runtime", "node", ...(windows ? ["node.exe"] : ["bin", "node"]));
      const child = spawn(node, [join(release, "launch.mjs"), "web", "--cwd", home, "--port", String(port)], {
        env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
      });
      let log = "", failure; child.stdout.on("data", data => { log += data; }); child.stderr.on("data", data => { log += data; });
      child.once("error", error => { failure = error; });
      const closed = new Promise(resolve => child.once("close", resolve));
      try {
        let html;
        for (let i = 0; i < 80 && child.exitCode === null && !failure; i++) {
          try {
            const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
            if (response.status === 200) { html = await response.text(); break; }
          } catch { /* wait for the production server */ }
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        assert.ifError(failure); assert.match(html || "", /<html/, log);
      } finally {
        stopProcessTree(child);
        await Promise.race([closed, new Promise((_, reject) => {
          const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Web server did not stop")); }, 10000);
          timer.unref();
        })]);
      }
    }
    const pointer = windows ? join(prefix, "current.cmd") : join(prefix, "current");
    const readPointer = () => windows ? readFile(pointer, "utf8") : readlink(pointer);
    const initial = await readPointer();
    const environments = await readdir(join(prefix, "environments")); assert.equal(environments.length, 1);
    const marker = join(prefix, "environments", environments[0], "preserved-marker.txt"); await writeFile(marker, "installed analysis environment");
    const rc = !windows && await readFile(join(home, ".bashrc"), "utf8");
    // A mutable release can replace an asset without changing its filename.
    // Old cached bytes must be refreshed using the current SHA256SUMS.
    await writeFile(join(root, "cache", metadata.file), "stale cached artifact");
    result = await run(shell, installerArgs(options, !windows), env);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const upgraded = await readPointer(); assert.notEqual(upgraded, initial);
    assert.equal(await readFile(marker, "utf8"), "installed analysis environment");
    assert.equal(await readFile(join(config, "settings.json"), "utf8"), '{"fixture":"keep"}');
    if (!windows) assert.equal(await readFile(join(home, ".bashrc"), "utf8"), rc);
    corruptChecksums = true;
    result = await run(shell, installerArgs(options), env);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /SHA-256 mismatch/);
    assert.equal(await readPointer(), upgraded);
    result = await launch("seekbrain", ["--version"]); assert.equal(result.status, 0, result.stderr);
    await assert.rejects(access(join(prefix, windows ? ".install.lock" : ".install-lock")));
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
