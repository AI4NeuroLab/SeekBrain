import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/runtime/index.ts", root), "utf8");
const systemSource = await readFile(new URL("src/extension/commands/system-commands.ts", root), "utf8");
const showSource = await readFile(new URL("src/extension/commands/show-command.ts", root), "utf8");
const saveSource = await readFile(new URL("src/extension/commands/save-skill-command.ts", root), "utf8");
const reportSource = await readFile(new URL("src/extension/commands/study-report-command.ts", root), "utf8");

assert.doesNotMatch(extensionSource, /pi\.registerCommand\(/);
assert.match(extensionSource, /registerSystemCommands\(pi/);
assert.match(extensionSource, /registerShowCommand\(pi/);
assert.match(extensionSource, /registerSaveSkillCommand\(pi/);
assert.match(extensionSource, /registerStudyReportCommand\(pi/);
assert.match(systemSource, /"seekbrain-reload-config"/);
assert.match(systemSource, /"seekbrain-tools"/);
assert.match(showSource, /"seekbrain-show"/);
assert.match(saveSource, /"seekbrain-save-recipe"/);
assert.match(reportSource, /"seekbrain-report"/);
assert.doesNotMatch(systemSource + showSource + saveSource + reportSource, /packages\/workflows|extensions\/seekbrain/);

console.log("Phase 5 slash commands register through dedicated Pi command modules");
