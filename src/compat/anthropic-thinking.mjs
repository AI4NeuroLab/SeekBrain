import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

const INSTALLED = Symbol.for("seekbrain.anthropic-thinking-compat.v1");
const digest = value => createHash("sha256").update(value).digest("hex");
const isThinking = block => block?.type === "thinking" || block?.type === "redacted_thinking";
const blockId = block => digest(`${block.type}:${block.signature ?? block.data ?? ""}`);

// Object key order and moving cache breakpoints are transport details. Do not
// remove cache_control from tool inputs: it can be a real research parameter.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
function blockContent(block) {
  const { cache_control, ...content } = block;
  if (content.type === "tool_result" && Array.isArray(content.content)) content.content = content.content.map(blockContent);
  return content;
}
const blocks = content => typeof content === "string" ? [{ type: "text", text: content }] : content ?? [];
const extend = (prefix, value) => digest(`${prefix}\n${JSON.stringify(canonical(value))}`);

function seed(payload, model) {
  return extend("seekbrain-thinking-prefix-v1", {
    provider: model.provider, model: payload.model,
    system: blocks(payload.system).map(blockContent), tools: (payload.tools ?? []).map(blockContent),
  });
}

/** Hash-only metadata; the original conversation, thinking and files stay intact. */
class Bindings {
  known = new Map();
  removed = new Set();
  dirty = false;
  constructor(path) {
    this.path = path;
    if (!path) return;
    try {
      const saved = JSON.parse(readFileSync(path, "utf8"));
      if (saved.version !== 1) return;
      const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
      this.known = new Map((saved.bindings ?? []).filter(pair => Array.isArray(pair) && pair.length === 2 && pair.every(hash)));
      this.removed = new Set((saved.removed ?? []).filter(hash));
    } catch { /* Old/imported sessions recover once if the server rejects them. */ }
  }
  forget(block) {
    const id = blockId(block);
    if (!this.removed.has(id)) { this.removed.add(id); this.dirty = true; }
    this.known.delete(id);
  }
  remember(id, prefix) {
    if (this.removed.has(id) || this.known.get(id) === prefix) return;
    this.known.set(id, prefix); this.dirty = true;
  }
  save() {
    if (!this.path || !this.dirty) return;
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
      writeFileSync(temporary, JSON.stringify({ version: 1, bindings: [...this.known], removed: [...this.removed] }), { mode: 0o600 });
      renameSync(temporary, this.path);
      this.dirty = false;
    } catch {
      // A read-only agent directory must not turn a successful model call into a
      // failure. In-memory tombstones still work; a restart can recover on 400.
      try { rmSync(temporary, { force: true }); } catch { /* best effort */ }
    }
  }
}

/** Filter at the actual wire boundary, after every extension's payload edits. */
function prepare(payload, model, state, forceFrom) {
  let prefix = seed(payload, model), invalidateRest = false;
  const removedIds = [];
  const messages = [];
  for (const [mi, message] of payload.messages.entries()) {
    let cursor = extend(prefix, { role: message.role });
    const content = [];
    for (const [bi, block] of blocks(message.content).entries()) {
      if (message.role === "assistant" && isThinking(block)) {
        const id = blockId(block), expected = state.known.get(id);
        if (forceFrom && (mi > forceFrom[0] || (mi === forceFrom[0] && bi >= forceFrom[1]))) invalidateRest = true;
        // A previously removed block can reappear in Pi's original transcript.
        // Skip it without invalidating NEW reasoning minted on the cleaned view.
        if (invalidateRest || state.removed.has(id) || (expected !== undefined && expected !== cursor)) {
          if (!state.removed.has(id)) invalidateRest = true;
          state.forget(block); removedIds.push(id); continue;
        }
      }
      content.push(block);
      cursor = extend(cursor, blockContent(block));
    }
    if (message.role === "assistant" && content.length === 0 && blocks(message.content).some(isThinking)) continue;
    messages.push(content.length === blocks(message.content).length ? message : { ...message, content });
    prefix = extend(cursor, { end: message.role });
  }
  return { payload: removedIds.length ? { ...payload, messages } : payload, removed: removedIds.length, removedIds };
}

function remember(payload, model, state, assistant) {
  let prefix = seed(payload, model);
  for (const message of [...payload.messages, ...(assistant ? [assistant] : [])]) {
    prefix = extend(prefix, { role: message.role });
    for (const block of blocks(message.content)) {
      if (message.role === "assistant" && isThinking(block)) state.remember(blockId(block), prefix);
      prefix = extend(prefix, blockContent(block));
    }
    prefix = extend(prefix, { end: message.role });
  }
  state.save();
}

function responseCollector() {
  const content = [];
  return {
    event(event) {
      if (event.type === "content_block_start") content[event.index] = { ...event.content_block };
      const block = content[event.index];
      if (event.type === "content_block_delta" && block) {
        const delta = event.delta;
        if (delta.type === "text_delta") block.text = (block.text ?? "") + delta.text;
        if (delta.type === "thinking_delta") block.thinking = (block.thinking ?? "") + delta.thinking;
        if (delta.type === "signature_delta") block.signature = (block.signature ?? "") + delta.signature;
        if (delta.type === "input_json_delta") block.partialJson = (block.partialJson ?? "") + delta.partial_json;
      }
      if (event.type === "content_block_stop" && block?.partialJson) {
        try { block.input = JSON.parse(block.partialJson); } catch { /* Partial/aborted streams are not remembered. */ }
      }
    },
    message() {
      // Match pi's Anthropic conversion, which omits blank text and response-only
      // fields such as citations. Never turn thinking into ordinary prompt text.
      return { role: "assistant", content: content.filter(Boolean).flatMap(block => {
        if (block.type === "text") return block.text?.trim() ? [{ type: "text", text: block.text }] : [];
        if (block.type === "thinking") return [{ type: "thinking", thinking: block.thinking ?? "", signature: block.signature ?? "" }];
        if (block.type === "redacted_thinking") return [{ type: "redacted_thinking", data: block.data }];
        if (block.type === "tool_use") return [{ type: "tool_use", id: block.id, name: block.name, input: block.input ?? {} }];
        return [];
      }) };
    },
  };
}

function mismatch(error) {
  const message = error?.errorMessage ?? "";
  // Do not retry malformed signatures, beta/config errors, auth errors, or a
  // broken stream. This fallback is only for the explicit prefix-binding error.
  return /Invalid\s+`?signature`?\s+in\s+`?thinking`?\s+block/i.test(message)
    && /bound to a different conversation|prefix_mismatch_behavior/i.test(message);
}
function mismatchPosition(message) {
  const match = message.match(/messages(?:\.|\[)(\d+)\]?\.content(?:\.|\[)(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

function diagnostic(message, removed, recovered) {
  if (!removed && !recovered) return;
  message.diagnostics = [...(message.diagnostics ?? []), {
    type: "seekbrain_thinking_compatibility", timestamp: Date.now(),
    details: { removedBlocks: removed, recoveredFromPrefixMismatch: recovered },
  }];
}

function compatibleStream(invoke, model, context, options, state) {
  const output = createAssistantMessageEventStream();
  void (async () => {
    const removed = new Set();
    let recovered = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      let payload, startedContent = false, start, retry = false, requestModel = model;
      const collector = responseCollector();
      const source = invoke(model, context, {
        ...options,
        onPayload: async (value, physicalModel) => {
          const edited = await options?.onPayload?.(value, physicalModel) ?? value;
          // The wrapper is restricted to the Anthropic Messages wire format.
          if (!Array.isArray(edited?.messages)) return edited;
          requestModel = physicalModel ?? model;
          const prepared = prepare(edited, requestModel, state);
          payload = prepared.payload;
          for (const id of prepared.removedIds) removed.add(id);
          state.save();
          return payload;
        },
        onProviderStreamEvent: async (event, physicalModel) => {
          const transformations = event.message?.input_transformations ?? event.input_transformations;
          if (payload && Array.isArray(transformations)) {
            for (const item of transformations) {
              const point = item.path?.match(/^messages\.(\d+)\.content\.(\d+)$/);
              const block = point && payload.messages[Number(point[1])]?.content?.[Number(point[2])];
              if (isThinking(block)) { state.forget(block); removed.add(blockId(block)); }
            }
            payload = prepare(payload, requestModel, state).payload;
            state.save();
          }
          collector.event(event);
          await options?.onProviderStreamEvent?.(event, physicalModel);
        },
      });
      for await (let event of source) {
        if (event.type === "start") { start = event; continue; }
        if (event.type === "error" && options?.signal?.aborted) {
          event = { ...event, reason: "aborted", error: { ...event.error, stopReason: "aborted" } };
        }
        if (event.type === "error" && attempt === 0 && !startedContent && !options?.signal?.aborted && payload && mismatch(event.error)) {
          const clean = prepare(payload, requestModel, state, mismatchPosition(event.error.errorMessage));
          if (clean.removed > 0) {
            for (const id of clean.removedIds) removed.add(id);
            state.save(); recovered = true; retry = true; break;
          }
        }
        if (start) { output.push(start); start = undefined; }
        if (event.type === "done") {
          if (payload) remember(payload, requestModel, state, collector.message());
          diagnostic(event.message, removed.size, recovered);
        } else if (event.type === "error") diagnostic(event.error, removed.size, recovered);
        else startedContent = true;
        output.push(event);
      }
      if (!retry) { output.end(); return; }
    }
  })().catch(error => {
    output.push({ type: "error", reason: options?.signal?.aborted ? "aborted" : "error", error: {
      role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: options?.signal?.aborted ? "aborted" : "error", errorMessage: String(error), timestamp: Date.now(),
    } });
    output.end();
  });
  return output;
}

/** Install on an owned runtime, or on pi's prototype inside the SeekBrain CLI. */
export function installAnthropicThinkingCompatibility(runtime, options = {}) {
  if (!runtime || runtime[INSTALLED]) return runtime;
  const agentDir = options.agentDir || process.env.SEEKBRAIN_CODING_AGENT_DIR || process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  const states = new Map();
  let installed = false;
  for (const name of ["stream", "streamSimple"]) {
    const original = runtime[name];
    if (typeof original !== "function" || original[INSTALLED]) continue;
    const wrapped = function(model, context, streamOptions) {
      // Native Anthropic and other models retain pi's own behavior. The relay's
      // disabled mid-conversation effort feature also disables its drop_block.
      if (model?.api !== "anthropic-messages" || model.compat?.supportsMidConvoEffort !== false || !/^claude-opus-5-5(?:$|[-.:])/i.test(model.id)) {
        return original.call(this, model, context, streamOptions);
      }
      const sessionId = streamOptions?.sessionId;
      const key = sessionId ? digest(JSON.stringify([sessionId, model.provider, model.id])) : undefined;
      let state = key ? states.get(key) : undefined;
      if (!state) {
        state = new Bindings(key ? join(options.stateDir ?? join(agentDir, "seekbrain", "thinking-bindings"), `${key}.json`) : undefined);
        if (key) {
          if (states.size >= 128) states.delete(states.keys().next().value);
          states.set(key, state);
        }
      }
      return compatibleStream(original.bind(this), model, context, streamOptions, state);
    };
    wrapped[INSTALLED] = true;
    Object.defineProperty(runtime, name, { value: wrapped, configurable: true, writable: true });
    installed = true;
  }
  // This also passes through session-scoped proxies. Marking only the function
  // misses a proxy's bound/env wrapper and can install the shim twice.
  if (installed) Object.defineProperty(runtime, INSTALLED, { value: true, configurable: true });
  return runtime;
}
