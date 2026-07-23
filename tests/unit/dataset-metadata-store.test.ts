import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DatasetMetadataStore } from "../../src/data-resolve/index.ts";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("DatasetMetadataStore", () => {
  it("persists metadata by canonical dataset identity and reuses it", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-data-store-"));
    cleanup.push(root);
    const dataDir = join(root, "sample data");
    const cacheRoot = join(root, "cache");
    await mkdir(dataDir);
    await writeFile(join(dataDir, "README.md"), "sample dataset\n");

    const store = new DatasetMetadataStore(cacheRoot);
    const identity = await store.identify(dataDir);
    expect(identity.datasetId).toMatch(/^sample-data-[a-f0-9]{16}$/);
    expect(await store.load(identity)).toBeUndefined();

    await store.save(identity, {
      root_dir: identity.canonicalRoot,
      description: "sample",
      data_type: "processed",
    }, { dataset_type: "C", warnings: [] });

    const cached = await store.load(await store.identify(dataDir));
    expect(cached?.metadata.description).toBe("sample");
    expect(cached?.manifest.dataset_type).toBe("C");
    expect(JSON.parse(await readFile(identity.metadataPath, "utf8")).root_dir).toBe(identity.canonicalRoot);
  });

  it("rejects metadata for a different root", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-data-root-"));
    cleanup.push(root);
    const dataDir = join(root, "dataset");
    await mkdir(dataDir);
    const store = new DatasetMetadataStore(join(root, "cache"));
    const identity = await store.identify(dataDir);
    await expect(store.save(identity, { root_dir: root })).rejects.toThrow(/root_dir must equal DATA_DIR/);
  });
});
