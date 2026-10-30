#!/usr/bin/env bash
# Standalone installer: no Node, npm, sudo, or GitHub API required to bootstrap.
set -euo pipefail

# Parse the complete installer before children can read from a curl | bash pipe.
install_seekbrain() {
usage() {
  cat <<'EOF'
Usage: bash install.sh [options]
  --package <spec>      npm package/version, local .tgz, or source directory
                       (default: seekbrain)
  --tools-package <tgz> Local matching tool package for an offline release bundle
  --prefix <directory> Private runtime/app directory
  --bin-dir <directory> Command directory (default: ~/.local/bin)
  --offline            Use cached archives and npm packages only
  --no-modify-path     Do not add the command directory to shell startup files
  -h, --help           Show help

Environment:
  SEEKBRAIN_INSTALL_PREFIX  Default private runtime/app directory
  SEEKBRAIN_INSTALL_CACHE   Archive cache; pre-populate for offline installation
  SEEKBRAIN_NPM_CACHE       npm cache (also used with --offline)
  SEEKBRAIN_NPM_REGISTRY    Optional npm registry/mirror
  SEEKBRAIN_NODE_MIRROR     Node distribution root (contains v24.22.1/)

Supports Linux (glibc) and macOS, x86_64 and arm64; Windows users need WSL.
Installs Node 24, fd, rg, and SeekBrain under your user account.
Model credentials are configured separately with: seekbrain setup
EOF
}
say() { printf 'SeekBrain: %s\n' "$*"; }
die() { printf 'SeekBrain: %s\n' "$*" >&2; exit 1; }
absolute_dir() { mkdir -p "$1"; (cd "$1" && pwd -P); }
prefix=${SEEKBRAIN_INSTALL_PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/seekbrain/install}
bin_dir=$HOME/.local/bin
cache=${SEEKBRAIN_INSTALL_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/seekbrain/install}
package=seekbrain
tools_package=
offline=0
modify_path=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --package|--tools-package|--prefix|--bin-dir)
      [ "$#" -ge 2 ] && [ -n "$2" ] || die "Missing value for $1"
      case "$1" in
        --package) package=$2 ;;
        --tools-package) tools_package=$2 ;;
        --prefix) prefix=$2 ;;
        --bin-dir) bin_dir=$2 ;;
      esac
      shift 2 ;;
    --offline) offline=1; shift ;;
    --no-modify-path) modify_path=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done
case "$package" in -*) die "Invalid package spec: $package" ;; esac
case "$(uname -s)" in Linux) os=linux ;; Darwin) os=darwin ;; *) die 'Supported systems: Linux and macOS (Windows: use WSL).' ;; esac
case "$(uname -m)" in x86_64|amd64) arch=x64 ;; aarch64|arm64) arch=arm64 ;; *) die 'Supported architectures: x86_64 and arm64.' ;; esac
for cmd in tar mktemp awk chmod cp mkdir mv rm rmdir ln sed grep find; do command -v "$cmd" >/dev/null || die "Required command missing: $cmd"; done
if command -v sha256sum >/dev/null; then
  checksum() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null; then
  checksum() { shasum -a 256 "$1" | awk '{print $1}'; }
else
  die 'SHA-256 verification needs sha256sum or shasum.'
fi

# These hashes are pinned in the installer, including for mirror/cache downloads.
node_version=24.22.1
case "$os-$arch" in
  linux-x64)
    node_sha=eb6728e77c576a35162c122c45ccadf224d89ff00abc8dae46cc2897c6002d7c ;;
  linux-arm64)
    node_sha=33c37be234ba8bee041961047b19160f4d7d0f164e8e246f78bdd10feff148b3 ;;
  darwin-x64)
    node_sha=d132557e7ee2b85af08b0c8c34338e65c6430f2238d01f727728ef42dc83b035 ;;
  darwin-arm64)
    node_sha=89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7 ;;
esac
node_asset=node-v$node_version-$os-$arch.tar.gz
prefix=$(absolute_dir "$prefix")
bin_dir=$(absolute_dir "$bin_dir")
cache=$(absolute_dir "$cache")
for command in seekbrain seekbrain-014 seekbrain-pdf; do
  dest=$bin_dir/$command
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    grep -q '^# SeekBrain managed launcher$' "$dest" 2>/dev/null || die "Command already exists: $dest. Choose another --bin-dir."
  fi
done
mkdir -p "$prefix/releases"
# An atomic lock prevents concurrent installs from racing over current/launchers.
mkdir "$prefix/.install-lock" 2>/dev/null || die "Another installer is active. If it crashed, remove $prefix/.install-lock and retry."
stage=
committed=0
cleanup() {
  if [ "$committed" = 0 ] && [ -n "$stage" ]; then rm -rf "$stage"; fi
  rmdir "$prefix/.install-lock" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
stage=$(mktemp -d "$prefix/releases/install-XXXXXXXX")

fetch_archive() {
  local asset=$1 expected=$2 url target partial
  shift 2
  target=$cache/$asset
  if [ -f "$target" ]; then
    if [ "$(checksum "$target")" = "$expected" ]; then return; fi
    die "Cached archive failed SHA-256 verification: $target. Remove it and retry."
  fi
  [ "$offline" = 0 ] || die "Offline cache is missing $asset in $cache"
  command -v curl >/dev/null || die 'Downloading requires curl.'
  partial=$stage/$asset.part
  for url in "$@"; do
    say "Downloading $asset"
    if curl --fail --location --silent --show-error --retry 1 --retry-max-time 90 --connect-timeout 10 --max-time 90 "$url" -o "$partial"; then
      [ "$(checksum "$partial")" = "$expected" ] || die "SHA-256 mismatch for $asset; installation stopped."
      mv "$partial" "$target"
      return
    fi
  done
  die "Could not download $asset. Set SEEKBRAIN_NODE_MIRROR, or place the archive in $cache and retry."
}
if [ -n "${SEEKBRAIN_NODE_MIRROR:-}" ]; then
  fetch_archive "$node_asset" "$node_sha" "${SEEKBRAIN_NODE_MIRROR%/}/v$node_version/$node_asset"
else
  fetch_archive "$node_asset" "$node_sha" "https://nodejs.org/dist/v$node_version/$node_asset" "https://npmmirror.com/mirrors/node/v$node_version/$node_asset"
fi
say 'Preparing private Node 24 (fd and rg are included in the SeekBrain package)'
tar -xzf "$cache/$node_asset" -C "$stage"
node_dir=$stage/node-v$node_version-$os-$arch
ln -s "${node_dir##*/}" "$stage/runtime"
"$node_dir/bin/node" --version >/dev/null || die 'Node 24 cannot run on this system. Linux requires a supported glibc system (not Alpine/musl).'
export PATH="$node_dir/bin:$PATH"
npm_args=(install --global --prefix "$stage/npm" --no-audit --no-fund --omit=dev --include=optional)
[ "$offline" = 0 ] || npm_args+=(--offline)
[ -z "${SEEKBRAIN_NPM_REGISTRY:-}" ] || npm_args+=(--registry "$SEEKBRAIN_NPM_REGISTRY")
npm_args+=(--cache "${SEEKBRAIN_NPM_CACHE:-$cache/npm}")
# npm consumes a local source tree through a tarball, so global installation
# cannot leave a symlink back to a developer's checkout.
if [ -d "$package" ]; then
  package=$(cd "$package" && pwd -P)
  "$node_dir/bin/node" "$node_dir/lib/node_modules/npm/bin/npm-cli.js" pack "$package" --pack-destination "$stage" --ignore-scripts >/dev/null
  package=$(find "$stage" -maxdepth 1 -name '*.tgz' -print)
  [ -f "$package" ] || die 'Could not pack the source directory.'
elif [ -f "$package" ]; then
  package=$(cd "$(dirname "$package")" && pwd -P)/$(basename "$package")
fi
say 'Installing SeekBrain'
if [ -n "$tools_package" ]; then
  [ -f "$tools_package" ] || die "Tool package not found: $tools_package"
  tools_package=$(cd "$(dirname "$tools_package")" && pwd -P)/$(basename "$tools_package")
  npm_args+=("$tools_package")
fi
"$node_dir/bin/node" "$node_dir/lib/node_modules/npm/bin/npm-cli.js" "${npm_args[@]}" "$package"
entry=$stage/npm/lib/node_modules/seekbrain/bin/seekbrain.mjs
[ -f "$entry" ] || die 'The package does not contain the SeekBrain command.'
[ -f "$stage/npm/lib/node_modules/seekbrain/bin/seekbrain-pdf.mjs" ] || die 'The package does not contain the SeekBrain PDF command.'
"$node_dir/bin/node" "$entry" --version
"$node_dir/bin/node" --input-type=module - "$stage/npm/lib/node_modules/seekbrain" <<'JS'
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = process.argv[2];
const { configureBundledTools } = await import(pathToFileURL(join(root, 'src/cli/bundled-tools.mjs')));
configureBundledTools(process.env, root);
for (const tool of ['fd', 'rg']) {
  const result = spawnSync(tool, ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`Bundled ${tool} cannot run: ${result.error?.message ?? result.stderr}`);
  console.log(result.stdout.split('\n')[0]);
}
JS

# Keep the original system Node/npm untouched. Shell-quote paths including spaces
# and apostrophes, and pin the command to our Node even in a fresh login shell.
quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
write_launcher() {
  local command=$1 script=$2 dest=$bin_dir/$1
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    grep -q '^# SeekBrain managed launcher$' "$dest" 2>/dev/null || die "Command already exists: $dest. Choose another --bin-dir."
  fi
  {
    printf '#!/bin/sh\n# SeekBrain managed launcher\n'
    printf 'root=%s\n' "$(quote "$prefix")"
    printf 'export PATH="$root/current/runtime/bin:$PATH"\n'
    printf 'exec "$root/current/runtime/bin/node" "$root/current/npm/lib/node_modules/seekbrain/bin/%s" "$@"\n' "$script"
  } > "$stage/$command.launcher"
  chmod 755 "$stage/$command.launcher"
}
write_launcher seekbrain seekbrain.mjs
write_launcher seekbrain-014 seekbrain.mjs
write_launcher seekbrain-pdf seekbrain-pdf.mjs
# Check everything before switching away from the previously working install.
"$node_dir/bin/node" -e 'const fs = require("node:fs"); const [root, target] = process.argv.slice(1); const tmp = root + "/.current-" + process.pid; fs.symlinkSync(target, tmp); fs.renameSync(tmp, root + "/current");' "$prefix" "$stage"
committed=1
for command in seekbrain seekbrain-014 seekbrain-pdf; do
  cp "$stage/$command.launcher" "$bin_dir/.$command-install-$$"
  "$node_dir/bin/node" -e 'require("node:fs").renameSync(process.argv[1], process.argv[2])' "$bin_dir/.$command-install-$$" "$bin_dir/$command"
done
if [ "$modify_path" = 1 ]; then
  path_line="export PATH=$(quote "$bin_dir"):\$PATH # SeekBrain command"
  # .profile covers login shells; .bashrc and .zshrc cover interactive shells.
  for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
    if ! grep -Fqx "$path_line" "$rc" 2>/dev/null; then printf '\n%s\n' "$path_line" >> "$rc"; fi
  done
fi
say "Installed successfully: $bin_dir/seekbrain"
case ":$PATH:" in *":$bin_dir:"*) ;; *) say "For this terminal, run: export PATH=$(quote "$bin_dir"):\$PATH" ;; esac
say 'Next: seekbrain setup, then seekbrain'
if ! command -v python3 >/dev/null && ! command -v python >/dev/null; then
  say 'Python is not installed; Python analysis tasks will need Python separately.'
fi
}

install_seekbrain "$@"
