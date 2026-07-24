import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const root = await mkdtemp(join(tmpdir(), "seekbrain-data-resolve-tool-"));
const previousCache = process.env.SEEKBRAIN_DATASET_CACHE_ROOT;
process.env.SEEKBRAIN_DATASET_CACHE_ROOT = join(root, "cache");

try {
  const jiti = createJiti(import.meta.url);
  const { DatasetMetadataStore } = await jiti.import("../src/data-resolve/index.ts");
  const dataDir = join(root, "dataset");
  await mkdir(dataDir);
  const store = new DatasetMetadataStore();
  const identity = await store.identify(dataDir);
  await store.save(identity, {
    root_dir: identity.canonicalRoot,
    description: "cached test dataset",
    data_type: "processed outputs",
  }, { dataset_type: "C", warnings: [] });

  const { default: registerSeekBrain } = await jiti.import("../src/extension/index.ts");
  const tools = [];
  await registerSeekBrain({
    on() {},
    registerCommand() {},
    registerTool(tool) { tools.push(tool); },
    async appendEntry() {},
    sendMessage() {},
  });

  const resolveTool = tools.find((tool) => tool.name === "seekbrain_data_resolve");
  assert.ok(resolveTool, "seekbrain_data_resolve must be registered");
  const resolved = await resolveTool.execute(
    "resolve-cache-hit",
    { data_dir: dataDir, question: "test" },
    new AbortController().signal,
    () => {},
    { cwd: root, hasUI: false },
  );
  assert.equal(resolved.details.ok, true);
  assert.equal(resolved.details.source, "cache");
  assert.equal(resolved.details.generated, false);
  assert.equal(resolved.details.metadata.description, "cached test dataset");
  assert.equal(resolved.details.metadata_path, identity.metadataPath);

  const startTool = tools.find((tool) => tool.name === "seekbrain_research_start");
  const started = await startTool.execute(
    "start-with-resolved-data",
    {
      project_dir: join(root, "research"),
      question: "test",
      metadata_json_path: resolved.details.metadata_path,
    },
    new AbortController().signal,
    () => {},
    { cwd: root, hasUI: false },
  );
  const snapshot = JSON.parse(await readFile(started.details.dataset_meta_snapshot_path, "utf8"));
  assert.equal(snapshot.metadata.description, "cached test dataset");
  assert.equal(snapshot.metadata_json_path, identity.metadataPath);
  const state = JSON.parse(await readFile(started.details.state_path, "utf8"));
  assert.equal(JSON.parse(state.data_info).description, "cached test dataset");
} finally {
  if (previousCache === undefined) delete process.env.SEEKBRAIN_DATASET_CACHE_ROOT;
  else process.env.SEEKBRAIN_DATASET_CACHE_ROOT = previousCache;
  await rm(root, { recursive: true, force: true });
}

console.log("Data Resolve reuses persistent metadata and snapshots it into the research round");
