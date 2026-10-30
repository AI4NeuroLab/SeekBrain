import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import * as piSdk from "@earendil-works/pi-coding-agent";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { installAnthropicThinkingCompatibility } from "../../src/compat/anthropic-thinking.mjs";
import registerSeekBrain from "../../src/extension/index.ts";
import { ExistingPiAgentAdapter } from "../../src/extension/existing-pi-agent-adapter.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const clone = (value: any) => structuredClone(value);
const thinking = () => ({ type: "thinking", thinking: "Synthetic test reasoning.", signature: "" });
const text = (value = "Result saved in plan.md.") => ({ type: "text", text: value });
const user = (value = "Continue the analysis.") => ({ role: "user", content: value, timestamp: 1 });
const tool = (id: string, value = "measured effect=0.25; n=120") => ({ role: "toolResult", toolCallId: id, toolName: "read", content: [text(value)], isError: false, timestamp: 1 });
const tools = [{ name: "read", description: "Read evidence", parameters: { type: "object", properties: { path: { type: "string" } } } }];
const context = (messages: any[], system = "Research mode A.", activeTools = tools) => ({ messages: [{ role: "system", content: system, toolsAdded: activeTools, timestamp: 0 }, ...messages] });
const thoughtIds = (payload: any) => payload.messages.flatMap((m: any) => (Array.isArray(m.content) ? m.content : []).filter((b: any) => ["thinking", "redacted_thinking"].includes(b.type)).map((b: any) => b.signature ?? b.data));
const contentBlocks = (content: any) => typeof content === "string" ? [text(content)] : content ?? [];

function prefix(payload: any, mi: number, bi: number) {
  // Independent server oracle: compare the actual preceding JSON, rather than
  // reproducing the client's rolling hashes or reading its saved metadata.
  const stripCache = (block: any) => { const { cache_control, ...rest } = block; return rest; };
  return {
    system: contentBlocks(payload.system).map(stripCache), tools: (payload.tools ?? []).map(stripCache),
    messages: payload.messages.slice(0, mi).map((m: any) => ({ ...m, content: contentBlocks(m.content).map(stripCache) }))
      .concat([{ role: payload.messages[mi].role, content: contentBlocks(payload.messages[mi].content).slice(0, bi).map(stripCache) }]),
  };
}
function sse(content: any[], extra: any = {}, failureAfterContent?: string) {
  const events: any[] = [{ type: "message_start", message: { id: "msg_fixture", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], usage: { input_tokens: 10, output_tokens: 0 }, ...extra } }];
  content.forEach((block, index) => {
    if (block.type === "thinking") {
      events.push({ type: "content_block_start", index, content_block: { ...block, thinking: "", signature: "" } });
      events.push({ type: "content_block_delta", index, delta: { type: "thinking_delta", thinking: block.thinking } });
      events.push({ type: "content_block_delta", index, delta: { type: "signature_delta", signature: block.signature } });
    } else if (block.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } });
    } else if (block.type === "tool_use") {
      events.push({ type: "content_block_start", index, content_block: { ...block, input: {} } });
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
    } else events.push({ type: "content_block_start", index, content_block: block });
    events.push({ type: "content_block_stop", index });
  });
  if (failureAfterContent) events.push({ type: "error", error: { type: "invalid_request_error", message: failureAfterContent } });
  else events.push({ type: "message_delta", delta: { stop_reason: content.some(b => b.type === "tool_use") ? "tool_use" : "end_turn" }, usage: { output_tokens: 5 } }, { type: "message_stop" });
  return new Response(events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
}

async function fixture(options: { reply?: (payload: any, index: number) => any[]; reject?: string; transform?: boolean; failureAfterContent?: string } = {}) {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-thinking-test-")); roots.push(root);
  const requests: any[] = [], signatures = new Map<string, any>();
  let failures = 0, serial = 0;
  await writeFile(join(root, "models.json"), JSON.stringify({ providers: { "anthropic-relay": {
    api: "anthropic-messages", baseUrl: "https://fixture.invalid", apiKey: "fixture-only-key",
    models: [{ id: "claude-opus-5-5", name: "Opus 5.5", reasoning: true, input: ["text"], contextWindow: 200000, maxTokens: 12000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      compat: { supportsMidConvoEffort: false, supportsMidConvoSystemMessages: false, supportsMidConvoToolChanges: false, forceAdaptiveThinking: true } }],
  } } }));
  const fetch = vi.fn(async (_url: any, init: any) => {
    const payload = JSON.parse(init.body); requests.push(clone(payload));
    let bad: [number, number] | undefined;
    payload.messages.forEach((message: any, mi: number) => contentBlocks(message.content).forEach((block: any, bi: number) => {
      const id = block.signature ?? (block.type === "redacted_thinking" ? block.data : undefined);
      if (id && signatures.has(id) && !isDeepStrictEqual(signatures.get(id), prefix(payload, mi, bi))) bad ??= [mi, bi];
    }));
    const extra: any = {};
    if (bad && options.transform) {
      extra.input_transformations = [];
      payload.messages.forEach((message: any, mi: number) => {
        message.content = contentBlocks(message.content).filter((block: any, bi: number) => {
          if ((mi > bad![0] || (mi === bad![0] && bi >= bad![1])) && ["thinking", "redacted_thinking"].includes(block.type)) {
            extra.input_transformations.push({ type: "thinking_dropped", path: `messages.${mi}.content.${bi}`, reason: "prefix_binding_mismatch" }); return false;
          }
          return true;
        });
      });
      bad = undefined;
    }
    if (bad || options.reject) {
      failures++;
      const message = options.reject ?? `messages.${bad![0]}.content.${bad![1]}: Invalid \`signature\` in \`thinking\` block. The block is bound to a different conversation. Remove the block, or set thinking.block_binding.prefix_mismatch_behavior to drop_block. The system prompt differs.`;
      return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message } }), { status: 400, headers: { "content-type": "application/json" } });
    }
    const answer = (options.reply?.(payload, requests.length - 1) ?? [thinking(), text()]).map(clone);
    const full = { ...payload, messages: [...payload.messages, { role: "assistant", content: answer }] };
    answer.forEach((block, bi) => {
      if (block.type === "thinking" || block.type === "redacted_thinking") {
        const id = `fixture-signed-${++serial}`;
        if (block.type === "thinking") block.signature = id; else block.data = id;
        signatures.set(id, prefix(full, full.messages.length - 1, bi));
      }
    });
    return sse(answer, extra, options.failureAfterContent);
  });
  async function runtime() {
    const value = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: join(root, "models.json"), allowModelNetwork: false });
    installAnthropicThinkingCompatibility(value, { agentDir: root });
    return value;
  }
  const firstRuntime = await runtime();
  const call = async (input: any, sessionId = "research-session", value = firstRuntime, extra: any = {}) => {
    const model = value.getModel("anthropic-relay", "claude-opus-5-5")!;
    const events: any[] = [];
    const stream = value.streamSimple(model, input, { reasoning: "high", maxRetries: 0, cacheRetention: "none", fetch, sessionId, ...extra });
    for await (const event of stream) events.push(event);
    const result = await stream.result();
    return { result, events };
  };
  return { root, requests, runtime, firstRuntime, call, fetch, signatures, failures: () => failures };
}

describe("Opus 5.5 relay thinking compatibility through the real pi SDK", () => {
  it("preserves signed thinking in append-only conversations and stores hashes without reasoning or credentials", async () => {
    const f = await fixture(), messages = [user("Original research question.")];
    for (let i = 0; i < 6; i++) {
      const { result } = await f.call(context(messages));
      expect(result.stopReason).toBe("stop"); expect(result.diagnostics).toBeUndefined();
      expect(thoughtIds(f.requests[i])).toHaveLength(i);
      messages.push(result as any, user());
    }
    expect(f.failures()).toBe(0);
    const dir = join(f.root, "seekbrain/thinking-bindings"), files = await readdir(dir);
    expect(files).toHaveLength(1);
    const saved = await readFile(join(dir, files[0]), "utf8");
    expect(saved).not.toMatch(/Original research|Synthetic test|fixture-signed|fixture-only-key/);
    expect(JSON.parse(saved).bindings).toHaveLength(6);
    expect((await stat(join(dir, files[0]))).mode & 0o777).toBe(0o600);
  });

  it("cleans system-bound thinking and redacted blocks once, retaining new reasoning on later turns", async () => {
    const f = await fixture({ reply: (_p, i) => i === 0 ? [thinking(), { type: "redacted_thinking", data: "" }, text("Evidence and plan retained.")] : [thinking(), text()] });
    const q = user(), first = (await f.call(context([q]))).result, original = clone(first);
    const messages = [q, first, user("Plan was updated.")];
    const second = (await f.call(context(messages, "Research mode B."))).result;
    expect(second.stopReason).toBe("stop"); expect(thoughtIds(f.requests[1])).toEqual([]);
    expect(second.diagnostics?.[0].details).toEqual({ removedBlocks: 2, recoveredFromPrefixMismatch: false });
    await f.call(context([...messages, second, user()], "Research mode B."));
    expect(thoughtIds(f.requests[2])).toEqual(["fixture-signed-3"]);
    expect(JSON.stringify(f.requests[2])).toContain("Evidence and plan retained.");
    expect(first).toEqual(original); expect(f.failures()).toBe(0); expect(f.requests).toHaveLength(3);
  });

  it("preserves parallel tool calls and their exact results while tools/system change", async () => {
    const f = await fixture({ reply: (_p, i) => i === 0 ? [thinking(), ...["a", "b"].map(id => ({ type: "tool_use", id, name: "read", input: { path: `${id}.csv` } }))] : [thinking(), text("effect=0.25; n=120")] });
    const q = user(), first = (await f.call(context([q]))).result;
    const messages = [q, first, tool("a"), tool("b", "control mean=2.5")];
    const changedTools = [...tools, { ...tools[0], name: "write" }];
    const second = (await f.call(context(messages, "Research mode B.", changedTools))).result;
    expect(second.stopReason).toBe("stop");
    const wire = f.requests[1];
    expect(wire.messages.find((m: any) => m.role === "assistant").content.map((b: any) => b.id)).toEqual(["a", "b"]);
    expect(wire.messages.at(-1).content.map((b: any) => b.tool_use_id)).toEqual(["a", "b"]);
    expect(JSON.stringify(wire)).toContain("control mean=2.5");
    await f.call(context([...messages, second, user()], "Research mode B.", changedTools));
    expect(thoughtIds(f.requests[2])).toEqual(["fixture-signed-2"]); expect(f.failures()).toBe(0);
  });

  it("retains earlier valid thinking when only a later historical message was edited", async () => {
    const f = await fixture(), q = user("Initial question.");
    const first = (await f.call(context([q]))).result;
    const second = (await f.call(context([q, first, user("Old instruction.")]))).result;
    await f.call(context([q, first, user("Corrected instruction."), second, user()]));
    expect(thoughtIds(f.requests[2])).toEqual(["fixture-signed-1"]); expect(f.failures()).toBe(0);
  });

  it("handles compacted history and a thinking-only assistant without producing empty messages", async () => {
    const f = await fixture({ reply: () => [thinking()] }), q = user();
    const first = (await f.call(context([q]))).result;
    const second = (await f.call(context([q, first, user()]))).result;
    await f.call(context([user("Summary of prior analysis."), second, user()]));
    expect(thoughtIds(f.requests[2])).toEqual([]);
    expect(f.requests[2].messages.every((m: any) => !Array.isArray(m.content) || m.content.length > 0)).toBe(true);
    expect(f.failures()).toBe(0);
  });

  it("persists the cleaned view across a fresh runtime and keeps valid new reasoning after resume", async () => {
    const f = await fixture(), q = user();
    const first = (await f.call(context([q]))).result;
    const messages = [q, first, user()];
    const second = (await f.call(context(messages, "Updated plan."))).result;
    const resumed = await f.runtime();
    await f.call(context([...messages, second, user()], "Updated plan."), "research-session", resumed);
    expect(thoughtIds(f.requests[2])).toEqual(["fixture-signed-2"]);
    expect(f.failures()).toBe(0); expect(f.requests).toHaveLength(3);
  });

  it("recovers an imported old session once and never exposes the intermediate 400 or restores the removed blocks", async () => {
    const f = await fixture(), q = user(), first = (await f.call(context([q]), "old-client")).result;
    const messages = [q, first, user()];
    const hooks = { onPayload: vi.fn((p: any) => p), onProviderStreamEvent: vi.fn() };
    const { result: second, events } = await f.call(context(messages, "New system."), "imported-session", f.firstRuntime, hooks);
    expect(second.stopReason).toBe("stop"); expect(f.failures()).toBe(1); expect(f.requests).toHaveLength(3);
    expect(events.filter(e => e.type === "start")).toHaveLength(1); expect(events.some(e => e.type === "error")).toBe(false);
    expect(second.diagnostics?.[0].details).toEqual({ removedBlocks: 1, recoveredFromPrefixMismatch: true });
    expect(hooks.onPayload).toHaveBeenCalledTimes(2); expect(hooks.onProviderStreamEvent).toHaveBeenCalled();
    await f.call(context([...messages, second, user()], "New system."), "imported-session", await f.runtime());
    expect(thoughtIds(f.requests[3])).toEqual(["fixture-signed-2"]); expect(f.failures()).toBe(1);
  });

  it("does not clear unverifiable old thinking that the server can still accept", async () => {
    const f = await fixture(), q = user(), first = (await f.call(context([q]), "old-client")).result;
    const second = (await f.call(context([q, first, user()]), "new-client")).result;
    expect(thoughtIds(f.requests[1])).toEqual(["fixture-signed-1"]); expect(second.diagnostics).toBeUndefined();
    await f.call(context([q, first, user(), second, user()], "Changed."), "new-client");
    expect(thoughtIds(f.requests[2])).toEqual([]); expect(f.failures()).toBe(0);
  });

  it("bounds recovery to one retry when the server still rejects the cleaned request", async () => {
    const source = await fixture(), q = user(), first = (await source.call(context([q]))).result;
    const f = await fixture({ reject: "Invalid `signature` in `thinking` block. The block is bound to a different conversation." });
    const { result, events } = await f.call(context([q, first, user()]));
    expect(result.stopReason).toBe("error"); expect(f.requests).toHaveLength(2);
    expect(thoughtIds(f.requests[0])).toHaveLength(1); expect(thoughtIds(f.requests[1])).toHaveLength(0);
    expect(events.filter(e => e.type === "error")).toHaveLength(1);
  });

  it("keeps earlier valid blocks when a legacy-session error names only a later mismatch", async () => {
    const f = await fixture(), q = user();
    const first = (await f.call(context([q]), "old-client")).result;
    const second = (await f.call(context([q, first, user("Before correction.")]), "old-client")).result;
    const { result } = await f.call(context([q, first, user("After correction."), second, user()]), "imported-session");
    expect(result.stopReason).toBe("stop"); expect(f.failures()).toBe(1);
    expect(thoughtIds(f.requests[3])).toEqual(["fixture-signed-1"]);
  });

  it.each([
    "Invalid `signature` in `thinking` block",
    "Unexpected value for the anthropic-beta header",
    "The maximum context length was exceeded",
  ])("leaves unrelated errors visible and does not retry: %s", async reject => {
    const f = await fixture({ reject });
    const { result, events } = await f.call(context([user()]));
    expect(result.stopReason).toBe("error"); expect(result.errorMessage).toContain(reject);
    expect(f.requests).toHaveLength(1); expect(events.filter(e => e.type === "error")).toHaveLength(1);
  });

  it("does not retry a prefix error after response content has begun", async () => {
    const f = await fixture({ failureAfterContent: "Invalid `signature` in `thinking` block. The block is bound to a different conversation." });
    const { result } = await f.call(context([user()]));
    expect(result.stopReason).toBe("error"); expect(f.requests).toHaveLength(1);
  });

  it("respects cancellation without issuing a recovery request", async () => {
    const f = await fixture(), controller = new AbortController(); controller.abort();
    const { result } = await f.call(context([user()]), "cancelled", f.firstRuntime, { signal: controller.signal });
    expect(result.stopReason).toBe("aborted"); expect(f.fetch).not.toHaveBeenCalled();
  });

  it("honors server-reported thinking removals and persists them for the next request", async () => {
    const f = await fixture({ transform: true }), q = user();
    const first = (await f.call(context([q]), "old-client")).result;
    const messages = [q, first, user()];
    const second = (await f.call(context(messages, "New system."), "new-client")).result;
    await f.call(context([...messages, second, user()], "New system."), "new-client", await f.runtime());
    expect(thoughtIds(f.requests[2])).toEqual(["fixture-signed-2"]); expect(f.failures()).toBe(0);
  });

  it("ignores moving cache breakpoints without ignoring real tool parameters named cache_control", async () => {
    const f = await fixture({ reply: (_p, i) => i === 0 ? [thinking(), { type: "tool_use", id: "a", name: "read", input: { path: "a.csv", cache_control: "scientific-value-A" } }] : [thinking(), text()] });
    const q = user(), first = (await f.call(context([q]), "cache", f.firstRuntime, { cacheRetention: "short" })).result;
    const messages = [q, first, tool("a")];
    const second = (await f.call(context(messages), "cache", f.firstRuntime, { cacheRetention: "short" })).result;
    expect(thoughtIds(f.requests[1])).toEqual(["fixture-signed-1"]);
    const edited = clone(first); (edited.content.find((b: any) => b.type === "toolCall") as any).arguments.cache_control = "scientific-value-B";
    await f.call(context([q, edited, tool("a"), second, user()]), "cache", f.firstRuntime, { cacheRetention: "short" });
    expect(thoughtIds(f.requests[2])).toEqual(["fixture-signed-1"]); expect(f.failures()).toBe(0);
  });

  it("tracks the final payload after other extensions edit it", async () => {
    const f = await fixture(), q = user();
    const first = (await f.call(context([q]), "hooks", f.firstRuntime, { onPayload: (p: any) => ({ ...p, system: [text("Extension system A.")] }) })).result;
    await f.call(context([q, first, user()]), "hooks", f.firstRuntime, { onPayload: (p: any) => ({ ...p, system: [text("Extension system B.")] }) });
    expect(thoughtIds(f.requests[1])).toEqual([]); expect(f.failures()).toBe(0);
  });

  it("does not discard valid reasoning merely because the HTTP endpoint moved", async () => {
    const f = await fixture(), q = user(), first = (await f.call(context([q]))).result;
    const model = { ...f.firstRuntime.getModel("anthropic-relay", "claude-opus-5-5")!, baseUrl: "https://moved.fixture.invalid" };
    const second = await f.firstRuntime.streamSimple(model, context([q, first, user()]) as any, {
      reasoning: "high", sessionId: "research-session", fetch: f.fetch as any, cacheRetention: "none", maxRetries: 0,
    }).result();
    expect(second.stopReason).toBe("stop"); expect(second.diagnostics).toBeUndefined();
    expect(thoughtIds(f.requests[1])).toEqual(["fixture-signed-1"]); expect(f.failures()).toBe(0);
  });

  it("isolates concurrent sessions sharing one runtime", async () => {
    const f = await fixture();
    const [a, b] = await Promise.all([f.call(context([user("a")]), "a"), f.call(context([user("b")]), "b")]);
    await Promise.all([f.call(context([user("a"), a.result, user()], "Changed a."), "a"), f.call(context([user("b"), b.result, user()]), "b")]);
    const requestB = f.requests.find((p: any) => contentBlocks(p.messages[0].content)[0].text === "b" && thoughtIds(p).length);
    expect(requestB).toBeDefined(); expect(f.failures()).toBe(0);
    expect(await readdir(join(f.root, "seekbrain/thinking-bindings"))).toHaveLength(2);
  });

  it("sustains 40 large-context tool turns through two system changes without losing tool evidence", async () => {
    const f = await fixture({ reply: (_p, i) => [thinking(), { type: "tool_use", id: `read-${i}`, name: "read", input: { path: `measurement-${i}.csv` } }] });
    const messages: any[] = [user("Scientific evidence: " + "observed-value-0.25; ".repeat(5000))];
    for (let i = 0; i < 40; i++) {
      const system = `Research stage ${Math.floor(i / 15)}.`;
      const { result } = await f.call(context(messages, system));
      expect(result.stopReason).toBe("toolUse");
      const retained = i % 15;
      expect(thoughtIds(f.requests[i])).toHaveLength(retained);
      messages.push(result, tool(`read-${i}`, `validated-measurement-${i}=0.25`));
    }
    expect(f.requests).toHaveLength(40); expect(f.failures()).toBe(0);
    const last = JSON.stringify(f.requests.at(-1));
    for (let i = 0; i < 39; i++) expect(last).toContain(`validated-measurement-${i}=0.25`);
  }, 30000);

  it("runs real SeekBrain mode commands, a file tool and disk-session resume through AgentSession", async () => {
    const f = await fixture({ reply: (_p, i) => i === 0
      ? [thinking(), { type: "tool_use", id: "evidence-read", name: "read", input: { path: "evidence.csv" } }]
      : [thinking(), text("Retained evidence: effect=0.25; n=120.")] });
    await writeFile(join(f.root, "evidence.csv"), "effect,n\n0.25,120\n");
    const withFetch = (value: ModelRuntime) => {
      const stream = value.streamSimple.bind(value);
      value.streamSimple = (model, input, options) => stream(model, input, { ...options, fetch: f.fetch as any, cacheRetention: "none" });
      return value;
    };
    async function start(manager: SessionManager, value: ModelRuntime) {
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
      const resourceLoader = new DefaultResourceLoader({ cwd: f.root, agentDir: f.root, settingsManager,
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
        extensionFactories: [{ name: "seekbrain", factory: pi => registerSeekBrain(pi, { projectRoot: f.root, env: { SEEKBRAIN_USER_CONFIG: join(f.root, "missing.yaml") } }) }],
      });
      await resourceLoader.reload();
      const { session } = await createAgentSession({ cwd: f.root, agentDir: f.root, modelRuntime: withFetch(value),
        model: value.getModel("anthropic-relay", "claude-opus-5-5")!, thinkingLevel: "high", sessionManager: manager,
        settingsManager, resourceLoader, tools: ["read"],
      });
      await session.bindExtensions({});
      return session;
    }
    const manager = SessionManager.create(f.root, join(f.root, "sessions"));
    let session = await start(manager, f.firstRuntime);
    try {
      await session.prompt("Read evidence.csv and retain its effect and sample size.");
      expect(f.requests).toHaveLength(2);
      expect(JSON.stringify(f.requests[1])).toContain("0.25,120");
      for (const mode of ["ask", "plan", "research", "deep-research"]) {
        await session.prompt(`/${mode}`);
        await session.prompt("Continue using the same evidence.");
      }
      expect(f.requests).toHaveLength(6); expect(f.failures()).toBe(0);
      expect(JSON.stringify(f.requests.at(-1))).toContain("0.25,120");
      const file = manager.getSessionFile()!;
      expect(await readFile(file, "utf8")).toContain("fixture-signed-1");
      await session.dispose();
      session = await start(SessionManager.open(file), await f.runtime());
      await session.prompt("Resume and confirm the saved effect and sample size.");
      expect(f.requests).toHaveLength(7); expect(f.failures()).toBe(0);
      expect(thoughtIds(f.requests.at(-1))).toContain("fixture-signed-6");
      expect(await readFile(join(f.root, "evidence.csv"), "utf8")).toBe("effect,n\n0.25,120\n");
    } finally { await session.dispose(); }
  }, 30000);

  it("runs a scientific subagent with real SDK file reading and finalization", async () => {
    const f = await fixture({ reply: (_p, i) => i === 0
      ? [thinking(), { type: "tool_use", id: "child-read", name: "read", input: { path: "evidence.csv" } }]
      : [thinking(), { type: "tool_use", id: "child-finish", name: "finish", input: { effect: 0.25, n: 120 } }] });
    await writeFile(join(f.root, "evidence.csv"), "effect,n\n0.25,120\n");
    const stream = f.firstRuntime.streamSimple.bind(f.firstRuntime);
    f.firstRuntime.streamSimple = (model, input, options) => stream(model, input, { ...options, fetch: f.fetch as any, cacheRetention: "none" });
    const adapter = new ExistingPiAgentAdapter({ agentDir: f.root, loadEnvironment: async () => ({ SEEKBRAIN_CODING_AGENT_DIR: f.root }),
      codingSdkLoader: async () => ({ ...piSdk, ModelRuntime: { create: async () => f.firstRuntime } }) });
    const result = await adapter.run({ runDir: f.root, finalizeTool: "finish", finalizeSchema: { type: "object", properties: { effect: { type: "number" }, n: { type: "number" } }, required: ["effect", "n"] },
      prompt: "Read evidence.csv and finalize its measured effect and sample size.", tools: ["read"],
      agentConfig: { provider: "anthropic-relay", model: "claude-opus-5-5", thinking: "high" },
    });
    expect(result).toMatchObject({ ok: true, result: { effect: 0.25, n: 120 } });
    expect(f.requests).toHaveLength(2); expect(f.failures()).toBe(0);
    expect(thoughtIds(f.requests[1])).toEqual(["fixture-signed-1"]);
    expect(JSON.stringify(f.requests[1])).toContain("0.25,120");
  }, 30000);

  it("keeps native Anthropic, Opus 4.7 and other APIs on their original streams and installs only once", () => {
    const sentinel = createAssistantMessageEventStream(), original = vi.fn((..._args: any[]) => sentinel);
    const runtime = { stream: original, streamSimple: original };
    installAnthropicThinkingCompatibility(runtime);
    const installed = runtime.streamSimple; installAnthropicThinkingCompatibility(runtime);
    expect(runtime.streamSimple).toBe(installed);
    for (const model of [
      { id: "claude-opus-5-5", api: "anthropic-messages", compat: { supportsMidConvoEffort: true } },
      { id: "claude-opus-4-7", api: "anthropic-messages", compat: { supportsMidConvoEffort: false } },
      { id: "gpt-5.5", api: "openai-responses" },
    ]) expect(runtime.streamSimple(model as any, {} as any, {} as any)).toBe(sentinel);
    expect(original).toHaveBeenCalledTimes(3);
  });
});
