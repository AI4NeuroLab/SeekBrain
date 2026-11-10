# GitHub installation bundles

The five targets are Linux x64/arm64, macOS Intel/Apple Silicon, and Windows x64.
Every archive contains the CLI, private Node 24 and Python, production npm
libraries and only its matching fd/rg platform package. Windows additionally
downloads pinned official PortableGit during installation. Users do not need npm,
Git Bash or Python preinstalled. Scientific libraries remain analysis-specific.
Linux requires glibc; Alpine/musl is not a target. Windows requires x64
PowerShell 5.1+ on a modern Windows version with system tar.exe.

Public Release assets and website install commands are not live yet. This work
builds and validates installation bundles without publishing npm or a Release.
The website can later host the generated install.sh/install.ps1 with stable URLs;
they resolve version.txt and select the correct GitHub Release artifact.

## Build on each target

Use a native runner with Node 24.22.1 and npm. Do not copy native npm libraries
between OSes or CPU architectures.

```sh
npm ci --include=optional
npm run test:installers
npm run release:build -- --version 0.1.4-preview.1 --cli-only --output releases/ci
```

The default build and CI feature-branch builds include CLI + Web UI assets and requires `npm --prefix web ci`
followed by `npm run web:build` first. The UI font is stored with its license
in the repository, so this build does not need a Google Fonts request. `--cli-only` explicitly omits that UI.
Bundles provide CLI/PDF commands in either mode; CLI-only bundles explain the
missing UI if a user invokes `seekbrain web`.

`release/targets.json` pins official runtime archives and their checksums.
The build verifies them before extraction, runs production npm ci against the
lockfile, includes the source tool package without fetching unpublished packages,
and verifies real SDK loading before producing the archive. npm's project
allowScripts policy explicitly permits node-pty/protobufjs installation hooks.

Useful options: `--cache`, `--npm-cache`, `--work-dir`, `--offline`, `--keep-work`.
Offline builds require every runtime archive and npm dependency in those caches.
A .sha256 sidecar and target metadata JSON accompany each archive.

The Build installation bundles workflow supports the five native targets.
A feature-branch push validates all five targets with the production Web UI;
manual dispatch can select a single target or all five. A feature-branch
commit containing `[windows]` runs only Windows while diagnosing that platform. Actions artifacts are validation downloads, not public Releases.

## Collect the release files

Copy the five archives and target JSON files into the same directory, then run:

```sh
npm run release:collect -- releases/collected
```

The collector rejects missing platforms, modified archives, dirty source builds,
and differences in source commit, version or Web UI mode. It creates SHA256SUMS,
release-manifest.json, version.txt and both bootstrap scripts. Development-only
partial builds require `--allow-partial`; dirty builds require `--allow-dirty`.
Do not publish a partial validation set as a five-platform release.

## Validate installation locally

First collect the built artifact with `--allow-partial --allow-dirty` if using a
local development checkout. Then, from the directory containing the archives:

```sh
bash /path/to/SeekBrain/scripts/install.sh --version 0.1.4-preview.1 \
  --bundle ./seekbrain-0.1.4-preview.1-linux-x64.tar.gz \
  --checksums ./SHA256SUMS --prefix "$HOME/.local/share/seekbrain-preview" \
  --bin-dir "$HOME/.local/bin"
```

On Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install.ps1 `
  -Version 0.1.4-preview.1 -Bundle .\seekbrain-0.1.4-preview.1-windows-x64.zip `
  -Checksums .\SHA256SUMS -Prefix "$env:LOCALAPPDATA\SeekBrainPreview"
```

Windows still needs network access or a verified cached PortableGit archive.
The installer validates the new directory before switching the current pointer.
Download or preparation failures preserve the existing release. If a Release
asset has been replaced under the same version, the installer refreshes an
outdated cached archive against the current SHA256SUMS before preparing it. Existing model
configuration remains in place. A versioned private Python venv persists across
app upgrades, so installed analysis libraries survive. Explicit SEEKBRAIN_PYTHON
and activated venv/Conda environments take precedence over the fallback Python.
Previous releases are retained because the venv may reference an earlier runtime;
do not manually delete them without recreating the environment.

## Automated acceptance

### Windows download progress and mirrors (0.1.5)

The Windows installer uses the system `curl.exe` progress meter, showing bytes,
percentage, speed and estimated time. Failed transfers retry up to three times
per source. Archive partial files remain in the cache and resume when the same
installer is rerun. Their filenames include the expected SHA-256, and every
completed archive is verified before it can replace an installed release.
Servers without HTTP Range support trigger a fresh transfer.

An optional organization-controlled HTTPS mirror is configured with `-Mirror`
or `SEEKBRAIN_DOWNLOAD_MIRROR`. It is tried before GitHub/the official Git Bash
source, and failures fall back automatically. No third-party mirror is enabled
by default. Example (replace the example hostname with your actual mirror):

```powershell
$env:SEEKBRAIN_DOWNLOAD_MIRROR = 'https://downloads.example.org/seekbrain'
irm "$env:SEEKBRAIN_DOWNLOAD_MIRROR/download/v0.1.5/install.ps1" | iex
```

Upload the entire verified release asset set, plus the pinned PortableGit archive,
with this layout relative to the mirror root:

```text
download/v0.1.5/install.ps1
download/v0.1.5/SHA256SUMS
download/v0.1.5/seekbrain-0.1.5-windows-x64.zip
download/v0.1.5/...                    # Remaining release assets
latest/download/version.txt          # Contains 0.1.5
upstream/PortableGit-2.56.0.4-64-bit.7z.exe
```

Upload versioned files first, check their hashes and anonymous HTTPS downloads,
then update `latest/download/version.txt` last. Use standard storage with public
read access to the release files and private write access. A COS storage endpoint
can host this prefix directly; a CDN can be introduced later. The installer and
its checksum metadata must come from a trusted distribution source.

`node --test tests/windows-download.mjs` exercises the production PowerShell
download functions against local HTTP fixtures on Windows, including interrupted
streams, persisted partial files, ignored Range headers and mirror failures.

Set SEEKBRAIN_TEST_RELEASE_DIR to the directory containing a real artifact and
its target JSON, then run `npm run test:installers`. The test serves the archive
through a local HTTP endpoint and checks fresh install, CLI startup, upgrade,
configuration/environment preservation and rollback after a checksum failure.
SEEKBRAIN_TEST_ROOT can place large temporary installs on a filesystem with room.

Native Windows/macOS/ARM builds, interactive terminal behavior and an authenticated
analysis remain necessary before claiming full support on those platforms.

## Prepare a Release and website entry

After all five native jobs pass, download the combined
`seekbrain-installation-bundles` Actions artifact. Keep its archives, version.txt,
release-manifest.json, SHA256SUMS and bootstrap scripts together. Check that
release-manifest.json says complete=true and features.web=true for every target.
The source commit must match the intended release commit.

Create a GitHub **draft** Release for that exact version and attach the generated
files. A preview tag such as v0.1.4-preview.1 is for explicit-version testing;
the installer's default latest endpoint is for stable Releases. Publish only
after the downloads and clean-install behavior have been reviewed.

The source repository's main README remains unchanged by this installer branch.
Website integration belongs in AI4NeuroLab/SeekBrain-page. Copy the generated
install.sh and install.ps1 to its published root; these scripts download the
platform archive from AI4NeuroLab/SeekBrain Releases. Once the stable Release and
website files are live, the user-facing commands are:

```sh
curl -fsSL https://ai4neurolab.github.io/SeekBrain-page/install.sh | bash
```

```powershell
irm https://ai4neurolab.github.io/SeekBrain-page/install.ps1 | iex
```

These website URLs are the planned handoff, not a claim that the files have
already been deployed. Re-running the command installs the current stable
version while retaining model configuration and the private Python environment.
