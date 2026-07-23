import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRunRepository } from "../../src/core/index.ts";

describe("FileRunRepository", () => {
  it("creates versioned state and serializes concurrent updates", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-repository-"));
    try {
      const repository = new FileRunRepository();
      const runDir = join(root, "run-1");
      await repository.create({
        runId: "run-1",
        runDir,
        question: "question",
        initialState: { artifacts: [], counter: 0 },
      });

      await Promise.all(Array.from({ length: 20 }, () => repository.update("run-1", (state) => ({
        ...state,
        counter: Number(state.counter) + 1,
      }))));

      const state = await repository.load("run-1");
      expect(state.schema_version).toBe(2);
      expect(state.run_id).toBe("run-1");
      expect(state.counter).toBe(20);
      expect((await readdir(runDir)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("migrates a v1 state in place and appends events", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-migration-"));
    try {
      const runDir = join(root, "legacy");
      const repository = new FileRunRepository();
      await repository.create({ runId: "bootstrap", runDir, question: "bootstrap" });
      await writeFile(join(runDir, "state.json"), JSON.stringify({
        schema_version: 1,
        run_id: "legacy-run",
        question: "legacy",
        artifacts: { primary_figure: "figure.png" },
      }));

      const state = await repository.loadAt("legacy-run", runDir);
      expect(state.schema_version).toBe(2);
      expect(state.artifacts).toEqual([
        { name: "primary_figure", path: "figure.png", kind: "figure" },
      ]);
      expect(JSON.parse(await readFile(join(runDir, "state.json"), "utf8")).schema_version).toBe(2);

      await repository.appendEvent("legacy-run", { type: "loaded", at: "2026-07-20T00:00:00.000Z" });
      expect(await readFile(join(runDir, "events.jsonl"), "utf8")).toContain('"type":"loaded"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
