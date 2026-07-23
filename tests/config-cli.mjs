import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const cli = await readFile(new URL("src/cli/cli.mjs", root), "utf8");
assert.match(cli, /seekbrain\.config\.yaml/);
assert.doesNotMatch(cli, /agent_config\.py|parse_simple_yaml|internagent\/workflow/);

console.log("direct CLI owns the Node config layer without deploy helpers");
