import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatasetTools } from "../../src/extension/runtime/stages/dataset-tools.ts";

function npyHeader(shape: number[]) {
  const tuple = shape.length === 1 ? `${shape[0]},` : shape.join(", ");
  const body = `{'descr': '<f8', 'fortran_order': False, 'shape': (${tuple}), }`;
  const padding = " ".repeat((16 - ((10 + body.length + 1) % 16)) % 16);
  const header = Buffer.from(`${body}${padding}\n`, "latin1");
  const prefix = Buffer.alloc(10);
  Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]).copy(prefix);
  prefix.writeUInt16LE(header.length, 8);
  return Buffer.concat([prefix, header]);
}

describe("dataset resolve tool", () => {
  it("uses the deterministic profiler without invoking the agent fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-deterministic-resolve-"));
    try {
      const dataDir = join(root, "dataset");
      await mkdir(join(dataDir, "main05", "fish1", "pre"), { recursive: true });
      await mkdir(join(dataDir, "main05", "fish1", "post"), { recursive: true });
      await writeFile(join(dataDir, "main05", "fish1", "pre", "labels.txt"), "A\nB\n");
      await writeFile(join(dataDir, "main05", "fish1", "post", "labels.txt"), "A\nB\n");
      let fallbackCalls = 0;
      const [tool] = createDatasetTools({
        loadConfig: async () => ({ paths: { dataset_cache: join(root, "cache") } }),
        readPrompt: async () => "fallback",
        pickAgentConfig: () => ({}),
        runSubagent: async () => {
          fallbackCalls += 1;
          throw new Error("fallback must not run");
        },
        content: (details) => ({ details }),
      });
      const result = await tool.execute(
        "resolve",
        { data_dir: dataDir },
        new AbortController().signal,
        () => undefined,
        { cwd: root } as any,
      ) as any;

      expect(fallbackCalls).toBe(0);
      expect(result.details).toMatchObject({ ok: true, generated: true, profiler: "deterministic" });
      expect(result.details.data_info).toBeUndefined();
      expect(result.details.metadata).toMatchObject({ schema_version: 7, dataset_type: "repeated_subjects_or_sessions", quality: { status: "complete" } });
      expect(result.details.metadata.asset_families[0]).toMatchObject({ pattern: "main*/fish*/post/labels.txt", format: "txt" });
      expect(result.details.metadata.relationships[0]).toMatchObject({ kind: "unit_stage", stages: ["post", "pre"], count: 1 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses one tool-free semantic pass when a scientific family cannot be classified", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-semantic-resolve-"));
    try {
      const dataDir = join(root, "dataset");
      await mkdir(dataDir, { recursive: true });
      await writeFile(join(dataDir, "measurements.npy"), npyHeader([4, 2]));
      let semanticCalls = 0;
      const [tool] = createDatasetTools({
        loadConfig: async () => ({ paths: { dataset_cache: join(root, "cache") } }),
        readPrompt: async () => "semantic contract",
        pickAgentConfig: () => ({ thinking: "off" }),
        runSubagent: async (input) => {
          semanticCalls += 1;
          expect(input.tools).toEqual([]);
          expect(input.prompt).toContain("measurements.npy");
          return { ok: true, result: {
            description: "A numeric neural measurement collection.",
            family_updates: [{ family_id: "family_1", role: "neural_activity", axis_semantics: ["cell", "time"], evidence: ["family_1", "measurements.npy", "shape [4,2]"] }],
            warnings: [],
          } };
        },
        content: (details) => ({ details }),
      });
      const result = await tool.execute("resolve", { data_dir: dataDir }, new AbortController().signal, () => undefined, { cwd: root } as any) as any;
      expect(semanticCalls).toBe(1);
      expect(result.details).toMatchObject({ ok: true, profiler: "deterministic+semantic" });
      expect(result.details.metadata).toMatchObject({
        schema_version: 7,
        description: "A numeric neural measurement collection.",
        quality: { status: "complete" },
        asset_families: [{ id: "family_1", role: "neural_activity", axis_semantics: ["cell", "time"] }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("saves structurally complete metadata without launching an unbounded semantic fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-bounded-semantic-resolve-"));
    try {
      const dataDir = join(root, "dataset");
      await mkdir(dataDir, { recursive: true });
      const names = [
        "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india",
        "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo",
        "sierra", "tango", "uniform", "victor", "whiskey", "xray", "yankee",
      ];
      for (const name of names) await writeFile(join(dataDir, `${name}.npy`), npyHeader([4, 2]));
      let semanticCalls = 0;
      const [tool] = createDatasetTools({
        loadConfig: async () => ({ paths: { dataset_cache: join(root, "cache") } }),
        readPrompt: async () => "semantic contract",
        pickAgentConfig: () => ({ thinking: "off" }),
        runSubagent: async () => {
          semanticCalls += 1;
          throw new Error("large ambiguity must not launch semantic fallback");
        },
        content: (details) => ({ details }),
      });
      const result = await tool.execute("resolve", { data_dir: dataDir }, new AbortController().signal, () => undefined, { cwd: root } as any) as any;
      expect(semanticCalls).toBe(0);
      expect(result.details).toMatchObject({ ok: true, profiler: "deterministic" });
      expect(result.details.metadata.quality).toMatchObject({
        status: "complete",
        semantic: { status: "partial", ambiguous_collection_count: 25 },
      });
      expect(result.details.warnings.join("\n")).toContain("Semantic enrichment was skipped for 25 ambiguous structural collections");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps structural metadata when optional semantic enrichment fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-optional-semantic-resolve-"));
    try {
      const dataDir = join(root, "dataset");
      await mkdir(dataDir, { recursive: true });
      await writeFile(join(dataDir, "ambiguous_measurement.npy"), "not a valid npy header");
      const [tool] = createDatasetTools({
        loadConfig: async () => ({ paths: { dataset_cache: join(root, "cache") } }),
        readPrompt: async () => "semantic contract",
        pickAgentConfig: () => ({ thinking: "off" }),
        runSubagent: async () => ({ ok: false, error: "model unavailable" }),
        content: (details) => ({ details }),
      });
      const result = await tool.execute("resolve", { data_dir: dataDir }, new AbortController().signal, () => undefined, { cwd: root } as any) as any;
      expect(result.details).toMatchObject({ ok: true, profiler: "deterministic" });
      expect(result.details.metadata.quality).toMatchObject({
        status: "complete",
        structural: { status: "complete" },
        schema: { status: "partial", uninspectable_collection_count: 1 },
        semantic: { status: "partial" },
      });
      expect(result.details.metadata.quality.checks.inspectable_headers_present).toBe(false);
      expect(result.details.warnings.join("\n")).toContain("Schema inspection was unavailable for 1 structural collections");
      expect(result.details.warnings.join("\n")).toContain("Optional semantic enrichment did not complete: model unavailable");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
