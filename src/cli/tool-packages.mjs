export const TOOL_PACKAGE_VERSION = "0.1.0";
export const TOOL_PACKAGES = Object.fromEntries(
  ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "win32-x64"].map((target) => [target, `seekbrain-tools-${target}`]),
);
