import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export class MemoryCache {
  readonly values = new Map<string, CacheEntry<unknown>>();
  readonly inflight = new Map<string, Promise<unknown>>();
  loaded = false;
  loadPromise?: Promise<void>;
  writeChain: Promise<void> = Promise.resolve();

  constructor(readonly defaultTtlMs = 15 * 60_000, readonly persistencePath?: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded || !this.persistencePath) return;
    if (!this.loadPromise) this.loadPromise = (async () => {
      try {
        const stored = JSON.parse(await readFile(this.persistencePath!, "utf8"));
        for (const [key, entry] of Object.entries(stored.entries || {})) {
          const candidate = entry as CacheEntry<unknown>;
          if (Number(candidate.expiresAt) > Date.now()) this.values.set(key, candidate);
        }
      } catch {
        // Missing, stale, or corrupt cache files are normal cache misses.
      } finally {
        this.loaded = true;
      }
    })();
    await this.loadPromise;
  }

  private async persist(): Promise<void> {
    if (!this.persistencePath) return;
    this.writeChain = this.writeChain.then(async () => {
      const entries = Object.fromEntries([...this.values.entries()].filter(([, entry]) => entry.expiresAt > Date.now()));
      await mkdir(dirname(this.persistencePath!), { recursive: true });
      const temporary = `${this.persistencePath}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(temporary, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`, "utf8");
      await chmod(temporary, 0o600);
      await rename(temporary, this.persistencePath!);
    });
    await this.writeChain;
  }

  get<T>(key: string): T | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): T {
    this.values.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlMs) });
    return value;
  }

  async getOrLoad<T>(key: string, loader: () => Promise<T>, ttlMs = this.defaultTtlMs): Promise<T> {
    await this.ensureLoaded();
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const pending = this.inflight.get(key);
    if (pending) return await pending as T;
    const created = loader().then((value) => this.set(key, value, ttlMs));
    this.inflight.set(key, created);
    try {
      const value = await created;
      await this.persist().catch(() => {});
      return value;
    } finally {
      this.inflight.delete(key);
    }
  }
}

export const literatureResponseCache = new MemoryCache(
  15 * 60_000,
  process.env.SEEKBRAIN_LITERATURE_CACHE || join(homedir(), ".cache", "seekbrain", "literature-cache.json"),
);
