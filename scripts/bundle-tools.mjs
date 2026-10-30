// Maintainer-only: import verified upstream release archives into the npm package.
// No downloads or install hooks run on users' machines.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { TOOL_PACKAGES, TOOL_PACKAGE_VERSION } from "../src/cli/tool-packages.mjs";
import { resolvePythonCommand } from "../src/platform/python.mjs";

const archiveDir = process.argv[2];
if (!archiveDir) throw new Error("Usage: node scripts/bundle-tools.mjs <archive-directory>");
const repository = fileURLToPath(new URL("..", import.meta.url));
const root = join(repository, "assets/tools");
const targetIndex = process.argv.indexOf("--target");
const target = targetIndex < 0 ? undefined : process.argv[targetIndex + 1];
const platforms = {
  "linux-x64": ["x86_64-unknown-linux-musl", "x86_64-unknown-linux-musl", "2b6bfaae8c48f12050813c2ffe1884c61ea26e750d803df9c9114550a314cd14", "4cf9f2741e6c465ffdb7c26f38056a59e2a2544b51f7cc128ef28337eeae4d8e"],
  "linux-arm64": ["aarch64-unknown-linux-musl", "aarch64-unknown-linux-gnu", "996b9b1366433b211cb3bbedba91c9dbce2431842144d925428ead0adf32020b", "c827481c4ff4ea10c9dc7a4022c8de5db34a5737cb74484d62eb94a95841ab2f"],
  "darwin-x64": ["x86_64-apple-darwin", "x86_64-apple-darwin", "50d30f13fe3d5914b14c4fff5abcbd4d0cdab4b855970a6956f4f006c17117a3", "fc87e78f7cb3fea12d69072e7ef3b21509754717b746368fd40d88963630e2b3"],
  "darwin-arm64": ["aarch64-apple-darwin", "aarch64-apple-darwin", "0570263812089120bc2a5d84f9e65cd0c25e4a4d724c80075c357239c74ae904", "24ad76777745fbff131c8fbc466742b011f925bfa4fffa2ded6def23b5b937be"],
  "win32-x64": ["x86_64-pc-windows-msvc", "x86_64-pc-windows-msvc", "318aa2a6fa664325933e81fda60d523fff29444129e91ebf0726b5b3bcd8b059", "d0f534024c42afd6cb4d38907c25cd2b249b79bbe6cc1dbee8e3e37c2b6e25a1"],
};
if (targetIndex >= 0 && !Object.hasOwn(platforms, target)) throw new Error(`Unknown target: ${target || "missing"}`);
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const manifest = target ? JSON.parse(await readFile(join(root, "manifest.json"), "utf8"))
  : { versions: { fd: "10.3.0", rg: "14.1.1" }, archives: {}, files: {} };
await mkdir(root, { recursive: true });
for (const [platform, [fdTarget, rgTarget, fdHash, rgHash]] of Object.entries(platforms)) {
  if (target && platform !== target) continue;
  const windows = platform.startsWith("win32-");
  const extension = windows ? "zip" : "tar.gz";
  const packageRoot = join(repository, "packages", TOOL_PACKAGES[platform]);
  const [os, cpu] = platform.split("-");
  const packageManifest = { versions: manifest.versions, archives: {}, files: {} };
  await mkdir(packageRoot, { recursive: true });
  await writeFile(join(packageRoot, "package.json"), `${JSON.stringify({
    name: TOOL_PACKAGES[platform], version: TOOL_PACKAGE_VERSION,
    description: `SeekBrain fd and ripgrep binaries for ${platform}`, license: "MIT",
    os: [os], cpu: [cpu], files: ["bin", "licenses", "manifest.json", "README.md"],
  }, null, 2)}\n`);
  await writeFile(join(packageRoot, "README.md"), `# ${TOOL_PACKAGES[platform]}\n\nUnmodified fd 10.3.0 and ripgrep 14.1.1 binaries. Installed automatically by SeekBrain on ${platform}. The MIT license option is used; preserve all notices in licenses/. Upstream provenance and SHA-256 values are in manifest.json.\n`);
  for (const [tool, stem, expected, source, licenses] of [
    ["fd", `fd-v10.3.0-${fdTarget}`, fdHash, "https://github.com/sharkdp/fd/releases/download/v10.3.0", ["LICENSE-MIT", "LICENSE-APACHE"]],
    ["rg", `ripgrep-14.1.1-${rgTarget}`, rgHash, "https://github.com/BurntSushi/ripgrep/releases/download/14.1.1", ["LICENSE-MIT", "COPYING", "UNLICENSE"]],
  ]) {
    const archive = join(resolve(archiveDir), `${stem}.${extension}`);
    if (sha256(await readFile(archive)) !== expected) throw new Error(`SHA-256 mismatch: ${archive}`);
    manifest.archives[`${stem}.${extension}`] = { sha256: expected, url: `${source}/${stem}.${extension}` };
    packageManifest.archives[`${stem}.${extension}`] = manifest.archives[`${stem}.${extension}`];
    for (const name of [tool, ...licenses]) {
      const fileName = windows && name === tool ? `${name}.exe` : name;
      const extracted = windows
        ? spawnSync(resolvePythonCommand(), ["-c", "import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))", archive, `${stem}/${fileName}`], { maxBuffer: 32 * 1024 * 1024 })
        : spawnSync("tar", ["-xOzf", archive, `${stem}/${fileName}`], { maxBuffer: 32 * 1024 * 1024 });
      if (extracted.error || extracted.status !== 0) throw new Error(`Cannot extract ${name}: ${extracted.error?.message ?? extracted.stderr}`);
      const relative = name === tool ? `${platform}/${fileName}` : `licenses/${tool}/${name}`;
      const packageRelative = name === tool ? `bin/${fileName}` : relative;
      const destination = join(packageRoot, packageRelative);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, extracted.stdout);
      await chmod(destination, name === tool ? 0o755 : 0o644);
      manifest.files[relative] = sha256(extracted.stdout);
      packageManifest.files[packageRelative] = sha256(extracted.stdout);
    }
  }
  await writeFile(join(packageRoot, "manifest.json"), `${JSON.stringify(packageManifest, null, 2)}\n`);
}
await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${target || "all"} platform npm packages with binaries, licenses, and SHA-256 manifests.`);
