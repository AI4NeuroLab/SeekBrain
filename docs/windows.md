# Windows CLI support

Native Windows x64 support is implemented for validation. Windows desktop and
installation checks must pass before calling this a supported release. Linux,
macOS and WSL remain available. Windows ARM64 native support is not included.

## Requirements

- 64-bit Windows, initially targeting Windows 11.
- Git for Windows, including Git Bash. PowerShell can launch SeekBrain; analysis
  commands inside the agent use Git Bash.
- Python 3 with the libraries required by the selected analysis.
- Node.js >=22.19, preferably Node 24, for source development. The PowerShell
  installer prepares its own pinned Node 24 runtime.
- Windows Terminal for interactive CLI validation.

Installing Git Bash does not install a Linux scientific toolchain. Recipes that
depend on Linux binaries or container images still need their documented WSL or
container environment. Do not mix Windows Node/Python with WSL Bash and paths.

## Run from source

The new platform package is included under `packages/seekbrain-tools-win32-x64`.
Source checkouts use this copy when the unpublished optional npm package cannot
be resolved. No startup download of fd or ripgrep is needed.

```powershell
npm ci --include=optional
node bin/seekbrain.mjs doctor
node bin/seekbrain.mjs setup
node bin/seekbrain.mjs --cwd 'D:\Research Project'
```

Use an activated venv/Conda environment, or set an absolute interpreter path:

```powershell
$env:SEEKBRAIN_PYTHON = 'D:\Research Project\.venv\Scripts\python.exe'
node bin/seekbrain.mjs doctor
```

An explicit `SEEKBRAIN_PYTHON` takes precedence over active environments. Without
it, an active venv takes precedence over Conda, followed by system Python.
Automatic dependency installation uses the same selected interpreter. For an
explicit interpreter, pip chooses its own environment install scheme; SeekBrain
does not force `--user` into an explicitly selected venv.

Git Bash normally lives under `C:\Program Files\Git\bin\bash.exe`. If installed
elsewhere, set Pi's `shellPath` in `~/.pi/agent/settings.json`:

```json
{"shellPath":"D:\\Git\\bin\\bash.exe"}
```

Main sessions and SeekBrain subagents share the effective shell path and command
prefix. In generated bash commands, `"$SEEKBRAIN_PYTHON"` selects the configured
interpreter safely when its path contains spaces.

## Install a local release

The main package and all platform packages remain unpublished. Build the tool
tarballs on the maintainer machine first:

```text
node scripts/pack-tool-packages.mjs <release-directory> --update-lock
```

On Windows, use the main source directory or tarball plus the matching tool
tarball:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install.ps1 `
  -Package . `
  -ToolsPackage 'D:\release\seekbrain-tools-win32-x64-0.1.0.tgz'
```

The installer verifies the pinned official Node archive with SHA-256, installs
into `%LOCALAPPDATA%\SeekBrain`, and adds its `bin` directory to the user PATH.
It creates `.cmd` launchers for `seekbrain`, `seekbrain-014`, and `seekbrain-pdf`.
Open a new terminal after installing. `-NoModifyPath` leaves user PATH alone.
No administrator rights, symlinks or developer mode are required by the installer.

Updates prepare a separate version directory, verify the package tools, and
atomically replace `current.cmd`. A failed preparation preserves the previous
release. Concurrent installers use a lock file; previous successful releases
are retained. The installer refuses to replace commands it does not own.

`-Offline` requires the matching Node ZIP under the cache directory, all required
npm dependencies in its `npm` cache, and local unpublished tool/main packages.
`-Cache`, `SEEKBRAIN_NODE_MIRROR`, and `SEEKBRAIN_NPM_REGISTRY` select cache/mirror
locations. `-Help` describes the options without starting installation.

## Validation

The Windows CI workflow verifies dependency installation, type checking, native
tool discovery, CLI/setup contracts, local npm platform selection, interpreter
selection, subagent shell settings, and PDF regressions. Windows-only checks
exercise Git Bash with Python in a directory containing Chinese characters and
spaces, PDF output, process-tree cancellation, and installer failure recovery.

Run its focused checks on Windows:

```powershell
node --test tests/platform-runtime.mjs tests/bundled-tools.mjs tests/tool-package-selection.mjs tests/phase0-package-cli.mjs tests/setup-cli.mjs tests/windows-runtime.mjs tests/windows-installer.mjs
npx --no-install vitest run tests/unit/dependency-install.test.ts tests/unit/existing-pi-agent-adapter.test.ts tests/unit/report-pdf-exporter.test.ts
```

Before release, additionally validate a clean standard-user installation and
upgrade, an authenticated full analysis and resume, and interactive Chinese IME,
paste, Shift+Enter, Ctrl+C, window resizing and terminal restoration. These
desktop checks cannot be replaced by Linux simulations or a headless CI runner.

### Local verification on 2026-10-29

Verified on Linux with Node 24.22.1:

- TypeScript checking passed.
- All 74 Vitest files passed: 468 unit tests.
- The complete shared CLI contract runner passed. Windows-only tests were
  skipped, as was the opt-in full Unix installer test.
- The npm package manifest passed; all five tool packages were packed and their
  lockfile integrity values updated.
- The real main tarball and matching Linux tool tarball installed into a
  temporary global prefix. CLI launch, package-owned Pi resources, report PDF,
  and non-interactive argument forwarding worked outside the source checkout.
- Portable PowerShell 7.4.6 on Linux parsed the installer and verified its help,
  launcher pointer construction, atomic file replacement and Node argument
  forwarding. This caught and fixed PowerShell's null-to-empty-string conversion
  at the .NET file replacement boundary.

The initial offline tarball-install check lacked cached npm metadata. The online
installation check subsequently passed. This does not establish that an
arbitrary existing cache is ready for offline installation.

No native Windows CI job or Windows desktop acceptance test was executed in this
Linux workspace. PowerShell 5.1 installation and native Windows runtime behavior
remain pending the Windows workflow and desktop checks above.
