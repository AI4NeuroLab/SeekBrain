import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { artifactName, releaseVersion, sha256 } from "./release-lib.mjs";

export async function prepareWindowsReleaseUpdate(baseline, replacement, output, version, sourceCommit) {
  releaseVersion(version);
  assert.match(sourceCommit, /^[a-f0-9]{40}$/);
  const name = artifactName(version, "win32-x64");
  const manifest = JSON.parse(await readFile(join(baseline, "release-manifest.json"), "utf8"));
  const record = JSON.parse(await readFile(join(replacement, "win32-x64.json"), "utf8"));
  assert.equal(manifest.version, version);
  assert.equal(manifest.appVersion, version);
  assert.equal(manifest.complete, true);
  assert.equal(manifest.artifacts.length, 5);
  assert.deepEqual(manifest.artifacts.map(item => item.target).sort(), ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"]);
  const sums = new Map();
  for (const line of (await readFile(join(baseline, "SHA256SUMS"), "utf8")).trim().split(/\r?\n/)) {
    const match = line.match(/^([a-f0-9]{64})  ([^/\\]+)$/);
    assert(match, "Malformed baseline checksum");
    assert(!sums.has(match[2]), "Duplicate baseline checksum");
    sums.set(match[2], match[1]);
  }
  for (const file of ["release-manifest.json", "install.ps1"]) {
    assert.equal(await sha256(join(baseline, file)), sums.get(file), `Baseline checksum mismatch: ${file}`);
  }
  for (const artifact of manifest.artifacts) {
    assert.equal(artifact.sha256, sums.get(artifact.file));
  }
  assert.equal(await sha256(join(baseline, name)), sums.get(name), "Backup Windows ZIP checksum mismatch");
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.target, "win32-x64");
  assert.equal(record.releaseVersion, version);
  assert.equal(record.appVersion, version);
  assert.equal(record.file, name);
  assert.equal(record.features.web, true);
  assert.equal(record.sourceDirty, false);
  assert.equal(record.sourceCommit, sourceCommit);
  assert.equal(await sha256(join(replacement, name)), record.sha256);
  const unchanged = manifest.artifacts.filter(item => item.target !== "win32-x64");
  manifest.artifacts = manifest.artifacts.map(item => item.target === "win32-x64" ? record : item);
  // Selective same-version replacement has per-platform provenance, not one common commit.
  manifest.sourceCommits = Object.fromEntries(manifest.artifacts.map(item => [item.target, item.sourceCommit]));
  const revisions = [...new Set(Object.values(manifest.sourceCommits))];
  manifest.sourceCommit = revisions.length === 1 ? revisions[0] : null;
  manifest.updatedAt = new Date().toISOString();
  assert.deepEqual(manifest.artifacts.filter(item => item.target !== "win32-x64"), unchanged);
  await mkdir(output, { recursive: true });
  for (const file of [name, "win32-x64.json", "install.ps1"]) {
    await copyFile(join(replacement, file), join(output, file));
  }
  await writeFile(join(output, name + ".sha256"), `${record.sha256}  ${name}\n`);
  await writeFile(join(output, "release-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  sums.set(name, record.sha256);
  for (const file of ["release-manifest.json", "install.ps1"]) sums.set(file, await sha256(join(output, file)));
  await writeFile(join(output, "SHA256SUMS"), [...sums].map(([file, hash]) => `${hash}  ${file}`).join("\n") + "\n");
  return { files: [name, name + ".sha256", "win32-x64.json", "install.ps1", "release-manifest.json", "SHA256SUMS"], manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [baseline, replacement, output, version, sourceCommit] = process.argv.slice(2);
  const result = await prepareWindowsReleaseUpdate(baseline, replacement, output, version, sourceCommit);
  console.log(`Prepared ${result.files.length} Windows update files; the other four platforms are unchanged.`);
}
