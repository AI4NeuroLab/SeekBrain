import assert from "node:assert/strict";
import { test } from "node:test";
import { activePythonEnvironment, pythonProcessEnvironment, resolvePythonCommand } from "../src/platform/python.mjs";
import { mergeEnvironment, prependPath } from "../src/platform/environment.mjs";

test("Windows venv and Conda resolve different executable layouts", () => {
  assert.deepEqual(activePythonEnvironment({ VIRTUAL_ENV: "C:\\研究 项目\\.venv" }, "win32"), {
    kind: "virtualenv", name: ".venv", python: "C:\\研究 项目\\.venv\\Scripts\\python.exe",
  });
  assert.equal(activePythonEnvironment({ CONDA_PREFIX: "D:\\conda\\envs\\science" }, "win32").python,
    "D:\\conda\\envs\\science\\python.exe");
  assert.equal(activePythonEnvironment({ VIRTUAL_ENV: "C:/project/.venv", CONDA_PREFIX: "D:/conda" }, "win32").kind, "virtualenv");
  assert.equal(activePythonEnvironment({ VIRTUAL_ENV: "/tmp/science/.venv" }, "linux").python, "/tmp/science/.venv/bin/python");
});

test("Python selection respects explicit and active interpreters without system fallback", () => {
  const probe = () => { throw new Error("Must not probe a different interpreter"); };
  assert.equal(resolvePythonCommand({ SEEKBRAIN_PYTHON: "C:/Custom Python/python.exe", VIRTUAL_ENV: "D:/venv" }, "win32", probe), "C:/Custom Python/python.exe");
  assert.equal(resolvePythonCommand({ VIRTUAL_ENV: "D:/venv" }, "win32", probe), "D:\\venv\\Scripts\\python.exe");
});

test("system Python probing rejects aliases and bounds startup time", () => {
  const calls = [];
  const selected = resolvePythonCommand({}, "win32", (command, args, options) => {
    calls.push(command);
    assert.deepEqual(args, ["-c", "import sys; print(sys.executable)"]);
    assert.equal(options.timeout, 5000);
    return command === "python" ? { status: 0, stdout: "" } : { status: 0, stdout: "C:\\Python\\python.exe\r\n" };
  });
  assert.equal(selected, "C:\\Python\\python.exe");
  assert.deepEqual(calls, ["python", "python3"]);
});

test("Windows PATH updates preserve tools, collapse aliases and remain idempotent", () => {
  const env = { Path: "C:\\Windows\\System32;C:\\Python", PATH: "D:\\tools", KEEP: "yes" };
  prependPath(env, "D:\\Tools", "win32");
  prependPath(env, "d:/tools", "win32");
  assert.equal(env.Path, "d:/tools;C:\\Windows\\System32;C:\\Python");
  assert.equal(env.PATH, undefined);
  assert.equal(env.KEEP, "yes");
  assert.deepEqual(mergeEnvironment({ Path: "old", TOKEN: "a" }, { PATH: "new" }, "win32"), { TOKEN: "a", PATH: "new" });
  assert.deepEqual(mergeEnvironment({ Path: "old" }, { PATH: "new" }, "linux"), { Path: "old", PATH: "new" });
});

test("Windows Python pipes default to UTF-8 and preserve explicit encoding settings", () => {
  assert.deepEqual(pythonProcessEnvironment({ KEEP: "yes" }, "win32"), { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8", KEEP: "yes" });
  assert.equal(pythonProcessEnvironment({ PYTHONUTF8: "0" }, "win32").PYTHONUTF8, "0");
});
