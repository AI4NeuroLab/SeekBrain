import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ROOT, RELEASE_CONFIG, artifactName, releaseVersion, sha256 } from "./release-lib.mjs";

const directory = resolve(process.argv[2] || "releases");
const targets = Object.keys(RELEASE_CONFIG.targets);
const records = [];
for (const target of targets) {
  let text;
  try { text = await readFile(join(directory, `${target}.json`), "utf8"); }
  catch (error) { if (error.code === "ENOENT" && process.argv.includes("--allow-partial")) continue; throw error; }
  const record = JSON.parse(text);
  releaseVersion(record.releaseVersion);
  if (record.target !== target || record.schemaVersion !== 1 || record.file !== artifactName(record.releaseVersion, target)) throw new Error(`Invalid artifact metadata: ${target}`);
  if (record.sourceDirty && !process.argv.includes("--allow-dirty")) throw new Error("Build releases from a clean committed checkout");
  if (!/^[a-f0-9]{40}$/.test(record.sourceCommit) || await sha256(join(directory, record.file)) !== record.sha256) throw new Error(`Artifact checksum/provenance mismatch: ${target}`);
  if (records.length && ["releaseVersion", "appVersion", "sourceCommit"].some(key => record[key] !== records[0][key])) throw new Error("All platforms must come from the same version and source commit");
  if (records.length && record.features.web !== records[0].features.web) throw new Error("Do not mix CLI-only and Web UI artifacts in the same release");
  records.push(record);
}
if (!records.length) throw new Error("No release artifacts found");
const version = records[0].releaseVersion;
await writeFile(join(directory, "release-manifest.json"), JSON.stringify({ schemaVersion: 1, version, appVersion: records[0].appVersion,
  sourceCommit: records[0].sourceCommit, complete: records.length === targets.length, artifacts: records }, null, 2) + "\n");
await writeFile(join(directory, "version.txt"), version + "\n");
for (const script of ["install.sh", "install.ps1"]) await copyFile(join(ROOT, "scripts", script), join(directory, script));
const sums = records.map(record => `${record.sha256}  ${record.file}`);
for (const file of ["version.txt", "release-manifest.json", "install.sh", "install.ps1"]) sums.push(`${await sha256(join(directory, file))}  ${file}`);
await writeFile(join(directory, "SHA256SUMS"), sums.join("\n") + "\n");
console.log(`Collected ${records.length}/${targets.length} platforms for ${version}`);
