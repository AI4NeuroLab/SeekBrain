import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { test } from "node:test";

const windows = process.platform === "win32";

test("Windows downloads show progress, resume, retry and fall back from a broken mirror", { skip: !windows, timeout: 180000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "seekbrain download 中文 "));
  const body = Buffer.alloc(1024 * 1024, "SeekBrain download fixture");
  const sha256 = createHash("sha256").update(body).digest("hex");
  const requests = [];
  let interrupted = false;
  const server = createServer((request, response) => {
    const path = request.url;
    requests.push({ path, range: request.headers.range });
    if (path.includes("mirror-outage/mirror")) { response.writeHead(503); response.end(); return; }
    if (path.includes("mirror-corrupt/mirror")) { response.end(Buffer.alloc(body.length, "wrong")); return; }
    if (path.includes("interrupted/") && !interrupted) {
      interrupted = true;
      response.writeHead(200, { "Content-Length": body.length });
      response.write(body.subarray(0, 32768));
      setTimeout(() => response.destroy(), 100);
      return;
    }
    const start = Number(request.headers.range?.match(/^bytes=(\d+)-$/)?.[1] || 0);
    if (start && !path.includes("range-ignored/")) {
      response.writeHead(206, { "Content-Range": `bytes ${start}-${body.length - 1}/${body.length}`, "Content-Length": body.length - start });
      response.end(body.subarray(start));
    } else {
      response.writeHead(200, { "Content-Length": body.length });
      response.end(body);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const script = join(root, "download-test.ps1");
    // Load the exact production functions without running installation or changing user PATH.
    await writeFile(script, `
$ErrorActionPreference = 'Stop'
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($env:SEEKBRAIN_TEST_INSTALLER, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$functions = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -in @('Get-Download', 'Get-VerifiedArchive') }, $true)
foreach ($function in $functions) { Invoke-Expression $function.Extent.Text }
$Cache = $env:SEEKBRAIN_TEST_CACHE
$base = $env:SEEKBRAIN_TEST_BASE
$Mirror = $env:SEEKBRAIN_TEST_MIRROR
$result = Get-VerifiedArchive ($base + '/download/v0.1.4/fixture.zip') 'fixture.zip' $env:SEEKBRAIN_TEST_HASH
Write-Output ('VERIFIED: ' + $result)
`);
    for (const scenario of ["resume", "interrupted", "range-ignored", "corrupt-partial", "mirror-outage", "mirror-corrupt"]) {
      const cache = join(root, scenario);
      await mkdir(cache);
      if (["resume", "range-ignored", "corrupt-partial"].includes(scenario)) {
        await writeFile(join(cache, `fixture.zip.${sha256}.download`), scenario === "corrupt-partial" ? Buffer.alloc(32768, "bad") : body.subarray(0, 32768));
      }
      const base = `http://127.0.0.1:${server.address().port}/${scenario}`;
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script], {
        env: { ...process.env, SEEKBRAIN_TEST_INSTALLER: fileURLToPath(new URL("../scripts/install.ps1", import.meta.url)),
          SEEKBRAIN_TEST_CACHE: cache, SEEKBRAIN_TEST_BASE: base + "/official", SEEKBRAIN_TEST_HASH: sha256,
          SEEKBRAIN_TEST_MIRROR: scenario.startsWith("mirror-") ? base + "/mirror" : "" },
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
      });
      let output = "";
      child.stdout.on("data", chunk => { output += chunk; });
      child.stderr.on("data", chunk => { output += chunk; });
      const timer = setTimeout(() => child.kill(), 60000);
      const [code] = await once(child, "close");
      clearTimeout(timer);
      assert.equal(code, 0, `${scenario}: ${output}`);
      assert.match(output, /Downloading .* from 127\.0\.0\.1/);
      assert.match(output, /VERIFIED:/);
      assert.deepEqual(await readFile(join(cache, "fixture.zip")), body);
      const seen = requests.filter(item => item.path.includes(`/${scenario}/`));
      if (["resume", "interrupted", "range-ignored", "corrupt-partial"].includes(scenario)) {
        assert(seen.some(item => item.range === "bytes=32768-"), `${scenario} must request the missing bytes`);
      }
      if (scenario.startsWith("mirror-")) {
        assert(seen[0].path.includes("/mirror/"));
        assert(seen.some(item => item.path.includes("/official/")), `${scenario} must fall back to the official source`);
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
