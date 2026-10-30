import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { configureBundledTools } from "../src/cli/bundled-tools.mjs";
import { npmInvocation } from "../src/platform/npm.mjs";
import { TOOL_PACKAGES } from "../src/cli/tool-packages.mjs";

const source = fileURLToPath(new URL("..", import.meta.url));
async function npm(args, cwd, env) {
  const invocation = npmInvocation(args);
  const child = spawn(invocation.command, invocation.args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (data) => { stdout += data; });
  child.stderr.on("data", (data) => { stderr += data; });
  const timer = setTimeout(() => child.kill("SIGKILL"), 90_000);
  try {
    const [code] = await once(child, "close");
    assert.equal(code, 0, `${args.join(" ")}\n${stdout}\n${stderr}`);
    return stdout;
  } finally { clearTimeout(timer); }
}

test("npm downloads only the matching platform package; omitted tools give a clear error", async () => {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-npm-selection-"));
  let server;
  try {
    const fixture = join(root, "fixture");
    const artifacts = join(root, "artifacts");
    await mkdir(fixture);
    await mkdir(artifacts);
    const env = {
      HOME: root, npm_config_cache: join(root, "cache"),
      NPM_CONFIG_USERCONFIG: join(root, "npmrc"), NPM_CONFIG_GLOBALCONFIG: join(root, "global-npmrc"),
    };
    const packages = {};
    for (const name of Object.values(TOOL_PACKAGES)) {
      const directory = join(source, "packages", name);
      const [info] = JSON.parse(await npm(["pack", "--json", "--ignore-scripts", "--pack-destination", artifacts], directory, env));
      packages[name] = {
        pkg: JSON.parse(await readFile(join(directory, "package.json"), "utf8")),
        archive: await readFile(join(artifacts, info.filename)), filename: info.filename,
      };
    }
    const main = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
    await writeFile(join(fixture, "package.json"), JSON.stringify({
      name: "seekbrain-tool-selection-fixture", version: "1.0.0", optionalDependencies: main.optionalDependencies,
    }));
    const [fixturePack] = JSON.parse(await npm(["pack", "--json", "--ignore-scripts", "--pack-destination", artifacts], fixture, env));
    const downloads = [];
    const requests = [];
    let registry;
    server = createServer((request, response) => {
      const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      requests.push(path);
      const name = path.split("/")[1];
      const entry = packages[name];
      if (!entry) { response.writeHead(404).end(); return; }
      if (path === `/${name}`) {
        const version = { ...entry.pkg, dist: {
          tarball: `${registry}/${name}/-/${entry.filename}`,
          integrity: `sha512-${createHash("sha512").update(entry.archive).digest("base64")}`,
        } };
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ name, "dist-tags": { latest: entry.pkg.version }, versions: { [entry.pkg.version]: version } }));
      } else if (path === `/${name}/-/${entry.filename}`) {
        downloads.push(name);
        response.setHeader("Content-Type", "application/octet-stream");
        response.end(entry.archive);
      } else response.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    registry = `http://127.0.0.1:${server.address().port}`;
    const prefix = join(root, "installed");
    // npm pack seeds its own content cache. Use a fresh install cache so this
    // test observes real HTTP transfers instead of reusing the packed bytes.
    const installEnv = { ...env, npm_config_cache: join(root, "install-cache") };
    const args = ["install", "--global", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", "--registry", registry, join(artifacts, fixturePack.filename)];
    await npm(args, root, installEnv);
    const name = TOOL_PACKAGES[`${process.platform}-${process.arch}`];
    assert.deepEqual(downloads, [name], `only the native tool archive should be transferred; requests: ${JSON.stringify(requests)}`);
    const installedRoot = join(prefix, ...(process.platform === "win32" ? [] : ["lib"]), "node_modules", "seekbrain-tool-selection-fixture");
    const directory = configureBundledTools({}, installedRoot);
    assert.ok(directory.endsWith(join(name, "bin")));
    const installed = await readdir(join(installedRoot, "node_modules"));
    assert.deepEqual(installed.filter((entry) => entry.startsWith("seekbrain-tools-")), [name]);

    const omittedPrefix = join(root, "omitted");
    await mkdir(omittedPrefix);
    await writeFile(join(omittedPrefix, "package.json"), await readFile(join(fixture, "package.json")));
    // npm/cli#8284: global tarball installs can ignore --omit. Exercise omission
    // in project mode, where npm applies the declared optional dependency policy.
    const omitted = ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--registry", registry, "--omit=optional"];
    downloads.length = 0;
    await npm(omitted, omittedPrefix, installEnv);
    assert.deepEqual(downloads, []);
    let missingError, omittedDirectory;
    try { omittedDirectory = configureBundledTools({}, omittedPrefix); }
    catch (error) { missingError = error; }
    assert.ok(missingError, `Expected omitted dependency to be missing; resolved ${omittedDirectory}`);
    assert.match(missingError.message, /--include=optional/);
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
