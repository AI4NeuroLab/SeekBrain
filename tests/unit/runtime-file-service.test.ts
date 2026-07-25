import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  artifactStamps,
  readJson,
  resolveFromCwd,
  unifiedDiff,
  writeJson,
  writeText,
} from "../../src/extension/runtime/shared/file-service.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("runtime file service", () => {
  it("reads and atomically writes JSON with a fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-file-service-"));
    roots.push(root);
    const path = join(root, "nested", "state.json");
    await writeJson(path, { ok: true });
    expect(await readJson(path)).toEqual({ ok: true });
    expect(await readJson(join(root, "missing.json"), { missing: true })).toEqual({ missing: true });
  });

  it("writes text, resolves paths, diffs content, and records stamps", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-file-service-"));
    roots.push(root);
    const path = join(root, "nested", "result.txt");
    await writeText(path, "after\n");

    expect(await readFile(path, "utf8")).toBe("after\n");
    expect(resolveFromCwd(root, undefined, "fallback.txt")).toBe(join(root, "fallback.txt"));
    expect(unifiedDiff("before\n", "after\n", "a", "b")).toContain("-before");
    expect(unifiedDiff("same", "same", "a", "b")).toContain("No changes.");
    expect(await artifactStamps([path, join(root, "missing")])).toMatchObject({
      [path]: { exists: true, size: 6 },
      [join(root, "missing")]: { exists: false, size: 0 },
    });
  });
});

