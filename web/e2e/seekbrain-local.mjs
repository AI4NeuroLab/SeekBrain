// Run against `seekbrain web` with HOME/PI_CODING_AGENT_DIR isolated under .web-validation.
// All model responses come from a loopback fixture. No real provider is called.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "../../.web-validation");
const base = process.env.SEEKBRAIN_WEB_TEST_URL || "http://127.0.0.1:30141";
const home = await (await fetch(base + "/api/home")).json();
assert.equal(resolve(home.home), join(root, "home"), "E2E requires a server with an isolated .web-validation/home");
const observed = [];
const output = join(root, "project-a/research-output");
const mock = createServer(async (req, res) => {
  let text = ""; for await (const chunk of req) text += chunk;
  const body = JSON.parse(text);
  observed.push({ key: req.headers.authorization, messages: body.messages });
  const last = body.messages.at(-1);
  const create = last?.role === "user" && JSON.stringify(last.content).includes("创建测试研究");
  const planning = body.tools?.some(tool => tool.function?.name === "finalize_scientific_plan");
  res.writeHead(200, { "content-type": "text/event-stream" });
  const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ id: "local-validation", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "web-test", choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
  send({ role: "assistant" });
  const call = (id, name, args) => {
    send({ tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
    send({}, "tool_calls");
  };
  if (planning) {
    const written = body.messages.some(message => message.role === "tool" && message.tool_call_id === "write-plan");
    if (written) call("finish-plan", "finalize_scientific_plan", { plan_path: join(output, "plan.md") });
    else call("write-plan", "write", { path: join(output, "plan.md"), content: "# Local WebUI validation plan\n\nThis plan comes from a local test fixture, not a scientific finding.\n" });
  } else if (create) {
    send({ tool_calls: [{ index: 0, id: "start-study", type: "function", function: { name: "seekbrain_research_start", arguments: JSON.stringify({ project_dir: output }) } }] });
    send({}, "tool_calls");
  } else if (last?.role === "tool" && last.tool_call_id === "start-study") {
    call("plan-study", "seekbrain_plan_generate", { project_path: output, action: "create" });
  } else {
    send({ content: "SeekBrain 网页测试：" });
    await new Promise(done => setTimeout(done, 100));
    send({ content: "本地模拟回复已完成。" }); send({}, "stop");
  }
  res.end("data: [DONE]\n\n");
});
mock.listen(0, "127.0.0.1"); await once(mock, "listening");
const provider = "seekbrain-web-test";
await mkdir(join(root, "agent"), { recursive: true });
await writeFile(join(root, "agent/models.json"), JSON.stringify({ providers: { [provider]: {
  baseUrl: `http://127.0.0.1:${mock.address().port}/v1`, api: "openai-completions", apiKey: "$SEEKBRAIN_WEB_TEST_KEY",
  models: [{ id: "web-test", name: "Local WebUI validation", reasoning: false, input: ["text"], contextWindow: 32768, maxTokens: 2048, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
} } }));
for (const suffix of ["a", "b"]) {
  const cwd = join(root, `project-${suffix}`); await mkdir(cwd, { recursive: true });
  await writeFile(join(cwd, ".env"), `SEEKBRAIN_WEB_TEST_KEY=validation-${suffix}\n`);
  await writeFile(join(cwd, "seekbrain.config.yaml"), `agents:\n  seekbrain:\n    provider: ${provider}\n    model: web-test\n    thinking: off\n  seekbrain_default:\n    provider: ${provider}\n    model: web-test\n    thinking: off\n  seekbrain_plan:\n    provider: ${provider}\n    model: web-test\n    thinking: off\n`);
}

async function api(path, data) {
  const res = await fetch(base + path, data ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) } : undefined);
  const result = await res.json(); assert.ok(res.ok, `${res.status}: ${JSON.stringify(result)}`); return result;
}
async function session(suffix) {
  const result = await api("/api/agent/new", { cwd: join(root, `project-${suffix}`), type: "ensure_session" });
  assert.equal(result.model?.provider, provider); return result.sessionId;
}
async function idle(id) {
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    const result = await api(`/api/agent/${id}`, { type: "get_state" });
    if (!result.data?.isStreaming && !result.data?.isPromptRunning) return;
    await new Promise(done => setTimeout(done, 150));
  }
  throw new Error("Session did not become idle");
}

let browser;
try {
  const [a, b] = await Promise.all([session("a"), session("b")]);
  for (const id of [a, b]) { await api(`/api/agent/${id}`, { type: "prompt", message: "你好，请回复网页测试。" }); await idle(id); }
  assert.ok(observed.some(item => item.key === "Bearer validation-a"));
  assert.ok(observed.some(item => item.key === "Bearer validation-b"));
  console.log("HTTP sessions stream through their own project credentials.");
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/?session=${a}`, { waitUntil: "domcontentloaded" });
  await page.getByText("本地模拟回复已完成。", { exact: false }).first().waitFor({ timeout: 60000 });
  const modes = page.getByRole("group", { name: "研究模式" });
  for (const label of ["Ask", "Plan", "Research", "Deep Research"]) {
    const button = modes.getByRole("button", { name: label, exact: true });
    await button.click();
    await page.waitForFunction(label => [...document.querySelectorAll('[role="group"] button')].some(button => button.textContent === label && button.getAttribute("aria-pressed") === "true"), label);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Deep Research", exact: true }).waitFor({ timeout: 60000 });
  assert.equal(await page.getByRole("button", { name: "Deep Research", exact: true }).getAttribute("aria-pressed"), "true");
  const modeBounds = await page.getByRole("group", { name: "研究模式" }).boundingBox();
  assert.ok(modeBounds && modeBounds.height < 60, "mode controls fit on one compact row");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(root, "webui-preview.png"), fullPage: true });
  console.log("Browser renders chat, switches all four modes, and restores the mode after reload.");
  const study = await session("a");
  await api(`/api/agent/${study}`, { type: "prompt", message: "创建测试研究，只创建工作目录，不执行分析。" }); await idle(study);
  const state = JSON.parse(await readFile(join(output, ".seekbrain/state.json"), "utf8"));
  assert.equal(state.flow_version, "0.1.4");
  assert.match(await readFile(join(output, "plan.md"), "utf8"), /local test fixture/);
  console.log("Web main agent -> research tools -> planning subagent -> file tools produced a real plan file.");
} catch (error) {
  if (browser) for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: join(root, "webui-failure.png"), fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser?.close(); mock.closeAllConnections(); await new Promise(done => mock.close(done)); }
