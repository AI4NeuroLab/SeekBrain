#!/usr/bin/env node

import { main } from "../src/cli/cli.mjs";
import { configureBundledTools } from "../src/cli/bundled-tools.mjs";

try {
  const args = process.argv.slice(2);
  if (!args.includes("--help") && !args.includes("-h") && !["-V", "-v", "--version"].includes(args[0])) configureBundledTools();
  if (args[0] === "web" || (args[0] === "--ui" && args[1] === "webui")) {
    const { launchWeb } = await import("../src/cli/web-launcher.mjs");
    process.exitCode = await launchWeb(args.slice(args[0] === "web" ? 1 : 2));
  } else process.exitCode = await main(args);
} catch (error) {
  console.error(`SeekBrain: ${error.message}`);
  process.exitCode = 1;
}
