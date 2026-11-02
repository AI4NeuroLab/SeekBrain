import { RELEASE_CONFIG } from "./release-lib.mjs";
const selection = process.argv[2] || "all";
const targets = selection === "all" ? Object.keys(RELEASE_CONFIG.targets) : selection === "smoke" ? ["linux-x64", "win32-x64"] : [selection];
if (targets.some(target => !RELEASE_CONFIG.targets[target])) throw new Error("Unsupported target");
console.log(JSON.stringify({ include: targets.map(target => ({ target, runner: RELEASE_CONFIG.targets[target].runner })) }));
