import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { main, PACKAGE_ROOT, parseArgs } from "../src/cli/cli.mjs";

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write(value) { stdout += value; } },
      stderr: { write(value) { stderr += value; } },
    },
    output: () => ({ stdout, stderr }),
  };
}

assert.equal(parseArgs(["config", "get", "modules.targeted_skill.relevance_threshold"]).action, "config");
assert.equal(parseArgs(["config", "set", "modules.targeted_skill.relevance_threshold", "0.5"]).options.scope, undefined);
assert.equal(parseArgs(["config", "unset", "modules.targeted_skill.relevance_threshold", "--project"]).options.scope, "project");
assert.equal(parseArgs(["config", "show", "--effective"]).options.effective, true);
assert.equal(parseArgs(["config", "get"]).action, "error");
assert.equal(parseArgs(["config", "set", "key-only"]).action, "error");

const work = await mkdtemp(join(tmpdir(), "seekbrain-config-management-"));
const home = await mkdtemp(join(tmpdir(), "seekbrain-config-management-home-"));
const runtime = { cwd: work, homeDir: home, packageRoot: PACKAGE_ROOT, env: {} };

try {
  let captured = capture();
  assert.equal(await main(["config", "get", "modules.targeted_skill.relevance_threshold"], captured.io, runtime), 0);
  assert.match(captured.output().stdout, /relevance_threshold = 0\.5/);
  assert.match(captured.output().stdout, /Source: package default/);

  captured = capture();
  assert.equal(await main(["config", "list", "modules.targeted_skill"], captured.io, runtime), 0);
  assert.match(captured.output().stdout, /modules\.targeted_skill\.top_k = 1/);
  assert.match(captured.output().stdout, /modules\.targeted_skill\.compatibility\.candidate_pool_size = 10/);

  captured = capture();
  assert.equal(await main(["config", "set", "modules.targeted_skill.relevance_threshold", "0.5"], captured.io, runtime), 0);
  const userPath = join(home, ".config", "seekbrain", "config.yaml");
  assert.deepEqual(parseYaml(await readFile(userPath, "utf8")), {
    modules: { targeted_skill: { relevance_threshold: 0.5 } },
  });

  captured = capture();
  assert.equal(await main(["config", "get", "modules.targeted_skill.relevance_threshold"], captured.io, runtime), 0);
  assert.match(captured.output().stdout, /relevance_threshold = 0\.5/);
  assert.match(captured.output().stdout, /Source: user/);

  captured = capture();
  assert.equal(await main(["config", "set", "modules.targeted_skill.relevance_threshold", "0.7", "--project"], captured.io, runtime), 0);
  const projectPath = join(work, "seekbrain.config.yaml");
  assert.equal(parseYaml(await readFile(projectPath, "utf8")).modules.targeted_skill.relevance_threshold, 0.7);

  captured = capture();
  assert.equal(await main(["config", "show", "--effective"], captured.io, runtime), 0);
  const effective = JSON.parse(captured.output().stdout);
  assert.equal(effective.configuration.modules.targeted_skill.relevance_threshold, 0.7);
  assert.equal(effective.sources["modules.targeted_skill.relevance_threshold"].layer, "project");

  captured = capture();
  assert.equal(await main(["config", "unset", "modules.targeted_skill.relevance_threshold", "--project"], captured.io, runtime), 0);
  captured = capture();
  assert.equal(await main(["config", "get", "modules.targeted_skill.relevance_threshold"], captured.io, runtime), 0);
  assert.match(captured.output().stdout, /relevance_threshold = 0\.5/);
  assert.match(captured.output().stdout, /Source: user/);

  captured = capture();
  assert.equal(await main(["config", "set", "modules.targeted_skill.relevance_threshold", "1.5"], captured.io, runtime), 1);
  assert.match(captured.output().stderr, /must be a number between 0 and 1/);
  assert.equal(parseYaml(await readFile(userPath, "utf8")).modules.targeted_skill.relevance_threshold, 0.5);

  captured = capture();
  assert.equal(await main(["config", "unset", "modules.targeted_skill.relevance_threshold"], captured.io, runtime), 0);
  captured = capture();
  assert.equal(await main(["config", "get", "modules.targeted_skill.relevance_threshold"], captured.io, runtime), 0);
  assert.match(captured.output().stdout, /relevance_threshold = 0\.5/);
  assert.match(captured.output().stdout, /Source: package default/);
} finally {
  await rm(work, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
}

console.log("SeekBrain config commands expose effective values and write sparse overrides without runtime work");
