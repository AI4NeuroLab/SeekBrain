import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CreateRun, RunRepository, StateMutation, WorkflowEvent } from "../ports/run-repository.ts";
import { atomicWriteJson } from "./atomic-json.ts";
import { migrateRunState, type RunStateDocument } from "./migrations.ts";

type RunDirectoryResolver = (runId: string) => string | Promise<string>;

export class FileRunRepository implements RunRepository {
  readonly #runDirectories = new Map<string, string>();
  readonly #queues = new Map<string, Promise<unknown>>();
  readonly #resolveRunDirectory?: RunDirectoryResolver;

  constructor(resolveRunDirectory?: RunDirectoryResolver) {
    this.#resolveRunDirectory = resolveRunDirectory;
  }

  async create(input: CreateRun): Promise<RunStateDocument> {
    const initial = migrateRunState({
      ...(input.initialState ?? {}),
      run_id: input.runId,
      run_dir: input.runDir,
      question: input.question,
      created_at: input.initialState?.created_at ?? new Date().toISOString(),
    }, { runId: input.runId, runDir: input.runDir });
    return await this.save(input.runId, input.runDir, initial);
  }

  async load(runId: string): Promise<RunStateDocument> {
    return await this.loadAt(runId, await this.#directory(runId));
  }

  async loadAt(runId: string, runDir: string): Promise<RunStateDocument> {
    this.#runDirectories.set(runId, resolve(runDir));
    return await this.#serial(runId, async () => {
      const path = this.statePath(runDir);
      const parsed = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      const migrated = migrateRunState(parsed, { runId, runDir: resolve(runDir) });
      if (JSON.stringify(parsed) !== JSON.stringify(migrated)) await atomicWriteJson(path, migrated);
      return migrated;
    });
  }

  async save(runId: string, runDir: string, state: Record<string, unknown>): Promise<RunStateDocument> {
    this.#runDirectories.set(runId, resolve(runDir));
    return await this.#serial(runId, async () => {
      const migrated = migrateRunState(state, { runId, runDir: resolve(runDir) });
      await atomicWriteJson(this.statePath(runDir), migrated);
      return migrated;
    });
  }

  async update(runId: string, mutation: StateMutation): Promise<RunStateDocument> {
    return await this.updateAt(runId, await this.#directory(runId), mutation);
  }

  async updateAt(runId: string, runDir: string, mutation: StateMutation): Promise<RunStateDocument> {
    this.#runDirectories.set(runId, resolve(runDir));
    return await this.#serial(runId, async () => {
      const path = this.statePath(runDir);
      const current = migrateRunState(
        JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>,
        { runId, runDir: resolve(runDir) },
      );
      const next = migrateRunState(mutation(Object.freeze({ ...current })), {
        runId,
        runDir: resolve(runDir),
      });
      await atomicWriteJson(path, next);
      return next;
    });
  }

  async appendEvent(runId: string, event: WorkflowEvent): Promise<void> {
    const runDir = await this.#directory(runId);
    await this.#serial(runId, async () => {
      await mkdir(runDir, { recursive: true });
      await appendFile(join(runDir, "events.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
    });
  }

  statePath(runDir: string): string {
    return join(resolve(runDir), "state.json");
  }

  async #directory(runId: string): Promise<string> {
    const known = this.#runDirectories.get(runId);
    if (known) return known;
    if (!this.#resolveRunDirectory) throw new Error(`No run directory registered for '${runId}'`);
    const resolved = resolve(await this.#resolveRunDirectory(runId));
    this.#runDirectories.set(runId, resolved);
    return resolved;
  }

  async #serial<T>(runId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#queues.get(runId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.#queues.set(runId, current);
    try {
      return await current;
    } finally {
      if (this.#queues.get(runId) === current) this.#queues.delete(runId);
    }
  }
}
