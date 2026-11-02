import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { RELEASE_CONFIG, artifactName, releaseVersion, sha256, downloadVerified } from "../scripts/release-lib.mjs";

test("release targets have pinned official runtimes and distinct platform assets", () => {
  assert.equal(Object.keys(RELEASE_CONFIG.targets).length, 5);
  const names = new Set();
  for (const [target, value] of Object.entries(RELEASE_CONFIG.targets)) {
    names.add(artifactName("0.1.4-preview.1", target));
    for (const asset of [value.node, value.python, ...(value.git ? [value.git] : [])]) {
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      assert.match(asset.url, /^https:\/\/(?:nodejs\.org|github\.com)\//);
      assert(!/[/\\]/.test(asset.file));
    }
  }
  assert.equal(names.size, 5);
  assert(names.has("seekbrain-0.1.4-preview.1-windows-x64.zip"));
  assert(names.has("seekbrain-0.1.4-preview.1-macos-arm64.tar.gz"));
  for (const invalid of ["../0.1.4", "0.1.4\n", "0.1.4;echo", "v0.1.4", "", 14]) assert.throws(() => releaseVersion(invalid));
});

test("cached runtime corruption is rejected even in offline mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-pins-"));
  try {
    const file = join(root, "runtime.tar.gz");
    await writeFile(file, "verified fixture");
    const asset = { file: "runtime.tar.gz", url: "https://example.com/runtime.tar.gz", sha256: await sha256(file) };
    assert.equal(await downloadVerified(asset, root, { offline: true }), file);
    await writeFile(file, "corrupted");
    await assert.rejects(downloadVerified(asset, root, { offline: true }), /SHA-256 mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("release collection rejects mixed revisions and tampered artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-collect-"));
  const script = fileURLToPath(new URL("../scripts/collect-release.mjs", import.meta.url));
  const run = () => spawnSync(process.execPath, [script, root], { encoding: "utf8", timeout: 10000 });
  try {
    for (const target of Object.keys(RELEASE_CONFIG.targets)) {
      const file = artifactName("0.1.4-preview.1", target);
      await writeFile(join(root, file), `payload-${target}`);
      await writeFile(join(root, `${target}.json`), JSON.stringify({ schemaVersion: 1, target, file, releaseVersion: "0.1.4-preview.1", appVersion: "0.1.4", features: { web: false }, sourceCommit: "a".repeat(40), sourceDirty: false, sha256: await sha256(join(root, file)) }));
    }
    let result = run();
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
    const target = "linux-x64", path = join(root, `${target}.json`);
    const record = JSON.parse(await (await import("node:fs/promises")).readFile(path, "utf8"));
    await writeFile(path, JSON.stringify({ ...record, sourceCommit: "b".repeat(40) }));
    result = run(); assert.equal(result.status, 1); assert.match(result.stderr, /same version and source commit/);
    await writeFile(path, JSON.stringify(record));
    await writeFile(join(root, record.file), "tampered");
    result = run(); assert.equal(result.status, 1); assert.match(result.stderr, /checksum\/provenance mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
