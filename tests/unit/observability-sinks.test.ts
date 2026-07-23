import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileDiagnosticSink, FileUsageSink } from "../../src/core/index.ts";

describe("observability sinks", () => {
  it("serializes usage entries and preserves the existing summary shape", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "seekbrain-usage-"));
    try {
      const sink = new FileUsageSink(() => true, 60_000);
      await Promise.all(Array.from({ length: 10 }, (_, index) => sink.append(runDir, "plan", {
        cost: 0.1,
        tokens: { input: index + 1, output: 2, cacheRead: 3, cacheWrite: 0, total: index + 6 },
      })));
      await sink.flush(runDir);
      const summary = JSON.parse(await readFile(join(runDir, "usage", "summary.json"), "utf8"));
      expect(summary.entry_count).toBe(10);
      expect(summary.tokens.input).toBe(55);
      expect(summary.tokens.total).toBe(105);
      expect(summary.cost).toBeCloseTo(1);
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });

  it("turns unsafe diagnostic writes into warnings", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "seekbrain-diagnostics-"));
    try {
      const warnings: Array<{ type: string }> = [];
      const sink = new FileDiagnosticSink(runDir);
      await sink.json("../outside.json", { unsafe: true }, warnings as never[]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe("diagnostic_write_failed");
      await sink.appendJsonl("events.jsonl", { event: "ok" }, warnings as never[]);
      expect(await readFile(join(runDir, "events.jsonl"), "utf8")).toBe('{"event":"ok"}\n');
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });
});
