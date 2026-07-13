#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PI_FILES=(
  "$ROOT_DIR/.tools/node/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js"
)

GLOBAL_PI_FILE="$HOME/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js"
if [[ -f "$GLOBAL_PI_FILE" ]]; then
  PI_FILES+=("$GLOBAL_PI_FILE")
fi

python3 - "$ROOT_DIR/extensions/theme-cycler.ts" "${PI_FILES[@]}" <<'PY_PATCH'
import re
import sys
from pathlib import Path

theme_path = Path(sys.argv[1])
pi_paths = [Path(p) for p in sys.argv[2:]]

if theme_path.exists():
    s = theme_path.read_text()
    s = s.replace("Ctrl+Shift+X    — Cycle theme forward", "Ctrl+X          — Cycle theme forward")
    s = s.replace('pi.registerShortcut("ctrl+shift+x"', 'pi.registerShortcut("ctrl+x"')
    theme_path.write_text(s)

vanilla_logo = 'const logo = theme.bold(theme.fg("accent", APP_NAME)) + theme.fg("dim", ` v${this.version}`);'
vanilla_header = 'this.builtInHeader = new ExpandableText(() => `${logo}\\n${compactInstructions}\\n${compactOnboarding}\\n\\n${onboarding}`, () => `${logo}\\n${expandedInstructions}\\n\\n${onboarding}`, this.getStartupExpansionState(), 1, 0);'
neuro_header = '''this.builtInHeader = neuroBrand
                ? new ExpandableText(() => `${logo}\\n${compactInstructions}`, () => `${logo}\\n${expandedInstructions}`, this.getStartupExpansionState(), 1, 0)
                : new ExpandableText(() => `${logo}\\n${compactInstructions}\\n${compactOnboarding}\\n\\n${onboarding}`, () => `${logo}\\n${expandedInstructions}\\n\\n${onboarding}`, this.getStartupExpansionState(), 1, 0);'''
neuro_loaded = '''this.loadedResourcesContainer.clear();
        if (process.argv.some((arg) => arg.replaceAll("\\\\", "/").endsWith("extensions/neuro.ts"))) {
            return;
        }
        const showListing = options?.force || this.options.verbose || !this.settingsManager.getQuietStartup();'''
vanilla_loaded = '''this.loadedResourcesContainer.clear();
        const showListing = options?.force || this.options.verbose || !this.settingsManager.getQuietStartup();'''
neuro_logo_re = re.compile(
    r'''const neuroBrand = process\.argv\.some\(\(arg\) => arg\.replaceAll\("\\\\", "/"\)\.endsWith\("extensions/neuro\.ts"\)\);\n            const logo = neuroBrand\n                \? theme\.bold\(theme\.fg\("accent", "NeuroScientist"\)\) \+ theme\.fg\("dim", " v[^"]+"\)\n                : theme\.bold\(theme\.fg\("accent", APP_NAME\)\) \+ theme\.fg\("dim", " v" \+ this\.version\);'''
)

for p in pi_paths:
    if not p.exists():
        print(f"skip missing: {p}")
        continue
    s = p.read_text()
    s = neuro_logo_re.sub(vanilla_logo, s)
    s = s.replace(neuro_header, vanilla_header)
    s = s.replace(neuro_loaded, vanilla_loaded)
    p.write_text(s)
    print(f"restored: {p}")
PY_PATCH

NODE_BIN="$ROOT_DIR/.tools/node/bin/node"
if [[ -x "$NODE_BIN" ]]; then
  for file in "${PI_FILES[@]}"; do
    [[ -f "$file" ]] && "$NODE_BIN" --check "$file" >/dev/null
  done
fi

echo "Pi startup UI restored."
