# NeuroScientist UI Customization Notes

Date: 2026-07-09

This note records the UI customization made for launching the NeuroScientist Pi
extension with:

```bash
pi -e extensions/neuro.ts -e extensions/theme-cycler.ts
```

## Goal

The default Pi startup screen exposed too much generic Pi metadata before the
NeuroScientist workflow UI appeared. The requested startup behavior was:

1. hide the startup resource summary from `Pi can explain...` through the
   `[Extension issues]` block,
2. replace the top banner from `pi v0.80.3` to `NeuroScientist v0.1.2`,
3. remove the startup warning caused by the `theme-cycler.ts` shortcut conflict.

## User-Visible Result

When Pi is launched with `extensions/neuro.ts`, the compact header should now
show the NeuroScientist brand:

```text
NeuroScientist v0.1.2
escape interrupt · ctrl+c/ctrl+d clear/exit · / commands · ! bash · ctrl+o more
```

The following startup sections are suppressed for the NeuroScientist launch:

```text
Pi can explain its own features and look up its docs...
[Context]
[Skills]
[Prompts]
[Extensions]
[Themes]
[Extension issues]
```

The regular NeuroScientist extension UI, `/neuro` selector, workflow dashboard,
status line, and theme status are unchanged.

## Files Changed

### 1. Theme shortcut conflict

File:

```text
/mnt/shared-storage-gpfs2/ai4neuro-share/zhuyuqing/neuro-pi-agent/extensions/theme-cycler.ts
```

Change:

```text
ctrl+x       -> ctrl+shift+x
Ctrl+X docs  -> Ctrl+Shift+X docs
```

Reason:

`ctrl+x` conflicts with Pi's built-in `app.models.clearAll` shortcut. Pi reports
that conflict in the startup `[Extension issues]` section. Changing the theme
cycler forward shortcut removes the warning at the source instead of merely
hiding it.

Current theme shortcuts:

```text
Ctrl+Shift+X  cycle theme forward
Ctrl+Q        cycle theme backward
/theme        select or set a theme
```

### 2. Project-local Pi package UI patch

File:

```text
/mnt/shared-storage-gpfs2/ai4neuro-share/zhuyuqing/neuro-pi-agent/.tools/node/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js
```

Change:

- Detect NeuroScientist launches by checking whether `process.argv` contains an
  extension path ending in `extensions/neuro.ts`.
- If detected, render the startup logo as:

```text
NeuroScientist v0.1.2
```

- If detected, use a compact header that excludes the generic Pi onboarding
  text.
- If detected, return early from `showLoadedResources()`, which suppresses the
  startup resource and diagnostics blocks.

Important implementation detail:

The patch is conditional. Plain Pi launches or other extensions still use the
normal Pi name, Pi version, onboarding text, and loaded-resource diagnostics.

### 3. Global Pi package UI patch

File:

```text
/home/zhuyuqing-p/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js
```

Same conditional UI patch as above.

Reason:

The command `pi` resolves to:

```text
/home/zhuyuqing-p/.local/bin/pi
```

That executable uses the global package under:

```text
/home/zhuyuqing-p/.local/lib/node_modules/@earendil-works/pi-coding-agent
```

Therefore patching only the project-local `.tools/node` copy is not enough for
the user's direct command. Both copies were patched to keep behavior consistent.

## Exact Behavior Gate

The branding and startup hiding only apply when this check is true:

```js
process.argv.some((arg) => arg.replaceAll("\\", "/").endsWith("extensions/neuro.ts"))
```

This means the customization is tied to the NeuroScientist extension rather than
all Pi sessions.

## Deployment Scripts

Two helper scripts make the UI patch reproducible:

```bash
./scripts/deploy_neuro_ui.sh
./scripts/restore_pi_ui.sh
```

`deploy_neuro_ui.sh` applies the NeuroScientist branding patch, hides startup
resources for `extensions/neuro.ts`, and changes the theme-cycler forward
shortcut to `Ctrl+Shift+X`.

`restore_pi_ui.sh` removes the NeuroScientist core-package patch and restores
Pi's default startup UI. It also restores the theme-cycler forward shortcut to
`Ctrl+X`, which may show Pi's original shortcut conflict warning if the theme
cycler extension is loaded.

The deploy script accepts an optional display version:

```bash
NEURO_UI_VERSION=0.1.2 ./scripts/deploy_neuro_ui.sh
```

## Verification Performed

Syntax checks were run with the project Node binary:

```bash
.tools/node/bin/node --check .tools/node/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js

.tools/node/bin/node --check /home/zhuyuqing-p/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js
```

Both checks passed.

A short `pi -e extensions/neuro.ts -e extensions/theme-cycler.ts` startup smoke
test was also run with a timeout. It did not produce a syntax/runtime startup
crash before timeout.

## Known Limitations

This is currently a direct patch to installed Pi package files, not a clean
extension-level API change. That was necessary because the startup banner,
onboarding text, loaded resource list, and `[Extension issues]` diagnostics are
rendered by Pi core before ordinary extension widgets can control them.

Consequences:

1. Updating or reinstalling Pi can overwrite this patch.
2. The patch is environment-specific because the global package path is under
   `/home/zhuyuqing-p/.local/lib/node_modules`.
3. For a GitHub release, this should not remain as an undocumented manual edit
   to `node_modules`.

## Recommended Long-Term Packaging

For a released NeuroScientist project, prefer one of these approaches:

1. Provide a small wrapper command, for example `neuro-pi`, that launches Pi
   with NeuroScientist defaults and applies/validates the UI patch during setup.
2. Maintain a minimal fork or patch file for `@earendil-works/pi-coding-agent`
   and apply it through a reproducible install script.
3. Upstream a proper Pi option/API for startup branding and startup resource
   visibility, then remove the direct package patch.

For the current testing phase, the direct conditional patch is acceptable because
it is small, isolated, and only activates for `extensions/neuro.ts` launches.
