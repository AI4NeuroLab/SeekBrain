import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

// Invoke npm's JavaScript entry directly: npm.cmd cannot be spawned as an exe.
export function npmInvocation(args, env = process.env) {
  const adjacent = process.platform === "win32"
    ? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
    : join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js");
  const candidates = [env.npm_execpath, adjacent];
  if (process.platform !== "win32") {
    const located = spawnSync("which", ["npm"], { env, encoding: "utf8" });
    const path = located.stdout?.trim();
    if (path && existsSync(path)) candidates.push(realpathSync(path));
  }
  const entry = candidates.find(path => path && /\.(?:c?js|mjs)$/.test(path) && existsSync(path));
  if (!entry) throw new Error("Cannot find npm-cli.js. Run via npm, or install npm alongside Node.js.");
  return { command: process.execPath, args: [entry, ...args] };
}
