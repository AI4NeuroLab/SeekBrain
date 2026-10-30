import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { createWebAccessTools, WEB_TOOL_NAMES } from "../../src/extension/web-access-tools.ts";
import { ModeController } from "../../src/extension/runtime/mode-controller.ts";

const directories: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function directory() { const path = await mkdtemp(join(tmpdir(), "seekbrain-web-test-")); directories.push(path); return path; }
const articleUrl = "http://93.184.216.34/article";
const html = `<html><head><title>Cortex evidence</title></head><body><article><h1>Cortex evidence</h1><p>${"Subclass diversification differs among cortical cell types and requires donor-level comparisons. ".repeat(25)}</p></article></body></html>`;
function mockNetwork() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://mcp.exa.ai/mcp")) {
      expect(init.headers["x-api-key"]).toBeUndefined();
      return Response.json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: `Title: Cortex evidence\nURL: ${articleUrl}\nText: Donor-level measurements support cortical cell-type comparisons.` }] } });
    }
    if (url === articleUrl) return new Response(html, { headers: { "content-type": "text/html" } });
    throw new Error(`Unexpected network request: ${url}`);
  });
}
async function upstreamStorage() {
  const require = createRequire(import.meta.url);
  const jiti = require("jiti").createJiti(import.meta.url);
  return jiti.import("pi-web-access/storage.ts");
}

describe("native web access tools", () => {
  it("offers three tools in Ask and Plan without enabling execution", () => {
    const controller = new ModeController();
    for (const mode of ["ask", "plan"] as const) {
      controller.mode = mode;
      for (const name of WEB_TOOL_NAMES) expect(controller.allows(name)).toBe(true);
      expect(controller.allows("seekbrain_execution_run")).toBe(false);
    }
    controller.pending = "research"; expect(controller.allows("web_search")).toBe(false);
  });
  it("blocks all web tools before loading providers when disabled and allows re-enabling", async () => {
    let enabled = false;
    const loadUpstream = vi.fn(async () => { throw new Error("provider reached"); });
    const tools = createWebAccessTools({ isEnabled: () => enabled, loadUpstream });
    for (const [index, params] of [{ query: "cortex" }, { url: articleUrl }, { responseId: "existing" }].entries()) {
      const result: any = await tools[index].execute("disabled", params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("workflow.seekbrain.web_search=false");
    }
    expect(loadUpstream).not.toHaveBeenCalled();
    enabled = true;
    await tools[0].execute("enabled", { query: "cortex" });
    expect(loadUpstream).toHaveBeenCalledOnce();
  });
  it("runs real Exa core search, preserves source text, and restores its cache for another runtime", async () => {
    const cacheDir = await directory(), network = mockNetwork();
    const tools = createWebAccessTools({ cacheDir });
    expect(tools.map(tool => tool.name)).toEqual(WEB_TOOL_NAMES);
    const result: any = await tools[0].execute("search", { query: "cortical diversification", numResults: 3 });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain("Cortex evidence"); expect(result.content[0].text).toContain("Donor-level");
    const id = result.structuredContent.responseId;
    const file = join(cacheDir, `${id}.json`);
    expect(JSON.parse(await readFile(file, "utf8")).queries[0].results[0].url).toBe(articleUrl);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    (await upstreamStorage()).clearResults();
    const restored: any = await createWebAccessTools({ cacheDir })[2].execute("read", { responseId: id, limit: 800 });
    expect(restored.isError).not.toBe(true); expect(restored.content[0].text).toContain("Cortex evidence");
    expect(network).toHaveBeenCalledOnce();
  });
  it("fetches a real core readable document, then finds passages without fetching again", async () => {
    const cacheDir = await directory(), network = mockNetwork(), tools = createWebAccessTools({ cacheDir });
    const result: any = await tools[1].execute("fetch", { url: articleUrl });
    expect(result.isError).not.toBe(true); expect(result.content[0].text).toContain("Subclass diversification");
    const id = result.structuredContent.responseId;
    (await upstreamStorage()).clearResults();
    const restored: any = await createWebAccessTools({ cacheDir })[2].execute("find", { responseId: id, urlIndex: 0, findText: "donor-level", limit: 800 });
    expect(restored.isError).not.toBe(true); expect(restored.content[0].text).toContain("donor-level");
    expect(network).toHaveBeenCalledOnce();
  });
  it("returns provider failures as tool errors without calling a model or switching providers", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    const result: any = await createWebAccessTools({ cacheDir: await directory() })[0].execute("search", { query: "test" });
    expect(result.isError).toBe(true); expect(result.content[0].text).toContain("429");
    expect(network.mock.calls.every(([url]) => String(url).startsWith("https://mcp.exa.ai/"))).toBe(true);
  });
  it("does not dispatch a cancelled request, or swallow cancellation during a fetch", async () => {
    const network = mockNetwork(), tools = createWebAccessTools({ cacheDir: await directory() });
    const aborted = new AbortController(); aborted.abort(new Error("Mode changed"));
    await expect(tools[0].execute("cancel", { query: "test" }, aborted.signal)).rejects.toThrow("Mode changed"); expect(network).not.toHaveBeenCalled();
    network.mockImplementation(async (_url, init: any) => new Promise((_resolve, reject) => { init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }); }));
    const controller = new AbortController();
    const request = tools[0].execute("search", { query: "test" }, controller.signal);
    await vi.waitFor(() => expect(network).toHaveBeenCalled()); controller.abort(new Error("User cancelled"));
    await expect(request).rejects.toThrow("User cancelled");
  });
  it("reports expired caches and rejects traversal or local file URLs", async () => {
    const cacheDir = await directory(), tools = createWebAccessTools({ cacheDir });
    await writeFile(join(cacheDir, "old.json"), JSON.stringify({ id: "old", type: "search", timestamp: Date.now() - 3_600_001, queries: [] }));
    const expired: any = await tools[2].execute("read", { responseId: "old" }); expect(expired.isError).toBe(true); expect(expired.content[0].text).toContain("expired");
    const invalid: any = await tools[2].execute("read", { responseId: "../secret" }); expect(invalid.isError).toBe(true);
    expect(() => tools[1].execute("read", { url: "file:///tmp/data.csv" })).toThrow("HTTP(S)");
    expect(() => tools[1].execute("read", { url: "https://youtube.com/watch?v=video" })).toThrow("video");
  });
});
