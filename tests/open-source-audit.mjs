import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const audit = fileURLToPath(new URL("../scripts/open-source-audit.mjs", import.meta.url));
async function check(source, inspect) {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-audit-"));
  try {
    const init = spawnSync("git", ["init", "--quiet"], { cwd });
    assert.equal(init.status, 0);
    await writeFile(join(cwd, "fixture.test.mjs"), source);
    const result = spawnSync(process.execPath, [audit], { cwd, encoding: "utf8" });
    assert.ifError(result.error);
    inspect(result);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("audit accepts reviewed dummy credentials and loopback fixtures", async () => {
  const dummy = "ghp_" + "abcdefghijklmnopqrstuvwxyz123456789012";
  await check(`const key = "${dummy}"; const url = "http://127.0.0.1:30141";`, result => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test("audit still rejects credential-shaped random values inside test files without printing them", async () => {
  const value = "sk-" + "ant-" + randomBytes(32).toString("hex");
  await check(`const key = "${value}";`, result => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /fixture.test.mjs: provider credential/);
    assert.ok(!result.stderr.includes(value));
  });
});

test("audit rejects private keys inside test files", async () => {
  const value = "-----BEGIN PRIVATE" + " KEY-----";
  await check(value, result => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /private key/);
    assert.ok(!result.stderr.includes(value));
  });
});

test("audit rejects an unreviewed IP service endpoint", async () => {
  const value = "http://" + "10.34.56.78:9000";
  await check(`const endpoint = "${value}";`, result => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /hard-coded IP service URL/);
  });
});
