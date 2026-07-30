import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const root = await mkdtemp(join(tmpdir(), "seekbrain-data-resolve-tool-"));
const previousCache = process.env.SEEKBRAIN_DATASET_CACHE_ROOT;
process.env.SEEKBRAIN_DATASET_CACHE_ROOT = join(root, "cache");

try {
  const jiti = createJiti(import.meta.url);
  const { DatasetMetadataStore, profileDatasetDeterministically } = await jiti.import("../src/data-resolve/index.ts");
  const dataDir = join(root, "dataset");
  await mkdir(dataDir);
  await mkdir(join(dataDir, ".hidden"));
  await writeFile(join(dataDir, ".hidden", "ignored.npy"), "not an npy");
  for (const fish of [1, 2, 3]) {
    const fishDir = join(dataDir, `fish${fish}`);
    await mkdir(fishDir);
    const header = "{'descr': '<f4', 'fortran_order': False, 'shape': (600, 42), }";
    const padded = `${header}${" ".repeat((64 - ((10 + header.length + 1) % 64)) % 64)}\n`;
    const prefix = Buffer.alloc(10);
    Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]).copy(prefix);
    prefix.writeUInt16LE(Buffer.byteLength(padded), 8);
    await writeFile(join(fishDir, "region_series.npy"), Buffer.concat([prefix, Buffer.from(padded)]));
  }
  const profile = await profileDatasetDeterministically(dataDir);
  assert.equal(profile.datasetType, "A");
  assert.equal(profile.metadata.schema_version, 7);
  assert.equal(profile.metadata.layout_patterns.some((item) => item.pattern === "fish*" && item.count === 3), true);
  const regionFamily = profile.metadata.asset_families.find((asset) => asset.pattern.endsWith("region_series.npy"));
  const regionSchema = regionFamily.schema_variants[0];
  assert.deepEqual(regionSchema.shape, [600, 42]);
  assert.equal(regionSchema.dtype, "<f4");
  assert.equal(profile.metadata.asset_families.some((asset) => asset.pattern.includes(".hidden")), false);
  const vectorDir = join(dataDir, "fish4");
  await mkdir(vectorDir);
  const vectorHeader = "{'descr': '<f8', 'fortran_order': False, 'shape': (66602,), }";
  const vectorPadded = `${vectorHeader}${" ".repeat((64 - ((10 + vectorHeader.length + 1) % 64)) % 64)}\n`;
  const vectorPrefix = Buffer.alloc(10);
  Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]).copy(vectorPrefix);
  vectorPrefix.writeUInt16LE(Buffer.byteLength(vectorPadded), 8);
  await writeFile(join(vectorDir, "correlations.npy"), Buffer.concat([vectorPrefix, Buffer.from(vectorPadded)]));
  const vectorProfile = await profileDatasetDeterministically(dataDir);
  const vectorAsset = vectorProfile.metadata.asset_families.find((asset) => asset.pattern.endsWith("correlations.npy"));
  const vectorSchema = vectorAsset.schema_variants[0];
  assert.deepEqual(vectorSchema.shape, [66602]);

  const morphologyDir = join(dataDir, "Morphology", "Registered", "Left");
  await mkdir(morphologyDir, { recursive: true });
  for (const name of ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu"]) {
    await writeFile(join(morphologyDir, `${name}.swc`), "# SWC\n1 1 0 0 0 1 -1\n2 3 1 0 0 0.5 1\n");
  }
  const masksDir = join(dataDir, "AtlasMasks");
  await mkdir(masksDir, { recursive: true });
  for (const name of ["forebrain", "midbrain", "hindbrain", "tectum", "thalamus", "habenula", "cerebellum", "hypothalamus"]) {
    await writeFile(join(masksDir, `${name}_mask.npy`), Buffer.concat([vectorPrefix, Buffer.from(vectorPadded)]));
  }
  for (const name of ["ridge_score_BY01_subject_1", "ridge_score_JY02_subject_2", "ridge_score_KZ03_subject_3", "ridge_score_LM04_subject_4"]) {
    await writeFile(join(dataDir, `${name}.npy`), Buffer.concat([vectorPrefix, Buffer.from(vectorPadded)]));
  }
  const collectionProfile = await profileDatasetDeterministically(dataDir);
  const morphologyFamily = collectionProfile.metadata.asset_families.find((asset) => asset.role === "neuron_morphology");
  assert.equal(morphologyFamily.pattern, "Morphology/Registered/Left/*.swc");
  assert.equal(morphologyFamily.count, 12);
  assert.equal(morphologyFamily.member_dimension, "neuron");
  assert.equal(morphologyFamily.schema_variants[0].record_type, "swc_neuron_morphology");
  const maskFamily = collectionProfile.metadata.asset_families.find((asset) => asset.pattern === "AtlasMasks/*.npy");
  assert.equal(maskFamily.count, 8);
  assert.equal(maskFamily.role, "anatomical_label");
  assert.equal(maskFamily.member_dimension, "region_or_label");
  assert.deepEqual(maskFamily.schema_variants[0].shape, [66602]);
  const learnedResultFamily = collectionProfile.metadata.asset_families.find((asset) => asset.pattern === "ridge_score_*.npy");
  assert.equal(learnedResultFamily.count, 4);
  assert.equal(learnedResultFamily.role, "derived_analysis");
  assert.equal(learnedResultFamily.member_dimension, "result");
  const store = new DatasetMetadataStore();
  const identity = await store.identify(dataDir);
  await store.save(identity, collectionProfile.metadata, { dataset_type: collectionProfile.datasetType, warnings: [] });
  const manifest = JSON.parse(await readFile(identity.manifestPath, "utf8"));
  assert.equal(manifest.schema_version, 7);

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
    { data_dir: dataDir },
    new AbortController().signal,
    () => {},
    { cwd: root, hasUI: false },
  );
  assert.equal(resolved.details.ok, true);
  assert.equal(resolved.details.source, "cache");
  assert.equal(resolved.details.generated, false);
  assert.equal(resolved.details.metadata.schema_version, 7);
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
  assert.equal(started.details.metadata_json_path, identity.metadataPath);
  assert.equal(started.details.dataset_meta_snapshot_path, undefined);
  const canonical = JSON.parse(await readFile(started.details.metadata_json_path, "utf8"));
  assert.equal(canonical.schema_version, 7);
  const state = JSON.parse(await readFile(started.details.state_path, "utf8"));
  assert.equal(state.data_info, undefined);
  assert.equal(state.metadata_json_path, identity.metadataPath);
} finally {
  if (previousCache === undefined) delete process.env.SEEKBRAIN_DATASET_CACHE_ROOT;
  else process.env.SEEKBRAIN_DATASET_CACHE_ROOT = previousCache;
  await rm(root, { recursive: true, force: true });
}

console.log("Data Resolve reuses one canonical metadata file without a round-local duplicate");
