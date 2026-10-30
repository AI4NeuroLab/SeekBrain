# Bundled search tools

SeekBrain uses five optional npm packages for fd 10.3.0 and ripgrep 14.1.1 on
Linux/macOS x64/arm64 and native Windows x64. npm installs only the matching package. The CLI resolves
that dependency and prepends its bin/ directory to PATH before starting Pi and
its subagents. No postinstall scripts or first-run downloads are needed.
Unsupported platforms retain Pi's existing system-tool behavior; the standalone
shell installer supports Linux/macOS and WSL; `scripts/install.ps1` targets native Windows x64.

The MIT license option is used for both tools. Full upstream license and
copyright texts are included under each tool package's `licenses/` directory.
Binaries are unmodified. This metadata directory contains no binaries.

For maintainers: `manifest.json` lists fixed upstream archive URLs and SHA-256
values. Download those ten archives into a directory, then run:

```bash
node scripts/bundle-tools.mjs /path/to/archives
```

Use `--target win32-x64` to update only the Windows package. Windows ZIP extraction
uses Python's standard-library zipfile; the maintainer therefore needs Python.
Archive hashes are verified before extracting any files.

The script checks pinned archive hashes, extracts binaries and licenses into
`packages/seekbrain-tools-<platform>/`, and generates their package metadata and
checksum manifests. Commit those directories and this metadata together.
Source checkouts resolve the local packages; installed releases resolve npm
dependencies and report a missing-package error when optional dependencies
have been omitted.

Prepare release tarballs and update lockfile integrity values:

```bash
node scripts/pack-tool-packages.mjs /path/to/release --update-lock
```

Publish the five generated tool tarballs before publishing the main package.
Package names are provisional until published under an account that owns them.
The main npm tarball excludes packages/ and all platform binaries. Do not edit
or repack a tool release after publishing; increment its version in
`src/cli/tool-packages.mjs` and main optionalDependencies when updating tools.
Users do not run these maintainer scripts.
