#!/usr/bin/env bash
# ============================================================================
# pi_install.sh
#
# Install Node.js 24 and the @earendil-works/pi-coding-agent package locally
# inside the project. Nothing is installed system-wide.
#
# Usage:
#   ./pi_install.sh
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"
TOOLS_DIR="${ROOT_DIR}/.tools"
NODE_DIR="${TOOLS_DIR}/node"
NODE_BIN="${NODE_DIR}/bin"

NODE_VERSION="v24.18.0"
NODE_MIN_MAJOR=22
NODE_MIN_MINOR=19
NODE_MIN_PATCH=0
NODE_DISTRO="linux-x64"
NODE_TARBALL="node-${NODE_VERSION}-${NODE_DISTRO}.tar.xz"
NODE_MIRROR="https://npmmirror.com/mirrors/node/"
NODE_URL="${NODE_MIRROR}${NODE_VERSION}/${NODE_TARBALL}"
NPM_REGISTRY="https://registry.npmmirror.com/"

PI_MIN_VERSION="0.80.2"

mkdir -p "${TOOLS_DIR}"

# ---------- helper: compare two dotted version strings ----------
version_ge() {
  # Returns 0 (true) if $1 >= $2, otherwise 1 (false).
  local a="$1" b="$2"
  if [[ "$a" == "$b" ]]; then
    return 0
  fi
  local sorted
  sorted=$(printf '%s\n%s\n' "$a" "$b" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)
  [[ "$sorted" == "$b" ]]
}

# ---------- check / install Node.js ----------
NEED_NODE_INSTALL=true
if [[ -x "${NODE_BIN}/node" ]]; then
  EXISTING_NODE_VER="$("${NODE_BIN}/node" --version | sed 's/^v//')"
  if version_ge "${EXISTING_NODE_VER}" "${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}.${NODE_MIN_PATCH}"; then
    echo "[pi_install] Node.js ${EXISTING_NODE_VER} already installed and meets minimum (>= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}.${NODE_MIN_PATCH}). Skipping."
    NEED_NODE_INSTALL=false
  else
    echo "[pi_install] Node.js ${EXISTING_NODE_VER} is too old (need >= ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}.${NODE_MIN_PATCH}). Reinstalling..."
    rm -rf "${NODE_DIR}"
  fi
fi

if [[ "${NEED_NODE_INSTALL}" == "true" ]]; then
  echo "[pi_install] Installing Node.js ${NODE_VERSION} to ${NODE_DIR}..."
  if [[ ! -f "${TOOLS_DIR}/${NODE_TARBALL}" ]]; then
    echo "[pi_install] Downloading ${NODE_TARBALL}..."
    curl -fSL --progress-bar "${NODE_URL}" -o "${TOOLS_DIR}/${NODE_TARBALL}"
  fi
  echo "[pi_install] Extracting ${NODE_TARBALL}..."
  rm -rf "${NODE_DIR}"
  tar -xJf "${TOOLS_DIR}/${NODE_TARBALL}" -C "${TOOLS_DIR}"
  mv "${TOOLS_DIR}/node-${NODE_VERSION}-${NODE_DISTRO}" "${NODE_DIR}"
  rm -f "${TOOLS_DIR}/${NODE_TARBALL}"
fi

export PATH="${NODE_BIN}:${PATH}"
export NODE_OPTIONS=--dns-result-order=ipv4first

echo "[pi_install] Node version: $(node --version)"
echo "[pi_install] npm version: $(npm --version)"

# ---------- check / install PI ----------
NEED_PI_INSTALL=true
if [[ -x "${NODE_BIN}/pi" ]]; then
  EXISTING_PI_VER="$("${NODE_BIN}/pi" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  if [[ -n "${EXISTING_PI_VER}" ]] && version_ge "${EXISTING_PI_VER}" "${PI_MIN_VERSION}"; then
    echo "[pi_install] PI ${EXISTING_PI_VER} already installed and meets minimum (>= ${PI_MIN_VERSION}). Skipping."
    NEED_PI_INSTALL=false
  else
    echo "[pi_install] PI ${EXISTING_PI_VER:-unknown} is too old or missing (need >= ${PI_MIN_VERSION}). Reinstalling..."
  fi
fi

if [[ "${NEED_PI_INSTALL}" == "true" ]]; then
  echo "[pi_install] Installing @earendil-works/pi-coding-agent..."
  # Install the package into a project-local prefix so `pi` ends up in NODE_BIN.
  npm install -g "@earendil-works/pi-coding-agent" --prefix "${NODE_DIR}" --registry "${NPM_REGISTRY}" --foreground-scripts --progress
fi

if [[ ! -x "${NODE_BIN}/pi" ]]; then
  echo "[pi_install] Error: pi binary not found at ${NODE_BIN}/pi" >&2
  exit 1
fi

PI_VER="$(${NODE_BIN}/pi --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
if [[ -z "${PI_VER}" ]] || ! version_ge "${PI_VER}" "${PI_MIN_VERSION}"; then
  echo "[pi_install] Error: PI version ${PI_VER:-unknown} does not meet minimum ${PI_MIN_VERSION}." >&2
  exit 1
fi

echo "[pi_install] pi version: ${PI_VER}"
echo "[pi_install] Done. run via pi_run_level1.sh or pi_run_level2.sh."
