import { join } from "node:path";
import { run, ROOT } from "./release-lib.mjs";
await run(process.execPath, [join(ROOT, "scripts", "collect-release.mjs"), join(ROOT, "releases", "collected"),
  ...(process.env.TARGET === "all" ? [] : ["--allow-partial"])]);
