import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ArtifactPathError, ArtifactService, PathPolicy } from "../../src/core/index.ts";

describe("artifact boundary", () => {
  it("normalizes legacy and current artifacts inside the run directory", () => {
    const artifacts = new ArtifactService("/tmp/run");
    expect(artifacts.normalizeMany({ primary_figure: "figure.png" })).toEqual([{
      name: "primary_figure",
      path: "/tmp/run/figure.png",
      kind: "figure",
      optional: false,
      produced_by: undefined,
    }]);
    expect(artifacts.merge(
      [{ name: "code", path: "generated.py", kind: "code" }],
      [{ name: "updated", path: "generated.py", kind: "code", role: "main" }],
    )[0]).toMatchObject({ name: "updated", path: "/tmp/run/generated.py", role: "main" });
  });

  it("rejects traversal and absolute paths outside the run", () => {
    const paths = new PathPolicy("/tmp/run");
    expect(() => paths.resolve("../secret.txt")).toThrow(ArtifactPathError);
    expect(() => paths.resolve("/etc/passwd")).toThrow(ArtifactPathError);
    expect(paths.resolve("figures/main.png")).toBe("/tmp/run/figures/main.png");
  });

  it("rejects a path that escapes through a symlink", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-path-policy-"));
    const runDir = join(root, "run");
    const outside = join(root, "outside");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(runDir);
    await mkdir(outside);
    await symlink(outside, join(runDir, "linked"));
    try {
      expect(() => new PathPolicy(runDir).resolve("linked/secret.json")).toThrow(ArtifactPathError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
