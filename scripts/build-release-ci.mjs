import { join } from "node:path";
import { tmpdir } from "node:os";
import { run, ROOT } from "./release-lib.mjs";
await run(process.execPath, [join(ROOT, "scripts", "build-release.mjs"), "--output", join(ROOT, "releases", "ci"),
  "--work-dir", process.env.RUNNER_TEMP || tmpdir(), ...(process.env.WITH_WEB === "true" ? [] : ["--cli-only"])]);
