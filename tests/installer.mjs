import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, readlink, readdir, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const installer = resolve(new URL("../scripts/install.sh", import.meta.url).pathname);
function run(args, env = {}, piped = false) {
  const shellArgs = piped
    ? ["-c", 'set -o pipefail; installer=$1; shift; cat "$installer" | bash -s -- "$@"', "seekbrain-install-test", installer, ...args]
    : [installer, ...args];
  return spawnSync("bash", shellArgs, {
    encoding: "utf8", timeout: 120_000, env: { ...process.env, ...env },
  });
}
test("installer help needs no runtime and rejects invalid options", () => {
  assert.equal(run(["--help"]).status, 0);
  assert.match(run(["--help"]).stdout, /Node 24, fd, rg/);
  assert.notEqual(run(["--prefix"]).status, 0);
  assert.notEqual(run(["--unknown"]).status, 0);
});

test("offline cache errors do not replace an existing installation", async () => {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-install-failure-"));
  try {
    const prefix = join(root, "app");
    await mkdir(prefix);
    await writeFile(join(prefix, "current"), "previous install sentinel");
    const result = run(["--offline", "--no-modify-path", "--prefix", prefix, "--bin-dir", join(root, "bin")], {
      HOME: root, SEEKBRAIN_INSTALL_CACHE: join(root, "empty-cache"),
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Offline cache is missing/);
    assert.equal(await readFile(join(prefix, "current"), "utf8"), "previous install sentinel");
    // Cleanup releases the installation lock even when a download fails.
    const retry = run(["--offline", "--no-modify-path", "--prefix", prefix, "--bin-dir", join(root, "bin")], {
      HOME: root, SEEKBRAIN_INSTALL_CACHE: join(root, "empty-cache"),
    });
    assert.match(retry.stderr, /Offline cache is missing/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("installer protects existing commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-install-command-"));
  try {
    await mkdir(join(root, "bin"));
    await writeFile(join(root, "bin", "seekbrain"), "existing command");
    const result = run(["--prefix", join(root, "app"), "--bin-dir", join(root, "bin")], {
      HOME: root, SEEKBRAIN_INSTALL_CACHE: join(root, "cache"),
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Command already exists/);
    assert.equal(await readFile(join(root, "bin", "seekbrain"), "utf8"), "existing command");
  } finally { await rm(root, { recursive: true, force: true }); }
});

// Supply a real, pinned Node archive to exercise installation without any
// network or modifications to the developer's real HOME or Node installation.
test("offline installation, private runtime, upgrade, and failure recovery", {
  skip: !process.env.SEEKBRAIN_TEST_ARCHIVE_CACHE && "Set SEEKBRAIN_TEST_ARCHIVE_CACHE to a cache of the pinned Node archive",
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-install-e2e-"));
  try {
    const prefix = join(root, "user's app with spaces");
    const bin = join(root, "user's bin with spaces");
    const fixture = join(root, "fixture");
    const oldTools = join(root, "old-system-tools");
    const cache = join(root, "cache");
    await mkdir(cache);
    for (const asset of await readdir(process.env.SEEKBRAIN_TEST_ARCHIVE_CACHE)) {
      if (asset.startsWith("node-") && asset.endsWith(".tar.gz")) await cp(join(process.env.SEEKBRAIN_TEST_ARCHIVE_CACHE, asset), join(cache, asset));
    }
    await mkdir(fixture);
    await mkdir(oldTools);
    // A broken system node must not affect installation or future launches.
    await writeFile(join(oldTools, "node"), "#!/bin/sh\nexit 77\n", { mode: 0o755 });
    await writeFile(join(oldTools, "curl"), "#!/bin/sh\necho 'Unexpected network request' >&2\nexit 99\n", { mode: 0o755 });
    const env = {
      HOME: root, SEEKBRAIN_INSTALL_CACHE: cache,
      SEEKBRAIN_NPM_CACHE: join(cache, "npm"),
      PATH: `${oldTools}:${process.env.PATH}`,
    };
    const args = ["--offline", "--prefix", prefix, "--bin-dir", bin, "--package", fixture];
    await writeFile(join(fixture, "package.json"), JSON.stringify({ name: "seekbrain", version: "0.0.0", type: "module" }));
    await mkdir(join(fixture, "bin"));
    const source = resolve(new URL("..", import.meta.url).pathname);
    await mkdir(join(fixture, "src/cli"), { recursive: true });
    await cp(join(source, "src/cli/bundled-tools.mjs"), join(fixture, "src/cli/bundled-tools.mjs"));
    await cp(join(source, "src/cli/tool-packages.mjs"), join(fixture, "src/cli/tool-packages.mjs"));
    const toolName = `seekbrain-tools-${process.platform}-${process.arch}`;
    const toolPackage = join(root, `${toolName}-0.1.0.tgz`);
    const packed = spawnSync("npm", ["pack", "--silent", "--ignore-scripts", "--pack-destination", root], {
      cwd: join(source, "packages", toolName), encoding: "utf8",
      env: { ...process.env, npm_config_cache: join(cache, "npm") },
    });
    assert.ifError(packed.error);
    assert.equal(packed.status, 0, packed.stderr);
    args.push("--tools-package", toolPackage);
    await writeFile(join(fixture, "bin", "seekbrain.mjs"), `
      import { configureBundledTools } from '../src/cli/bundled-tools.mjs';
      import { spawnSync } from 'node:child_process';
      configureBundledTools();
      console.log(JSON.stringify({ node: process.versions.node,
        fd: spawnSync('fd', ['--version'], {encoding:'utf8'}).stdout.trim(),
        rg: spawnSync('rg', ['--version'], {encoding:'utf8'}).stdout.trim(),
        args: process.argv.slice(2) }));
    `);
    await writeFile(join(fixture, "bin", "seekbrain-pdf.mjs"), "console.log('pdf fixture')");
    const first = run(args, env);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const probe = spawnSync(join(bin, "seekbrain"), ["argument with spaces"], { env: { ...process.env, ...env }, encoding: "utf8" });
    assert.ifError(probe.error);
    assert.equal(probe.status, 0, probe.stderr);
    const result = JSON.parse(probe.stdout);
    assert.equal(result.node, "24.22.1");
    assert.match(result.fd, /^fd 10\.3\.0/);
    assert.match(result.rg, /^ripgrep 14\.1\.1/);
    assert.deepEqual(result.args, ["argument with spaces"]);
    const alias = spawnSync(join(bin, "seekbrain-014"), ["--version"], { env: { ...process.env, ...env }, encoding: "utf8" });
    assert.ifError(alias.error);
    assert.equal(alias.status, 0, alias.stderr);
    assert.equal(JSON.parse(alias.stdout).node, "24.22.1");
    const pdf = spawnSync(join(bin, "seekbrain-pdf"), [], { env: { ...process.env, ...env }, encoding: "utf8" });
    assert.ifError(pdf.error);
    assert.equal(pdf.stdout.trim(), "pdf fixture");
    const profile = await readFile(join(root, ".bashrc"), "utf8");
    const shellProbe = spawnSync("bash", ["--noprofile", "--norc", "-c", 'source "$HOME/.bashrc"; seekbrain --version'], { env: { ...process.env, ...env }, encoding: "utf8" });
    assert.ifError(shellProbe.error);
    assert.equal(shellProbe.status, 0, shellProbe.stderr);

    const original = await readlink(join(prefix, "current"));
    const toolLicenses = join(original, "npm/lib/node_modules", toolName, "licenses");
    assert.match(await readFile(join(toolLicenses, "fd/LICENSE-MIT"), "utf8"), /Copyright.*fd developers/);
    assert.match(await readFile(join(toolLicenses, "rg/LICENSE-MIT"), "utf8"), /Copyright.*Andrew Gallant/);
    assert.match(await readFile(join(toolLicenses, "rg/COPYING"), "utf8"), /either license/);
    assert.match(await readFile(join(original, "runtime/LICENSE"), "utf8"), /Node/);
    // Exercise the same stdin execution mode as curl ... | bash.
    const upgrade = run(args, env, true);
    assert.equal(upgrade.status, 0, upgrade.stdout + upgrade.stderr);
    const upgraded = await readlink(join(prefix, "current"));
    assert.notEqual(upgraded, original);
    assert.equal(await readFile(join(root, ".bashrc"), "utf8"), profile, "PATH entry is idempotent");
    await rm(join(fixture, "bin", "seekbrain.mjs"));
    const failed = run(args, env);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /does not contain the SeekBrain command/);
    assert.equal(await readlink(join(prefix, "current")), upgraded, "failed upgrade preserves the working version");
    // Cache tampering is rejected before extraction or execution.
    const asset = `node-v24.22.1-${process.platform}-${process.arch}.tar.gz`;
    await writeFile(join(cache, asset), "corrupted archive");
    const corrupted = run(args, env);
    assert.notEqual(corrupted.status, 0);
    assert.match(corrupted.stderr, /failed SHA-256 verification/);
    assert.equal(await readlink(join(prefix, "current")), upgraded);
  } finally { await rm(root, { recursive: true, force: true }); }
});
