#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEURO_UI_VERSION="${NEURO_UI_VERSION:-0.1.2}"

PI_FILES=(
  "$ROOT_DIR/.tools/node/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js"
)

# Patch the Pi package that `pi` resolves to for this user. This covers global
# installs in ~/.local, npm prefix installs, and project-local PATH overrides.
if command -v pi >/dev/null 2>&1; then
  PI_BIN="$(command -v pi)"
  PI_REAL="$(readlink -f "$PI_BIN" 2>/dev/null || realpath "$PI_BIN" 2>/dev/null || printf '%s' "$PI_BIN")"
  case "$PI_REAL" in
    */dist/cli.js)
      PI_ROOT="$(cd "$(dirname "$PI_REAL")/.." && pwd)"
      PI_FILES+=("$PI_ROOT/dist/modes/interactive/interactive-mode.js")
      ;;
  esac
fi

GLOBAL_PI_FILE="$HOME/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js"
if [[ -f "$GLOBAL_PI_FILE" ]]; then
  PI_FILES+=("$GLOBAL_PI_FILE")
fi

# De-duplicate while preserving order.
DEDUPED=()
for file in "${PI_FILES[@]}"; do
  seen=false
  for existing in "${DEDUPED[@]}"; do
    [[ "$existing" == "$file" ]] && seen=true && break
  done
  [[ "$seen" == false ]] && DEDUPED+=("$file")
done
PI_FILES=("${DEDUPED[@]}")

python3 - "$NEURO_UI_VERSION" "$ROOT_DIR/extensions/theme-cycler.ts" "${PI_FILES[@]}" <<'PY_PATCH'
import re
import sys
from pathlib import Path

version = sys.argv[1]
theme_path = Path(sys.argv[2])
pi_paths = [Path(p) for p in sys.argv[3:]]

if theme_path.exists():
    s = theme_path.read_text()
    s = s.replace("Ctrl+X          — Cycle theme forward", "Ctrl+Shift+X    — Cycle theme forward")
    s = s.replace('pi.registerShortcut("ctrl+x"', 'pi.registerShortcut("ctrl+shift+x"')
    theme_path.write_text(s)

vanilla_logo_template = 'const logo = theme.bold(theme.fg("accent", APP_NAME)) + theme.fg("dim", ` v${this.version}`);'
vanilla_logo_concat = 'const logo = theme.bold(theme.fg("accent", APP_NAME)) + theme.fg("dim", " v" + this.version);'
neuro_logo = f'''const neuroBrand = process.argv.some((arg) => arg.replaceAll("\\\\", "/").endsWith("extensions/neuro.ts"));
            const logo = neuroBrand
                ? theme.bold(theme.fg("accent", "NeuroScientist")) + theme.fg("dim", " v{version}")
                : theme.bold(theme.fg("accent", APP_NAME)) + theme.fg("dim", " v" + this.version);'''

vanilla_header = 'this.builtInHeader = new ExpandableText(() => `${logo}\\n${compactInstructions}\\n${compactOnboarding}\\n\\n${onboarding}`, () => `${logo}\\n${expandedInstructions}\\n\\n${onboarding}`, this.getStartupExpansionState(), 1, 0);'
neuro_header = '''this.builtInHeader = neuroBrand
                ? new ExpandableText(() => `${logo}\\n${compactInstructions}`, () => `${logo}\\n${expandedInstructions}`, this.getStartupExpansionState(), 1, 0)
                : new ExpandableText(() => `${logo}\\n${compactInstructions}\\n${compactOnboarding}\\n\\n${onboarding}`, () => `${logo}\\n${expandedInstructions}\\n\\n${onboarding}`, this.getStartupExpansionState(), 1, 0);'''

vanilla_loaded = '''this.loadedResourcesContainer.clear();
        const showListing = options?.force || this.options.verbose || !this.settingsManager.getQuietStartup();'''
neuro_loaded = '''this.loadedResourcesContainer.clear();
        if (process.argv.some((arg) => arg.replaceAll("\\\\", "/").endsWith("extensions/neuro.ts"))) {
            return;
        }
        const showListing = options?.force || this.options.verbose || !this.settingsManager.getQuietStartup();'''

neuro_logo_re = re.compile(
    r'''const neuroBrand = process\.argv\.some\(\(arg\) => arg\.replaceAll\("\\\\", "/"\)\.endsWith\("extensions/neuro\.ts"\)\);\n            const logo = neuroBrand\n                \? theme\.bold\(theme\.fg\("accent", "NeuroScientist"\)\) \+ theme\.fg\("dim", " v[^"]+"\)\n                : theme\.bold\(theme\.fg\("accent", APP_NAME\)\) \+ theme\.fg\("dim", " v" \+ this\.version\);'''
)

for p in pi_paths:
    if not p.exists():
        print(f"skip missing: {p}")
        continue
    s = p.read_text()
    s = neuro_logo_re.sub(vanilla_logo_concat, s)
    s = s.replace(vanilla_logo_template, neuro_logo)
    s = s.replace(vanilla_logo_concat, neuro_logo)
    s = s.replace(vanilla_header, neuro_header)
    s = s.replace(vanilla_loaded, neuro_loaded)
    p.write_text(s)
    print(f"patched: {p}")
PY_PATCH

NODE_BIN="$ROOT_DIR/.tools/node/bin/node"
if [[ -x "$NODE_BIN" ]]; then
  for file in "${PI_FILES[@]}"; do
    [[ -f "$file" ]] && "$NODE_BIN" --check "$file" >/dev/null
  done
fi

echo "NeuroScientist UI deployed: v${NEURO_UI_VERSION}"
echo "Run: pi -e extensions/neuro.ts -e extensions/theme-cycler.ts"
