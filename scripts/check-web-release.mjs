import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(process.argv[2] || new URL("..", import.meta.url).pathname);
const temporary = await mkdtemp(join(tmpdir(), "seekbrain-web-release-"));
const agentDir = join(temporary, "agent"), project = join(temporary, "project");
await mkdir(agentDir); await mkdir(project);
const listener = createServer();
await new Promise(done => listener.listen(0, "127.0.0.1", done));
const port = listener.address().port;
await new Promise(done => listener.close(done));
const url = `http://127.0.0.1:${port}`;
const config = { providers: { "anthropic-relay": {
  api: "anthropic-messages", baseUrl: "http://127.0.0.1:1",
  models: [{ id: "claude-opus-5-5", name: "Release fixture", reasoning: true, input: ["text"],
    contextWindow: 200000, maxTokens: 4096,
    compat: { forceAdaptiveThinking: true, supportsMidConvoEffort: true },
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
} } };
await writeFile(join(agentDir, "models.json"), JSON.stringify(config));
await writeFile(join(agentDir, "auth.json"), JSON.stringify({ "anthropic-relay": { type: "api_key", key: "release-fixture-placeholder" } }));
await writeFile(join(agentDir, "settings.json"), JSON.stringify({ defaultProvider: "anthropic-relay", defaultModel: "claude-opus-5-5" }));
const userConfig = join(temporary, "config.yaml");
await writeFile(userConfig, "agents:\n  seekbrain:\n    provider: anthropic-relay\n    model: claude-opus-5-5\n");
const env = { ...process.env, PI_CODING_AGENT_DIR: agentDir, SEEKBRAIN_CODING_AGENT_DIR: agentDir,
  SEEKBRAIN_USER_CONFIG: userConfig, PI_WEB_SKIP_VERSION_CHECK: "1", PI_SKIP_VERSION_CHECK: "1" };
for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY"]) delete env[key];
const child = spawn(process.execPath, [join(root, "bin/seekbrain.mjs"), "web", "--cwd", project, "--port", String(port)], {
  cwd: project, env, stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", data => { log += data; }); child.stderr.on("data", data => { log += data; });
async function json(path, body) {
  const response = await fetch(url + path, { ...(body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(data)}`);
  return data;
}
try {
  const until = Date.now() + 60000;
  let ready = false;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(log);
    try { const page = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (page.ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 300));
  }
  assert(ready, `Web server did not start: ${log}`);
  assert(!log.includes("(webpack)"), "release must use next start, not a development server");
  await json("/api/sessions");
  const created = await json("/api/agent/new", { cwd: project, type: "ensure_session", provider: "anthropic-relay", modelId: "claude-opus-5-5" });
  assert(created.sessionId);
  const commands = await json(`/api/agent/${created.sessionId}`, { type: "get_commands" });
  const names = (commands.data.commands || commands.data).map(command => command.name);
  for (const name of ["ask", "plan", "research", "deep-research"]) assert(names.includes(name), `missing SeekBrain command ${name}`);
  const tools = await json(`/api/agent/${created.sessionId}`, { type: "get_tools" });
  assert(JSON.stringify(tools).includes("seekbrain_plan_generate"), "research tools must load in the compiled server");
  await json(`/api/agent/${created.sessionId}`, { type: "prompt", message: "/plan" });
  const models = await json(`/api/models?cwd=${encodeURIComponent(project)}`);
  assert(JSON.stringify(models).includes("claude-opus-5-5"));
  const repaired = JSON.parse(await readFile(join(agentDir, "models.json"), "utf8"));
  assert.equal(repaired.providers["anthropic-relay"].models[0].compat.supportsMidConvoEffort, false);
  if (process.argv[3]) {
    const { chromium } = await import("../web/node_modules/playwright/index.mjs");
    const browser = await chromium.launch({ executablePath: process.env.SEEKBRAIN_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") console.error("Browser console:", message.text()); });
      // Match the launcher's new-project URL. An ensure_session-only session
      // has no persisted user message and intentionally stays out of history.
      await page.goto(`${url}/?cwd=${encodeURIComponent(project)}`);
      // New composers initialize their SDK session on the first command.
      await page.locator("textarea.chat-input-textarea").fill("/plan");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.screenshot({ path: resolve(process.argv[3]), fullPage: true });
      for (const label of ["Ask", "Plan", "Research", "Deep Research"]) {
        const button = page.locator(".seekbrain-modes").getByRole("button", { name: label, exact: true });
        try { await button.waitFor({ state: "visible", timeout: 15000 }); }
        catch (error) { console.error("Browser content:", await page.locator("body").innerText()); console.error("Browser errors:", errors); await page.screenshot({ path: resolve(process.argv[3]), fullPage: true }); throw error; }
        await button.click();
        await page.waitForFunction(text => Array.from(document.querySelectorAll(".seekbrain-modes button")).some(button => button.textContent === text && button.getAttribute("aria-pressed") === "true"), label, { timeout: 10000 });
      }
      await page.screenshot({ path: resolve(process.argv[3]), fullPage: true });
      assert.deepEqual(errors, [], "browser runtime errors");
      console.log("Production browser rendering and all four mode buttons passed.");
    } finally { await browser.close(); }
  }
  console.log("Installed production WebUI: page, sessions, native SeekBrain host, research tools, four modes, model list and Opus 5.5 migration passed. No model API was called.");
} catch (error) { console.error(log); throw error; }
finally {
  child.kill("SIGTERM");
  await new Promise(done => { if (child.exitCode !== null) done(); else { child.once("exit", done); setTimeout(() => child.kill("SIGKILL"), 5000).unref(); } });
  await rm(temporary, { recursive: true, force: true });
}
