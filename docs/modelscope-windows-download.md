# Independent Windows download commands

The website and the GitHub installer remain unchanged. Users choose one of two
independent entry points; neither command silently switches to the other service.

ModelScope (Windows PowerShell):

```powershell
irm https://www.modelscope.cn/datasets/SeekBrain/seekbrain-releases/resolve/master/install.ps1 | iex
```

Original website/GitHub command (Windows PowerShell):

```powershell
irm https://github.com/AI4NeuroLab/SeekBrain/releases/latest/download/install.ps1 | iex
```

The ModelScope entry downloads the script, release metadata, Windows ZIP and
PortableGit from `SeekBrain/seekbrain-releases`. It ignores inherited
`SEEKBRAIN_RELEASE_BASE_URL` / `SEEKBRAIN_DOWNLOAD_MIRROR` preferences so that a
previous setting cannot silently select GitHub. A failed default ModelScope
download reports the failure and retains resumable archive bytes. It does not
fall back to GitHub. The GitHub entry retains its existing behavior and defaults
to GitHub; the website's download links and command were not modified.

The mirrored Windows ZIP and PortableGit archive are byte-identical to their
official pinned SHA-256 values. Only the mirror bootstrap script's source URLs
and corresponding installer checksum differ. `UPSTREAM-SHA256SUMS` preserves the
original GitHub checksum list. The mirror currently covers Windows x64 only.

## Prepare a future mirror update

Download and verify the release assets and pinned PortableGit archive, then run:

```sh
node scripts/prepare-modelscope-windows-mirror.mjs RELEASE_DIRECTORY PORTABLE_GIT_ARCHIVE OUTPUT_DIRECTORY
```

The generator rejects checksum mismatches before copying files, produces a
separate ModelScope installer and checksum list, and leaves the GitHub script
unchanged. Upload only the generated output tree to the dataset repository,
preserving existing README content. Keep upload tokens outside the output tree;
downloads do not require tokens. Publish `latest/download/version.txt` after all
required versioned files are available.

Repository: https://www.modelscope.cn/datasets/SeekBrain/seekbrain-releases

## Verification on 2026-11-10

All 13 mirrored files were downloaded anonymously and their complete SHA-256
values matched local verified files. Both large archives returned correct HTTP
206 ranges and byte content for resume requests. The 247,497,487-byte Windows
ZIP downloaded in 17 seconds from this development machine; this is one measured
connection, not a guarantee for other networks.

The complete report is `releases/modelscope-mirror-verification.json`.
Native Windows validation: https://github.com/AI4NeuroLab/SeekBrain/actions/runs/42791086648
