import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

const [releaseArgument, gitArgument, outputArgument, zipArgument] = process.argv.slice(2);
assert(releaseArgument && gitArgument && outputArgument, "Usage: node prepare-modelscope-windows-mirror.mjs RELEASE_DIR GIT_ARCHIVE OUTPUT_DIR [VERIFIED_ZIP]");
const release = resolve(releaseArgument), output = resolve(outputArgument);
const root = "https://www.modelscope.cn/datasets/SeekBrain/seekbrain-releases/resolve/master";
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
const version = (await readFile(join(release, "version.txt"), "utf8")).trim();
assert.match(version, /^\d+\.\d+\.\d+$/);
const record = JSON.parse(await readFile(join(release, "win32-x64.json"), "utf8"));
assert.equal(record.target, "win32-x64");
assert.equal(record.releaseVersion, version);
assert.equal(record.file, `seekbrain-${version}-windows-x64.zip`);
const sums = new Map((await readFile(join(release, "SHA256SUMS"), "utf8")).trim().split(/\r?\n/).map(line => {
  const match = line.match(/^([a-f0-9]{64})  ([^/\\]+)$/);
  assert(match, "Malformed upstream checksums");
  return [match[2], match[1]];
}));
const zip = zipArgument ? resolve(zipArgument) : join(release, record.file);
assert.equal(await sha256(zip), record.sha256, "Windows ZIP checksum mismatch");
assert.equal(sums.get(record.file), record.sha256);
for (const file of ["install.ps1", "release-manifest.json", "version.txt"]) {
  assert.equal(await sha256(join(release, file)), sums.get(file), `Upstream checksum mismatch: ${file}`);
}
assert.equal(await sha256(resolve(gitArgument)), record.git.sha256, "PortableGit checksum mismatch");
let script = await readFile(join(release, "install.ps1"), "utf8");
function replaceOnce(before, after) {
  assert.equal(script.split(before).length, 2, `Expected exactly one installer fragment: ${before}`);
  script = script.replace(before, after);
}
replaceOnce("SeekBrain GitHub Release installer for Windows", "SeekBrain ModelScope mirror installer for Windows");
replaceOnce("Optional HTTPS mirror root; falls back to GitHub", "Optional HTTPS override; falls back to ModelScope");
replaceOnce("    $base = 'https://github.com/AI4NeuroLab/SeekBrain/releases'", `    $base = '${root}'`);
replaceOnce("    if ($env:SEEKBRAIN_RELEASE_BASE_URL) { $base = $env:SEEKBRAIN_RELEASE_BASE_URL.TrimEnd('/') }", "    # This entry point always downloads from ModelScope; the GitHub installer is separate.");
replaceOnce("    if (-not $Mirror) { $Mirror = $env:SEEKBRAIN_DOWNLOAD_MIRROR }", "    # Environment source overrides are intentionally not inherited by this entry point.");
replaceOnce("Get-VerifiedArchive $manifest.git.url $manifest.git.file $manifest.git.sha256", "Get-VerifiedArchive ($base + '/upstream/' + $manifest.git.file) $manifest.git.file $manifest.git.sha256");
replaceOnce("SEEKBRAIN_RELEASE_BASE_URL can select a GitHub Release mirror.", "This entry point downloads release files and PortableGit from ModelScope.");
replaceOnce("SEEKBRAIN_DOWNLOAD_MIRROR also sets -Mirror. Mirror layout:", "GitHub installation remains available through its separate command. Layout:");
const destination = join(output, "download", `v${version}`);
await mkdir(destination, { recursive: true });
await mkdir(join(output, "latest", "download"), { recursive: true });
await mkdir(join(output, "upstream"), { recursive: true });
await copyFile(zip, join(destination, record.file));
for (const file of [record.file + ".sha256", "win32-x64.json", "release-manifest.json", "version.txt"]) {
  await copyFile(join(release, file), join(destination, file));
}
await writeFile(join(destination, "install.ps1"), script);
await writeFile(join(output, "install.ps1"), script);
await writeFile(join(output, "latest", "download", "install.ps1"), script);
await copyFile(join(release, "version.txt"), join(output, "latest", "download", "version.txt"));
await copyFile(resolve(gitArgument), join(output, "upstream", record.git.file));
await copyFile(join(release, "SHA256SUMS"), join(destination, "UPSTREAM-SHA256SUMS"));
sums.set("install.ps1", await sha256(join(destination, "install.ps1")));
await writeFile(join(destination, "SHA256SUMS"), [...sums].map(([file, hash]) => `${hash}  ${file}`).join("\n") + "\n");
await writeFile(join(output, "WINDOWS-INSTALL.md"), `# SeekBrain Windows v${version} mirror\n\nThis repository mirrors the Windows release and pinned PortableGit runtime. Other platforms remain available on GitHub.\n\n## Windows PowerShell\n\n\`\`\`powershell\nirm ${root}/install.ps1 | iex\n\`\`\`\n\nThis command fetches the installer, Windows ZIP and PortableGit from ModelScope. It does not fall back to GitHub. The original website/GitHub installation command is unchanged and continues to use GitHub.\n\nZIP download: ${root}/download/v${version}/${record.file}\n\nThe Windows ZIP and PortableGit bytes match their official SHA-256 pins. Only the mirror installer's download URLs differ. UPSTREAM-SHA256SUMS preserves GitHub's original checksum list; SHA256SUMS records the mirror installer hash.\n\nSeekBrain source: https://github.com/AI4NeuroLab/SeekBrain\nRelease: https://github.com/AI4NeuroLab/SeekBrain/releases/tag/v${version}\n\nSeekBrain is MIT licensed. Bundled Node, Python, Git and third-party libraries retain their own licenses and notices in the archives.\n`);
console.log(JSON.stringify({ output, version, mirrorRoot: root, windowsSha256: record.sha256, gitSha256: record.git.sha256 }));
