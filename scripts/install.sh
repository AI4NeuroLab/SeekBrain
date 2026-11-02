#!/usr/bin/env bash
# GitHub Release bootstrap. Parse the whole function before reading piped input.
set -euo pipefail
install_seekbrain_release() {
  say() { printf 'SeekBrain: %s\n' "$*"; }
  die() { printf 'SeekBrain: %s\n' "$*" >&2; exit 1; }
  quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
  usage() {
    cat <<'EOF'
SeekBrain GitHub Release installer (Linux glibc / macOS, x64 / arm64)
Installs private Node 24, Python, fd, rg and SeekBrain; no npm, Python or sudo needed.
  --version <version>   Pin a release, e.g. 0.1.4-preview.1 (default: latest stable)
  --prefix <directory>  Private app/runtime directory
  --bin-dir <directory> Command directory (default: ~/.local/bin)
  --cache <directory>   Archive cache
  --bundle <archive>    Install an already downloaded bundle (requires --version)
  --checksums <file>    SHA256SUMS for the local bundle
  --no-modify-path      Do not update shell startup files
  -h, --help            Show help

SEEKBRAIN_RELEASE_BASE_URL defaults to https://github.com/AI4NeuroLab/SeekBrain/releases
SEEKBRAIN_INSTALL_PREFIX and SEEKBRAIN_INSTALL_CACHE override default directories.
Source/npm package testing is available separately in scripts/install-package.sh.
EOF
  }
  version= bundle= checksums= modify_path=1
  prefix=${SEEKBRAIN_INSTALL_PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/seekbrain/install}
  bin_dir=$HOME/.local/bin
  cache=${SEEKBRAIN_INSTALL_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/seekbrain/install}
  base=${SEEKBRAIN_RELEASE_BASE_URL:-https://github.com/AI4NeuroLab/SeekBrain/releases}
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --version|--prefix|--bin-dir|--cache|--bundle|--checksums)
        [ "$#" -ge 2 ] && [ -n "$2" ] && [[ "$2" != --* ]] || die "Missing value for $1"
        case "$1" in
          --version) version=$2 ;; --prefix) prefix=$2 ;; --bin-dir) bin_dir=$2 ;;
          --cache) cache=$2 ;; --bundle) bundle=$2 ;; --checksums) checksums=$2 ;;
        esac
        shift 2 ;;
      --no-modify-path) modify_path=0; shift ;;
      -h|--help) usage; return ;;
      *) die "Unknown option: $1 (see --help)" ;;
    esac
  done
  case "$(uname -s)" in Linux) system=linux ;; Darwin) system=macos ;; *) die 'Use install.ps1 on native Windows.' ;; esac
  case "$(uname -m)" in x86_64|amd64) cpu=x64 ;; aarch64|arm64) cpu=arm64 ;; *) die 'Supported architectures: x64 and arm64.' ;; esac
  target=$system-$cpu
  internal_target=$target
  [ "$system" != macos ] || internal_target=darwin-$cpu
  for cmd in tar mktemp awk sed grep chmod mkdir mv rm rmdir ln cp tr readlink; do command -v "$cmd" >/dev/null || die "Required command missing: $cmd"; done
  if command -v sha256sum >/dev/null; then checksum() { sha256sum "$1" | awk '{print $1}'; }
  elif command -v shasum >/dev/null; then checksum() { shasum -a 256 "$1" | awk '{print $1}'; }
  else die 'SHA-256 verification requires sha256sum or shasum.'; fi
  [ -z "$bundle" ] || [ -n "$version" ] || die '--bundle requires --version and --checksums.'
  [ -z "$bundle" ] || [ -n "$checksums" ] || die '--bundle requires --checksums.'
  if [ -n "$version" ]; then
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$ ]] || die 'Invalid release version.'
  fi
  case "$prefix" in /*) ;; *) prefix=$PWD/$prefix ;; esac
  case "$bin_dir" in /*) ;; *) bin_dir=$PWD/$bin_dir ;; esac
  case "$cache" in /*) ;; *) cache=$PWD/$cache ;; esac
  mkdir -p "$prefix" "$bin_dir" "$cache"
  prefix=$(cd "$prefix" && pwd -P); bin_dir=$(cd "$bin_dir" && pwd -P); cache=$(cd "$cache" && pwd -P)
  for command in seekbrain seekbrain-014 seekbrain-pdf; do
    dest=$bin_dir/$command
    if [ -e "$dest" ] || [ -L "$dest" ]; then grep -q '^# SeekBrain managed launcher$' "$dest" 2>/dev/null || die "Command already exists: $dest"; fi
  done
  if [ -e "$prefix/current" ] || [ -L "$prefix/current" ]; then
    [ -L "$prefix/current" ] || die 'Existing current path is not a managed installation symlink.'
    case "$(readlink "$prefix/current")" in "$prefix"/releases/*) ;; *) die 'Existing current symlink is not owned by this installation.' ;; esac
  fi
  mkdir -p "$prefix/releases"
  mkdir "$prefix/.install-lock" 2>/dev/null || die 'Another installation is active (or left a stale .install-lock).'
  transaction= stage= created_env= committed=0 created_commands=
  cleanup() {
    if [ "$committed" = 0 ]; then
      [ -z "$stage" ] || rm -rf "$stage"
      [ -z "$created_env" ] || rm -rf "$created_env"
      for command in $created_commands; do rm -f "$bin_dir/$command"; done
    fi
    [ -z "$transaction" ] || rm -rf "$transaction"
    rm -f "$prefix/.current-$$"
    rmdir "$prefix/.install-lock" 2>/dev/null || true
  }
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  transaction=$(mktemp -d "$cache/.transaction-XXXXXXXX")
  fetch() {
    command -v curl >/dev/null || die 'Downloading requires curl.'
    curl --fail --location --silent --show-error --retry 2 --connect-timeout 15 --max-time 600 "$1" -o "$2" || die "Download failed: $1"
  }
  if [ -z "$version" ]; then
    fetch "${base%/}/latest/download/version.txt" "$transaction/version.txt"
    version=$(tr -d '\r\n' < "$transaction/version.txt")
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$ ]] || die 'Release metadata contains an invalid version.'
  fi
  asset=seekbrain-$version-$target.tar.gz
  if [ -z "$checksums" ]; then
    checksums=$transaction/SHA256SUMS
    fetch "${base%/}/download/v$version/SHA256SUMS" "$checksums"
  fi
  [ -f "$checksums" ] || die 'Checksum file not found.'
  expected=$(awk -v asset="$asset" 'NF == 2 && $2 == asset && length($1) == 64 && $1 ~ /^[0-9a-f]+$/ { print $1 }' "$checksums")
  [ "${#expected}" -eq 64 ] || die "Missing or ambiguous SHA-256 for $asset"
  if [ -z "$bundle" ]; then
    bundle=$cache/$asset
    if [ ! -f "$bundle" ] || [ "$(checksum "$bundle")" != "$expected" ]; then
      say "Downloading $asset"
      fetch "${base%/}/download/v$version/$asset" "$transaction/$asset"
      [ "$(checksum "$transaction/$asset")" = "$expected" ] || die 'SHA-256 mismatch; the current installation was preserved.'
      mv "$transaction/$asset" "$bundle"
    fi
  fi
  [ -f "$bundle" ] || die "Bundle not found: $bundle"
  [ "$(checksum "$bundle")" = "$expected" ] || die 'SHA-256 mismatch; remove the cached archive and retry.'
  stage=$(mktemp -d "$prefix/releases/$version-XXXXXXXX")
  say "Preparing SeekBrain $version ($target)"
  tar -xzf "$bundle" -C "$stage"
  node=$stage/runtime/node/bin/node
  [ -x "$node" ] || die 'Bundle is missing its private Node runtime.'
  "$node" "$stage/verify-release.mjs" --target "$internal_target" --version "$version" || die 'Bundle validation failed; Linux requires supported glibc (not Alpine/musl).'
  python_version=$("$node" -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).python.version' "$stage/bundle.json")
  [[ "$python_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die 'Invalid Python version in bundle.'
  environment=$prefix/environments/python-$python_version
  if [ ! -e "$environment" ]; then
    mkdir -p "$prefix/environments"
    created_env=$environment
    "$stage/runtime/python/bin/python3" -I -m venv "$environment"
  fi
  "$environment/bin/python" -I -c 'import ssl,sqlite3; print("Private Python is ready")'
  for command in seekbrain seekbrain-014 seekbrain-pdf; do
    pdf_arg=
    [ "$command" != seekbrain-pdf ] || pdf_arg='--pdf-command '
    launcher=$transaction/$command
    {
      printf '#!/bin/sh\n# SeekBrain managed launcher\n'
      printf 'root=%s\nexport SEEKBRAIN_INSTALL_PREFIX="$root"\n' "$(quote "$prefix")"
      printf 'if [ -x "$root/current/runtime/node/bin/node" ]; then\n'
      printf '  exec "$root/current/runtime/node/bin/node" "$root/current/launch.mjs" %s"$@"\n' "$pdf_arg"
      printf 'fi\n'
      script=seekbrain.mjs; [ "$command" != seekbrain-pdf ] || script=seekbrain-pdf.mjs
      printf 'exec "$root/current/runtime/bin/node" "$root/current/npm/lib/node_modules/seekbrain/bin/%s" "$@"\n' "$script"
    } > "$launcher"
    chmod 755 "$launcher"
    [ -e "$bin_dir/$command" ] || created_commands="$created_commands $command"
    cp "$launcher" "$bin_dir/.$command-install-$$"
    "$node" -e 'require("node:fs").renameSync(process.argv[1],process.argv[2])' "$bin_dir/.$command-install-$$" "$bin_dir/$command"
  done
  "$node" -e 'const fs=require("node:fs");const [root,target]=process.argv.slice(1);const tmp=root+"/.current-"+process.ppid;fs.symlinkSync(target,tmp);fs.renameSync(tmp,root+"/current")' "$prefix" "$stage"
  committed=1
  if [ "$modify_path" = 1 ]; then
    path_line="export PATH=$(quote "$bin_dir"):\$PATH # SeekBrain command"
    for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
      if ! grep -Fqx "$path_line" "$rc" 2>/dev/null; then
        if ! printf '\n%s\n' "$path_line" >> "$rc"; then say "Add $bin_dir to your PATH manually."; fi
      fi
    done
  fi
  say "Installed: $bin_dir/seekbrain"
  say "Next: $(quote "$bin_dir/seekbrain") setup"
  say 'Open a new terminal to use seekbrain from PATH. Existing model configuration is retained.'
}
install_seekbrain_release "$@"
