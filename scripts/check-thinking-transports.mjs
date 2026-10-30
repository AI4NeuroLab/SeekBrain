// Exercise actual CLI RPC and compiled WebUI transports against a local model
// fixture. No external model, credentials, or scientific datasets are used.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const root = resolve(process.argv[2] || new URL("..", import.meta.url).pathname);
const temporary = await mkdtemp(join(tmpdir(), "seekbrain-thinking-transports-"));
const agent = join(temporary, "agent"), project = join(temporary, "project");
await mkdir(agent); await mkdir(project);
await writeFile(join(project, "evidence.csv"), "effect,n\n0.25,120\n");
const requests = [], signatures = new Map(), children = new Set();
let rejected = 0, serial = 0;
const content = value => typeof value === "string" ? [{ type: "text", text: value }] : value ?? [];
const stripCache = block => { const { cache_control, ...rest } = block; return rest; };
function prefix(payload, mi, bi) {
  return { system: content(payload.system).map(stripCache), tools: (payload.tools ?? []).map(stripCache),
    messages: payload.messages.slice(0, mi).map(m => ({ ...m, content: content(m.content).map(stripCache) }))
      .concat([{ role: payload.messages[mi].role, content: content(payload.messages[mi].content).slice(0, bi).map(stripCache) }]) };
}
const ids = payload => payload.messages.flatMap(m => content(m.content)).filter(b => b.type === "thinking").map(b => b.signature);
const backend = createServer(async (req, res) => {
  try {
    let body = ""; for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body); requests.push(payload);
    let bad;
    payload.messages.forEach((m, mi) => content(m.content).forEach((b, bi) => {
      if (b.type === "thinking" && signatures.has(b.signature) && !isDeepStrictEqual(signatures.get(b.signature), prefix(payload, mi, bi))) bad ??= [mi, bi];
    }));
    if (bad) {
      rejected++;
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: `messages.${bad[0]}.content.${bad[1]}: Invalid \`signature\` in \`thinking\` block. The block is bound to a different conversation. The system prompt differs.` } }));
      return;
    }
    assert(!payload.messages.some(m => m.role === "system" && !m.content?.length), "No empty effort system messages");
    const signature = `transport-fixture-${++serial}`;
    const answer = [{ type: "thinking", thinking: "Synthetic fixture reasoning.", signature }];
    if (payload.messages.length === 1) answer.push({ type: "tool_use", id: `read-${serial}`, name: "read", input: { path: "evidence.csv" } });
    else answer.push({ type: "text", text: "Validated fixture evidence: effect=0.25; n=120." });
    signatures.set(signature, prefix({ ...payload, messages: [...payload.messages, { role: "assistant", content: answer }] }, payload.messages.length, 0));
    const events = [{ type: "message_start", message: { id: `msg_${serial}`, type: "message", role: "assistant", model: payload.model, content: [], usage: { input_tokens: 10, output_tokens: 0 } } }];
    answer.forEach((block, index) => {
      events.push({ type: "content_block_start", index, content_block: block.type === "tool_use" ? { ...block, input: {} } : block });
      if (block.type === "tool_use") events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
      events.push({ type: "content_block_stop", index });
    });
    events.push({ type: "message_delta", delta: { stop_reason: answer.some(b => b.type === "tool_use") ? "tool_use" : "end_turn" }, usage: { output_tokens: 5 } }, { type: "message_stop" });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise((done, reject) => { backend.once("error", reject); backend.listen(0, "127.0.0.1", done); });
const baseUrl = `http://127.0.0.1:${backend.address().port}`;
await writeFile(join(agent, "models.json"), JSON.stringify({ providers: { "anthropic-relay": { api: "anthropic-messages", baseUrl,
  models: [{ id: "claude-opus-5-5", name: "Transport fixture", reasoning: true, input: ["text"], contextWindow: 200000, maxTokens: 4096,
    compat: { forceAdaptiveThinking: true, supportsMidConvoEffort: false, supportsMidConvoSystemMessages: false, supportsMidConvoToolChanges: false }, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
} } }));
await writeFile(join(agent, "auth.json"), JSON.stringify({ "anthropic-relay": { type: "api_key", key: "fixture-not-a-real-key" } }));
await writeFile(join(agent, "settings.json"), JSON.stringify({ defaultProvider: "anthropic-relay", defaultModel: "claude-opus-5-5", compaction: { enabled: false }, retry: { enabled: false }, cacheWarming: { mode: "off" } }));
const userConfig = join(temporary, "config.yaml");
await writeFile(userConfig, "agents:\n  seekbrain:\n    provider: anthropic-relay\n    model: claude-opus-5-5\n");
const env = { ...process.env, PI_CODING_AGENT_DIR: agent, SEEKBRAIN_CODING_AGENT_DIR: agent, SEEKBRAIN_USER_CONFIG: userConfig,
  PI_SKIP_VERSION_CHECK: "1", PI_WEB_SKIP_VERSION_CHECK: "1", NEXT_TELEMETRY_DISABLED: "1" };
for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY"]) delete env[key];
function child(args) {
  const value = spawn(process.execPath, [join(root, "bin/seekbrain.mjs"), ...args], { cwd: project, env, detached: true, stdio: ["pipe", "pipe", "pipe"] });
  value.log = ""; value.stdout.on("data", data => { value.log += data; }); value.stderr.on("data", data => { value.log += data; });
  children.add(value); return value;
}
async function stop(value) {
  if (!value || value.exitCode !== null) { children.delete(value); return; }
  value.stdin.end();
  try { process.kill(-value.pid, "SIGTERM"); } catch {}
  await Promise.race([new Promise(done => value.once("exit", done)), new Promise(done => setTimeout(done, 5000))]);
  if (value.exitCode === null) { try { process.kill(-value.pid, "SIGKILL"); } catch {} }
  children.delete(value);
}
function rpc(sessionFile) {
  const process = child([...(sessionFile ? ["--session", sessionFile] : []), "--", "--mode", "rpc", "--offline", "--model", "anthropic-relay/claude-opus-5-5", "--thinking", "high"]);
  const events = [], listeners = new Set(); let buffer = "", sequence = 0;
  process.stdout.on("data", data => {
    buffer += data;
    for (;;) {
      const newline = buffer.indexOf("\n"); if (newline < 0) break;
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      try { const event = JSON.parse(line); events.push(event); for (const listener of listeners) listener(); } catch {}
    }
  });
  function wait(predicate, from = events.length) {
    return new Promise((done, reject) => {
      const timer = setTimeout(() => { listeners.delete(check); reject(new Error(`RPC timeout: ${process.log.slice(-2500)}`)); }, 60000);
      function check() {
        const event = events.slice(from).find(predicate);
        if (event) { clearTimeout(timer); listeners.delete(check); done(event); }
      }
      listeners.add(check); check();
    });
  }
  async function send(type, data = {}) {
    const id = String(++sequence), waiting = wait(e => e.type === "response" && e.id === id);
    process.stdin.write(JSON.stringify({ id, type, ...data }) + "\n");
    const response = await waiting; assert.equal(response.success, true, JSON.stringify(response)); return response.data;
  }
  return { process, send, async prompt(message) {
    const finished = wait(e => e.type === "agent_end"); await send("prompt", { message }); await finished;
    const state = await send("get_messages");
    assert(!state.messages.some(m => m.role === "assistant" && m.stopReason === "error"), "No model error reaches the user");
  }, async mode(mode, label) {
    const changed = wait(e => e.type === "extension_ui_request" && e.method === "setStatus" && e.statusKey === "seekbrain-mode" && e.statusText === label);
    await send("prompt", { message: `/${mode}` }); await changed;
  } };
}

const checks = [];
try {
  let cli = rpc();
  await cli.send("get_state");
  await cli.prompt("Read evidence.csv and confirm effect=0.25 and n=120.");
  assert.equal(requests.length, 2); assert.deepEqual(ids(requests[1]), ["transport-fixture-1"]);
  assert(JSON.stringify(requests[1]).includes("0.25,120"), JSON.stringify(requests[1].messages.at(-1)));
  await cli.mode("ask", "Ask"); await cli.prompt("Continue using the same evidence.");
  assert.equal(rejected, 0); assert.deepEqual(ids(requests.at(-1)), []);
  await cli.mode("plan", "Plan"); await cli.prompt("Confirm the saved plan.");
  const file = (await cli.send("get_state")).sessionFile;
  const original = await readFile(file, "utf8"); assert(original.includes("transport-fixture-1"));
  await stop(cli.process);
  checks.push("CLI RPC: file tool, signed continuation and actual Ask/Plan commands");
  // Simulate a session made by an older version which has no binding ledger.
  await rm(join(agent, "seekbrain/thinking-bindings"), { recursive: true, force: true });
  cli = rpc(file); await cli.send("get_state");
  await cli.mode("research", "Research");
  const before = requests.length;
  await cli.prompt("Resume the scientific task and confirm the evidence.");
  assert.equal(rejected, 1); assert.equal(requests.length - before, 2);
  assert.deepEqual(ids(requests.at(-1)), []);
  await cli.prompt("Continue once more.");
  assert.equal(rejected, 1); assert(ids(requests.at(-1)).includes(`transport-fixture-${serial - 1}`));
  assert((await readFile(file, "utf8")).includes("transport-fixture-1"));
  await stop(cli.process);
  checks.push("CLI old-session resume: actual HTTP 400, one recovery retry, subsequent thinking preserved, original log retained");

  const portProbe = createServer(); await new Promise(done => portProbe.listen(0, "127.0.0.1", done));
  const port = portProbe.address().port; await new Promise(done => portProbe.close(done));
  const web = child(["web", "--cwd", project, "--port", String(port)]), url = `http://127.0.0.1:${port}`;
  const until = Date.now() + 60000; let ready = false;
  while (Date.now() < until) {
    if (web.exitCode !== null) throw new Error(web.log);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 200));
  }
  assert(ready, web.log);
  async function json(path, body) {
    const response = await fetch(url + path, { ...(body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
    const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
  }
  const created = await json("/api/agent/new", { cwd: project, type: "ensure_session", provider: "anthropic-relay", modelId: "claude-opus-5-5" });
  const path = `/api/agent/${created.sessionId}`;
  async function webPrompt(message) {
    await json(path, { type: "prompt", message });
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const response = await json(path, { type: "get_state" });
      if (!response.data.isStreaming && !response.data.isPromptRunning) {
        const entries = (await readFile(response.data.sessionFile, "utf8")).trim().split("\n").map(line => JSON.parse(line));
        assert(!entries.some(e => e.type === "message" && e.message.role === "assistant" && e.message.stopReason === "error"), "WebUI model error"); return;
      }
      await new Promise(done => setTimeout(done, 100));
    }
    throw new Error("WebUI prompt timeout");
  }
  await webPrompt("Read evidence.csv and confirm its effect and sample size.");
  await json(path, { type: "prompt", message: "/plan" });
  await webPrompt("Continue planning with the saved evidence.");
  const retained = ids(requests.at(-1));
  await webPrompt("Continue planning again.");
  assert.equal(rejected, 1, "New WebUI mode changes should be cleaned before the server sees an invalid block");
  assert(ids(requests.at(-1)).length > retained.length, "Valid WebUI thinking should accumulate");
  assert(JSON.stringify(requests.at(-1)).includes("0.25,120"));
  assert((await readdir(join(agent, "seekbrain/thinking-bindings"))).length >= 2);
  await stop(web);
  checks.push("compiled WebUI: real model HTTP requests, file tool, Plan switch and retained new thinking");
  const result = { passed: true, packageRoot: root, physicalRequests: requests.length, deliberatePrefix400: rejected, checks };
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  for (const value of children) await stop(value);
  await new Promise(done => backend.close(done));
  await rm(temporary, { recursive: true, force: true });
}
