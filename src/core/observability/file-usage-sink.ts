import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteJson } from "../state/atomic-json.ts";
import { PathPolicy } from "../artifacts/path-policy.ts";

type JsonObject = Record<string, unknown>;

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function readJson(path: string, fallback: JsonObject): Promise<JsonObject> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as JsonObject;
  } catch {
    return fallback;
  }
}

export interface UsageSink {
  append(runDir: string, component: string, entry: JsonObject): Promise<void>;
  flush(runDir: string): Promise<void>;
  flushAll(): Promise<void>;
}

export class FileUsageSink implements UsageSink {
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #queues = new Map<string, Promise<unknown>>();

  constructor(
    readonly enabled: () => boolean = () => true,
    readonly debounceMs = 300,
  ) {}

  async append(runDir: string, component: string, entry: JsonObject): Promise<void> {
    if (!this.enabled()) return;
    await this.#serial(runDir, async () => {
      const paths = new PathPolicy(runDir);
      if (!/^[a-zA-Z0-9_.-]+$/.test(component)) throw new Error(`Invalid usage component '${component}'`);
      const path = paths.resolve(join("usage", `${component}.json`));
      const existing = await readJson(path, { entries: [] });
      const entries = Array.isArray(existing.entries) ? existing.entries : [];
      await atomicWriteJson(path, { entries: [...entries, entry] });
    });
    this.schedule(runDir);
  }

  schedule(runDir: string): void {
    if (!this.enabled()) return;
    const existing = this.#timers.get(runDir);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.#timers.delete(runDir);
      this.flush(runDir).catch(() => {});
    }, this.debounceMs);
    this.#timers.set(runDir, timer);
  }

  async flush(runDir: string): Promise<void> {
    if (!this.enabled()) return;
    const pending = this.#timers.get(runDir);
    if (pending) clearTimeout(pending);
    this.#timers.delete(runDir);
    await this.#serial(runDir, async () => {
      const usageDir = new PathPolicy(runDir).resolve("usage");
      await mkdir(usageDir, { recursive: true });
      const files = await readdir(usageDir).catch(() => [] as string[]);
      const components: JsonObject[] = [];
      for (const file of files.sort()) {
        if (!file.endsWith(".json") || file === "summary.json") continue;
        const path = join(usageDir, file);
        const payload = await readJson(path, { entries: [] });
        const entries = Array.isArray(payload.entries) ? payload.entries as JsonObject[] : [];
        const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
        let cost = 0;
        for (const entry of entries) {
          const item = entry.tokens && typeof entry.tokens === "object" ? entry.tokens as JsonObject : {};
          tokens.input += finite(item.input);
          tokens.output += finite(item.output);
          tokens.cacheRead += finite(item.cacheRead);
          tokens.cacheWrite += finite(item.cacheWrite);
          tokens.total += finite(item.total) || finite(item.input) + finite(item.output) + finite(item.cacheRead) + finite(item.cacheWrite);
          cost += finite(entry.cost);
        }
        const cacheTokens = tokens.cacheRead + tokens.cacheWrite;
        components.push({
          component: file.replace(/\.json$/, ""), path, entries: entries.length, tokens,
          cache_tokens: cacheTokens,
          cache_rate: tokens.total > 0 ? cacheTokens / tokens.total : 0,
          cost,
        });
      }
      const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
      let cost = 0;
      for (const component of components) {
        const item = component.tokens as typeof tokens;
        tokens.input += item.input;
        tokens.output += item.output;
        tokens.cacheRead += item.cacheRead;
        tokens.cacheWrite += item.cacheWrite;
        tokens.total += item.total;
        cost += finite(component.cost);
      }
      const cacheTokens = tokens.cacheRead + tokens.cacheWrite;
      await atomicWriteJson(join(usageDir, "summary.json"), {
        work_dir: runDir,
        usage_dir: usageDir,
        updated_at: new Date().toISOString(),
        component_count: components.length,
        entry_count: components.reduce((sum, component) => sum + finite(component.entries), 0),
        tokens,
        cache_tokens: cacheTokens,
        cache_rate: tokens.total > 0 ? cacheTokens / tokens.total : 0,
        cost,
        components,
      });
    });
  }

  async flushAll(): Promise<void> {
    const runDirs = [...this.#timers.keys()];
    for (const runDir of runDirs) {
      const timer = this.#timers.get(runDir);
      if (timer) clearTimeout(timer);
      this.#timers.delete(runDir);
      await this.flush(runDir).catch(() => {});
    }
  }

  async #serial<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.#queues.set(key, current);
    try {
      return await current;
    } finally {
      if (this.#queues.get(key) === current) this.#queues.delete(key);
    }
  }
}
