import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { prepareWindowsReleaseUpdate } from "../scripts/prepare-windows-release-update.mjs";
import { artifactName, sha256 } from "../scripts/release-lib.mjs";

test("same-version Windows replacement preserves other platforms and records accurate provenance", async () => {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-windows-update-"));
  const baseline = join(root, "baseline"), replacement = join(root, "replacement"), output = join(root, "output");
  try {
    await mkdir(baseline); await mkdir(replacement);
    const targets = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "win32-x64"];
    const records = [];
    for (const target of targets) {
      const file = artifactName("0.1.4", target);
      await writeFile(join(baseline, file), `old-${target}`);
      records.push({ schemaVersion: 1, target, file, releaseVersion: "0.1.4", appVersion: "0.1.4", sourceCommit: "a".repeat(40), sourceDirty: false, features: { web: true }, sha256: await sha256(join(baseline, file)) });
    }
    const manifest = { schemaVersion: 1, version: "0.1.4", appVersion: "0.1.4", complete: true, sourceCommit: "a".repeat(40), artifacts: records };
    await writeFile(join(baseline, "release-manifest.json"), JSON.stringify(manifest));
    await writeFile(join(baseline, "install.ps1"), "old installer");
    const sums = records.map(record => `${record.sha256}  ${record.file}`);
    for (const name of ["release-manifest.json", "install.ps1"]) sums.push(`${await sha256(join(baseline, name))}  ${name}`);
    sums.push(`${"c".repeat(64)}  install.sh`);
    await writeFile(join(baseline, "SHA256SUMS"), sums.join("\n") + "\n");
    const file = artifactName("0.1.4", "win32-x64");
    await writeFile(join(replacement, file), "new Windows fixture");
    await writeFile(join(replacement, "install.ps1"), "new installer");
    const record = { ...records.at(-1), sourceCommit: "b".repeat(40), sha256: await sha256(join(replacement, file)) };
    await writeFile(join(replacement, "win32-x64.json"), JSON.stringify(record));
    const result = await prepareWindowsReleaseUpdate(baseline, replacement, output, "0.1.4", "b".repeat(40));
    assert.equal(result.files.length, 6);
    assert.equal(result.manifest.complete, true);
    assert.equal(result.manifest.sourceCommit, null);
    assert.deepEqual(result.manifest.artifacts.slice(0, 4), records.slice(0, 4));
    assert.equal(result.manifest.sourceCommits["win32-x64"], "b".repeat(40));
    const updatedSums = await readFile(join(output, "SHA256SUMS"), "utf8");
    for (const line of sums.filter(line => !line.endsWith(file) && !line.endsWith("release-manifest.json") && !line.endsWith("install.ps1"))) assert(updatedSums.includes(line));
    assert(updatedSums.includes(`${record.sha256}  ${file}`));
    await assert.rejects(prepareWindowsReleaseUpdate(baseline, replacement, output, "0.1.4", "c".repeat(40)));
    await writeFile(join(replacement, file), "tampered");
    await assert.rejects(prepareWindowsReleaseUpdate(baseline, replacement, output, "0.1.4", "b".repeat(40)));
  } finally { await rm(root, { recursive: true, force: true }); }
});
