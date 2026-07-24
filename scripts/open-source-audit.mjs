import { readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import process from "node:process";

const listed = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: process.cwd(), encoding: "utf8" },
);

if (listed.status !== 0) {
  console.error("open-source audit requires a Git worktree");
  process.exit(1);
}

const files = listed.stdout
  .split("\0")
  .filter(Boolean);
const forbiddenFiles = [
  /(^|\/)\.env$/,
  /(^|\/)auth\.json$/,
  /(^|\/)(?:id_rsa|id_ed25519)$/,
];
const contentRules = [
  ["private key", /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
  ["provider credential", /\b(?:sk-ant-|sk-(?:live|proj)-|gh[pousr]_)[A-Za-z0-9_-]{16,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["personal shared-storage path", /\/mnt\/shared-storage-user\//],
  ["personal home path", /\/(?:home|Users)\/[A-Za-z0-9._-]+\//],
  ["hard-coded IP service URL", /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/],
];

const findings = [];
for (const path of files) {
  const vendoredReference = /^library\/skills\/trajectory\/[^/]+\/references\/matched_files\//.test(path);
  for (const pattern of forbiddenFiles) {
    if (pattern.test(path)) findings.push({ path, rule: "sensitive file name" });
  }
  let info;
  try {
    info = await stat(path);
  } catch {
    continue;
  }
  if (!info.isFile() || info.size > 2_000_000) continue;
  const buffer = await readFile(path);
  if (buffer.includes(0)) continue;
  const source = buffer.toString("utf8");
  for (const [rule, pattern] of contentRules) {
    // Matched repository files are verbatim upstream evidence. Author-local
    // example paths are expected there and are not SeekBrain deployment paths.
    if (vendoredReference && (rule === "personal shared-storage path" || rule === "personal home path")) continue;
    if (pattern.test(source)) findings.push({ path, rule });
  }
}

if (findings.length) {
  console.error("Open-source audit failed. Findings (values intentionally hidden):");
  for (const finding of findings) console.error(`- ${finding.path}: ${finding.rule}`);
  process.exit(1);
}

console.log(`Open-source audit passed (${files.length} source files checked; ignored local files excluded).`);
