import { open, readdir, realpath, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pythonProcessEnvironment, resolvePythonCommand } from "../platform/python.mjs";
import { stopProcessTree } from "../platform/process-tree.mjs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";

type Json = Record<string, any>;

export const DATASET_ROLES = [
  "neural_activity", "molecular_feature", "behavior_feature", "stimulus_feature",
  "electrophysiology", "neuron_morphology", "spatial_coordinate", "anatomical_label", "roi_selection",
  "subject_index", "timing", "experiment_metadata", "acquisition_configuration",
  "derived_analysis", "documentation", "opaque_binary",
] as const;

const SKIP_DIRECTORIES = new Set([
  ".git", ".claude", ".codex", ".agents", "node_modules", "__pycache__",
  "results", "tmp", "temp", "cache",
]);
const STAGE_NAMES = new Set(["pre", "post", "habenula", "learning", "learn", "training", "train"]);
const DIRECTORY_CONCURRENCY = 8;
const HDF5_SCHEMA_LIMIT = 64;
const HEADER_FORMATS = new Set(["npy", "npz", "h5", "hdf5", "nwb", "mat", "json", "csv", "tsv", "txt", "md", "swc", "nrrd", "tif", "tiff", "nii", "nii.gz"]);
const PYTHON_PROBE_FORMATS = new Set(["h5", "hdf5", "nwb", "npz", "mat", "tif", "tiff", "nii", "nii.gz"]);
const SCIENTIFIC_FORMATS = new Set(["npy", "npz", "h5", "hdf5", "nwb", "mat", "csv", "tsv", "swc", "nrrd", "nii", "nii.gz", "tif", "tiff"]);
const STANDARD_RECORD_FORMATS: Record<string, { role: string; member_dimension: string }> = {
  swc: { role: "neuron_morphology", member_dimension: "neuron" },
};
const EARLY_COLLECTION_FORMATS = new Set(["tif", "tiff", "nii", "nii.gz", "nrrd"]);
const EARLY_COLLECTION_MIN_FILES = 8;
const COLLECTION_MEMBER_DIMENSIONS: Record<string, string> = {
  neural_activity: "recording",
  molecular_feature: "gene_or_sample",
  behavior_feature: "trial_or_recording",
  stimulus_feature: "trial_or_recording",
  electrophysiology: "recording",
  neuron_morphology: "neuron",
  spatial_coordinate: "item",
  anatomical_label: "region_or_label",
  roi_selection: "roi",
  subject_index: "subject",
  derived_analysis: "result",
};
const COLLECTION_MIN_FINE_FAMILIES = 8;
const CELL_ALIGNABLE_ROLES = new Set([
  "neural_activity", "molecular_feature", "spatial_coordinate", "anatomical_label",
  "subject_index", "behavior_feature", "stimulus_feature",
]);

interface WalkEntry {
  path: string;
  isDirectory: boolean;
}

interface SchemaSample {
  path: string;
  unit?: string;
  schema: Json;
}

interface FileFamily {
  id: string;
  pattern: string;
  count: number;
  format: string;
  role: string;
  representative_path: string;
  examples: string[];
  member_dimension?: string;
  member_examples?: string[];
  axis_semantics?: string[];
  schema_variants?: Json[];
  variable_axes?: number[];
  semantic_status?: "resolved" | "unresolved";
  paths: string[];
  samples?: SchemaSample[];
}

export interface DeterministicDatasetProfile {
  metadata: Json;
  datasetType: "A" | "B" | "C";
  summary: string;
  inspectedPaths: string[];
  warnings: string[];
  elapsedMs: number;
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function experimentCondition(segment: string): string | undefined {
  const value = segment.match(/_([A-Za-z][A-Za-z0-9]*)_\d{8}_\d{6}$/)?.[1]
    || segment.match(/_(GainHnL|GivingUp|Random|SpaHom|VisRap)(?:_|\.|$)/i)?.[1];
  if (!value) return undefined;
  const known = ["GainHnL", "GivingUp", "Random", "SpaHom", "VisRap"].find((item) => item.toLowerCase() === value.toLowerCase());
  return known || value;
}

function normalizeSegment(segment: string): string {
  const lower = segment.toLowerCase();
  const condition = experimentCondition(segment);
  if (condition && !/chflt$/i.test(segment)) return `<recording:${condition}>`;
  if (/^[A-Za-z0-9-]+_counts\.npy$/i.test(segment)) return "<gene>_counts.npy";
  if (/\.\d+chFlt$/i.test(segment) && condition) {
    const channel = segment.match(/\.(\d+chFlt)$/i)?.[1].toLowerCase() || "chflt";
    return `<subject>_${condition}.${channel}`;
  }
  if (STAGE_NAMES.has(lower) || lower === "behavior") return lower;
  if (/^ed\d+[a-z]?$/.test(lower)) return "ed*";
  if (/^main\d+$/.test(lower)) return "main*";
  if (/^(?:fish|subject|session|sample)\d+$/i.test(segment)) return segment.replace(/\d+$/, "*").toLowerCase();
  if (/^\d{8}_f\d+(?:_.+)?$/i.test(segment)) return "<fish>";
  if (/^\d{8}_f\d+_z\d+$/i.test(segment) || /_z\d+(?:_|$)/i.test(segment)) return "<plane>";
  if (/^\d+_(?:stimulus|behavior|estimator)_log\.hdf5$/i.test(segment)) return segment.replace(/^\d+_/, "*_").toLowerCase();
  if (/^\d+_metadata\.json$/i.test(segment)) return "*_metadata.json";
  if (/^paired_manual_rois_.+\.npy$/i.test(segment)) return "paired_manual_rois_*.npy";
  if (/^manual_mask_.+\.npy$/i.test(segment)) return "manual_mask_*.npy";
  if (["data_from_suite2p_allrois.h5", "scandata.json", "time.h5"].includes(lower)) return lower;
  return segment.replace(/\d{2,}/g, "*").replace(/\*+/g, "*");
}

function patternedPath(path: string): string {
  return normalizePath(path).split("/").map(normalizeSegment).join("/");
}

function unitName(path: string): string | undefined {
  return normalizePath(path).split("/").find((segment) => /^(?:fish|subject|session|sample)\d+$/i.test(segment));
}

function fileFormat(path: string): string {
  const lower = path.toLowerCase();
  if (/\.nii\.gz$/.test(lower)) return "nii.gz";
  if (/\.\d+chflt$/.test(lower)) return lower.match(/\.(\d+chflt)$/)?.[1] || "chflt";
  return extname(lower).replace(/^\./, "") || "no_extension";
}

function assetRole(path: string): string {
  const lower = path.toLowerCase();
  const name = basename(lower);
  const format = fileFormat(path);
  const tokens = new Set(name.replace(/\.(?:nii\.gz|[a-z0-9]+)$/i, "").split(/[^a-z0-9]+/).filter(Boolean));
  const hasToken = (...values: string[]) => values.some((value) => tokens.has(value));
  if (/^readme|^license|^notice|\.md$/.test(name)) return "documentation";
  if (name === "scandata.json") return "acquisition_configuration";
  if (/cluster|tsne|embedding|correlations?|big_corr|high_corr|g_in_cls|subtyp|unique_types|colors_all/.test(lower)) return "derived_analysis";
  if (/data_mapped_to_zstack/.test(lower)) return "neural_activity";
  if (/\/zstack\/|\/ref\/|mapped_to_ref|combined_ref/.test(lower)) return "anatomical_label";
  if (/\/exp\d+\.hdf?5$/.test(lower)) return "derived_analysis";
  if (/<gene>_counts\.npy$/.test(patternedPath(path)) || /_counts\.npy$|genes?_df|binarygenes|genes?_sorted/.test(lower)) return "molecular_feature";
  if (/dff|data_from_suite2p|allrois|calcium|fluorescence|(?:^|[_/-])traces?(?:[_/. -]|$)/.test(lower)) return "neural_activity";
  if (/fish_id|subject_id|session_id/.test(lower)) return "subject_index";
  if (/centroid|coords?|coordinates|position|pos_cells/.test(lower)) return "spatial_coordinate";
  if (/swim|tail_angle|behavior_log|estimator_log|locomot|motor/.test(lower) || hasToken("mov", "motion", "movement", "behavior")) return "behavior_feature";
  if (/stimulus_log|corr_stim|regressors?|stim_feature/.test(lower) || hasToken("odor", "stimulus", "stim")) return "stimulus_feature";
  if (/\d+chflt$|\/ephys\//.test(lower) || hasToken("spk", "spike", "spikes")) return "electrophysiology";
  if (/paired_manual_rois/.test(lower)) return "roi_selection";
  if (name === "time.h5" || /timestamp|frame_time|stim_timings?|(?:^|[_/-])timing/.test(lower) || (hasToken("onset") && hasToken("frame"))) return "timing";
  if (/\/behavior\/.*metadata\.json$/.test(lower)) return "experiment_metadata";
  if (format === "swc") return "neuron_morphology";
  if (/mask|anatom|atlas|region|acronym|brainregions|brain_reg|\.nrrd$/.test(lower)) return "anatomical_label";
  if (hasToken("denoised") && hasToken("data", "signal", "trace", "activity")) return "neural_activity";
  if (hasToken(
    "coef", "coeff", "coefficient", "score", "corr", "correlation", "variance", "var",
    "model", "ridge", "decoder", "prediction", "metric", "summary", "stat", "stats",
    "parameter", "parameters", "para", "pca", "tsne", "umap", "embedding", "cluster",
  ) || normalizePath(lower).split("/").some((segment) => /^(?:results?|outputs?|analysis|derived|postprocessed)(?:[_-]|$)/.test(segment))) return "derived_analysis";
  if (/\/postprocessed\//.test(`/${lower}`)) return "derived_analysis";
  if (SCIENTIFIC_FORMATS.has(format)) return "opaque_binary";
  return "opaque_binary";
}

async function readSample(path: string, bytes = 131_072): Promise<{ text: string; complete: boolean }> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const result = await handle.read(buffer, 0, bytes, 0);
    return { text: buffer.subarray(0, result.bytesRead).toString("utf8"), complete: result.bytesRead < bytes };
  } finally {
    await handle.close();
  }
}

async function npyHeader(path: string): Promise<Json | undefined> {
  const handle = await open(path, "r");
  try {
    const prefix = Buffer.alloc(12);
    const first = await handle.read(prefix, 0, prefix.length, 0);
    if (first.bytesRead < 10 || !prefix.subarray(0, 6).equals(Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]))) return undefined;
    const major = prefix[6];
    const headerLength = major <= 1 ? prefix.readUInt16LE(8) : prefix.readUInt32LE(8);
    const offset = major <= 1 ? 10 : 12;
    const header = Buffer.alloc(headerLength);
    const result = await handle.read(header, 0, headerLength, offset);
    if (result.bytesRead !== headerLength) return undefined;
    const text = header.toString("latin1");
    const dtype = text.match(/['"]descr['"]\s*:\s*['"]([^'"]+)['"]/)?.[1];
    const shapeText = text.match(/['"]shape['"]\s*:\s*\(([^)]*)\)/)?.[1] || "";
    const shape = shapeText.split(",").map((item) => item.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
    return {
      shape,
      ...(dtype ? { dtype } : {}),
      fortran_order: /['"]fortran_order['"]\s*:\s*True/.test(text),
      ...(dtype?.includes("O") ? { object_array: true, note: "Object payload was not unpickled." } : {}),
    };
  } catch {
    return undefined;
  } finally {
    await handle.close();
  }
}

function compactJsonSchema(value: Json): Json {
  const animal = value.general?.animal;
  const stimulus = value.stimulus;
  const protocolNames = stimulus?.protocol && typeof stimulus.protocol === "object" ? Object.keys(stimulus.protocol).sort() : [];
  return {
    top_level_keys: Object.keys(value).sort(),
    ...(animal && typeof animal === "object" ? { animal: {
      ...(animal.species ? { species: animal.species } : {}),
      ...(animal.genotype ? { genotype: animal.genotype } : {}),
      ...(animal.age !== undefined ? { age: animal.age } : {}),
    } } : {}),
    ...(protocolNames.length ? { protocol_names: protocolNames } : {}),
  };
}

async function inspectNonHdf5(path: string): Promise<Json> {
  const format = fileFormat(path);
  if (format === "npy") return await npyHeader(path) || {};
  if (format === "json") {
    const sample = await readSample(path).catch(() => undefined);
    if (!sample?.complete) return { json_sampled: true };
    try { return compactJsonSchema(JSON.parse(sample.text)); } catch { return { json_parseable: false }; }
  }
  if (["csv", "tsv", "txt", "md"].includes(format)) {
    const sample = await readSample(path, 16_384).catch(() => undefined);
    const lines = sample?.text.split(/\r?\n/).filter(Boolean) || [];
    return { preview_lines: lines.slice(0, 3) };
  }
  if (format === "swc") {
    const sample = await readSample(path, 16_384).catch(() => undefined);
    const rows = (sample?.text || "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
    const columnCounts = [...new Set(rows.slice(0, 32).map((line) => line.split(/\s+/).length))].sort((a, b) => a - b);
    return {
      record_type: "swc_neuron_morphology",
      columns: ["node_id", "node_type", "x", "y", "z", "radius", "parent_id"],
      observed_column_counts: columnCounts,
    };
  }
  if (format === "nrrd") {
    const sample = await readSample(path, 16_384).catch(() => undefined);
    const header = (sample?.text || "").split(/\r?\n\r?\n/, 1)[0];
    const fields = Object.fromEntries(header.split(/\r?\n/).filter((line) => /^[A-Za-z][^:]*:/.test(line)).map((line) => {
      const index = line.indexOf(":");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
    return { nrrd_header: fields };
  }
  return {};
}

async function probeStructuredFiles(paths: string[], env: NodeJS.ProcessEnv): Promise<{ schemas: Map<string, Json>; error?: string }> {
  const schemas = new Map<string, Json>();
  if (!paths.length) return { schemas };
  const script = [
    "import json, sys, os", "for path in json.load(sys.stdin):", " try:",
    "  lower=path.lower()", "  result={'path': path}",
    "  if lower.endswith(('.h5','.hdf5','.nwb')):", "   import h5py", "   rows=[]", "   with h5py.File(path, 'r') as f:",
    "    def visit(name, obj):", `     if isinstance(obj, h5py.Dataset) and len(rows) < ${HDF5_SCHEMA_LIMIT}: rows.append({'path': name, 'shape': list(obj.shape), 'dtype': str(obj.dtype)})`,
    "    f.visititems(visit)", "   result.update({'datasets': rows, 'dataset_count': len(rows)})",
    "  elif lower.endswith('.npz'):", "   import zipfile, numpy.lib.format as fmt", "   rows=[]", "   with zipfile.ZipFile(path) as z:",
    "    for name in sorted(z.namelist()):", "     if not name.endswith('.npy'): continue", "     with z.open(name) as f:",
    "      version=fmt.read_magic(f)", "      shape, fortran, dtype=fmt._read_array_header(f, version)", "      rows.append({'path': name[:-4], 'shape': list(shape), 'dtype': str(dtype), 'fortran_order': bool(fortran)})",
    "   result.update({'arrays': rows, 'array_count': len(rows)})",
    "  elif lower.endswith('.mat'):", "   from scipy.io import whosmat", "   result['variables']=[{'name': n, 'shape': list(s), 'class': c} for n,s,c in whosmat(path)]",
    "  elif lower.endswith(('.tif','.tiff')):", "   from PIL import Image", "   with Image.open(path) as im: result.update({'shape': [im.height, im.width], 'mode': im.mode, 'frames': getattr(im, 'n_frames', 1)})",
    "  elif lower.endswith(('.nii','.nii.gz')):", "   import nibabel as nib", "   im=nib.load(path)", "   result.update({'shape': list(im.shape), 'dtype': str(im.get_data_dtype())})",
    "  print(json.dumps(result))",
    " except Exception as e:", "  print(json.dumps({'path': path, 'error': str(e)}))",
  ].join("\n");
  return await new Promise((done) => {
    const child = spawn(resolvePythonCommand(env), ["-c", script], { env: pythonProcessEnvironment(env), stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => stopProcessTree(child), 30_000);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-2_000); });
    child.on("error", (error) => { clearTimeout(timer); done({ schemas, error: String(error) }); });
    child.on("close", () => {
      clearTimeout(timer);
      let globalError = stderr.trim();
      for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
        try {
          const item = JSON.parse(line);
          if (item.path) {
            const { path: _path, error, ...schema } = item;
            schemas.set(item.path, error ? { inspection_error: error } : schema);
          }
          else if (item.error) globalError = item.error;
        } catch { /* ignore malformed probe output */ }
      }
      done({ schemas, ...(globalError ? { error: globalError } : {}) });
    });
    child.stdin.end(JSON.stringify(paths));
  });
}

async function walkCompletely(root: string): Promise<WalkEntry[]> {
  const entries: WalkEntry[] = [];
  const pending = [root];
  while (pending.length) {
    const batch = pending.splice(0, DIRECTORY_CONCURRENCY);
    const results = await Promise.all(batch.map(async (directory) => ({ directory, children: await readdir(directory, { withFileTypes: true }) })));
    for (const { directory, children } of results) {
      for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
        if (child.name.startsWith(".") || (child.isDirectory() && SKIP_DIRECTORIES.has(child.name))) continue;
        const absolute = join(directory, child.name);
        const path = normalizePath(relative(root, absolute));
        entries.push({ path, isDirectory: child.isDirectory() });
        if (child.isDirectory()) pending.push(absolute);
      }
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function buildDirectoryFamilies(entries: WalkEntry[]): Json[] {
  const groups = new Map<string, { count: number; examples: string[] }>();
  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    const pattern = patternedPath(entry.path);
    const group = groups.get(pattern) || { count: 0, examples: [] };
    group.count += 1;
    if (group.examples.length < 2) group.examples.push(entry.path);
    groups.set(pattern, group);
  }
  return [...groups.entries()].map(([pattern, group]) => ({ pattern, ...group })).sort((a, b) => a.pattern.localeCompare(b.pattern));
}

function buildFileFamilies(entries: WalkEntry[]): FileFamily[] {
  const groups = new Map<string, Omit<FileFamily, "id">>();
  const coarseCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const format = fileFormat(entry.path);
    const role = assetRole(entry.path);
    const parentPattern = patternedPath(dirname(entry.path));
    const key = JSON.stringify({ parentPattern, format, role });
    coarseCounts.set(key, (coarseCounts.get(key) || 0) + 1);
  }
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const format = fileFormat(entry.path);
    const role = assetRole(entry.path);
    const standardRecord = STANDARD_RECORD_FORMATS[format];
    const parentPattern = patternedPath(dirname(entry.path));
    const coarseKey = JSON.stringify({ parentPattern, format, role });
    const earlyCollection = EARLY_COLLECTION_FORMATS.has(format)
      && Number(coarseCounts.get(coarseKey) || 0) >= EARLY_COLLECTION_MIN_FILES;
    const pattern = standardRecord?.role === role || earlyCollection
      ? `${parentPattern === "." ? "" : `${parentPattern}/`}*.${format}`
      : patternedPath(entry.path);
    const key = `${pattern}|${role}`;
    const family = groups.get(key) || {
      pattern, count: 0, format, role,
      representative_path: entry.path, examples: [], paths: [],
      ...(standardRecord?.role === role
        ? { member_dimension: standardRecord.member_dimension, member_examples: [] }
        : earlyCollection ? { member_dimension: COLLECTION_MEMBER_DIMENSIONS[role] || "image", member_examples: [] }
        : pattern.endsWith("/<gene>_counts.npy") ? { member_dimension: "gene", member_examples: [] } : {}),
    };
    family.count += 1;
    family.paths.push(entry.path);
    if (family.examples.length < 2) family.examples.push(entry.path);
    if (family.member_examples) {
      const member = family.member_dimension === "gene"
        ? basename(entry.path).replace(/_counts\.npy$/i, "")
        : basename(entry.path);
      if (family.member_examples.length < 4 && !family.member_examples.includes(member)) family.member_examples.push(member);
    }
    groups.set(key, family);
  }
  return [...groups.values()]
    .sort((a, b) => a.role.localeCompare(b.role) || a.pattern.localeCompare(b.pattern))
    .map((family, index) => ({ id: `family_${index + 1}`, ...family }));
}

function samplePaths(family: FileFamily): string[] {
  if (["h5", "hdf5", "nwb"].includes(family.format)) return family.paths.slice(0, 1);
  if (family.format !== "npy") return family.paths.slice(0, 1);
  const byUnit = new Map<string, string>();
  for (const path of family.paths) {
    const unit = unitName(path) || "__collection__";
    if (!byUnit.has(unit)) byUnit.set(unit, path);
  }
  return [...byUnit.values()];
}

function inferAxes(family: FileFamily, shape: number[]): string[] | undefined {
  if (!shape.length) return undefined;
  if (family.role === "neural_activity" && shape.length >= 2) return [/region_series/i.test(family.pattern) ? "region" : "cell", "time", ...shape.slice(2).map((_, index) => `axis_${index + 2}`)];
  if (family.role === "molecular_feature") return shape.length === 1 ? ["cell"] : ["cell", "gene", ...shape.slice(2).map((_, index) => `axis_${index + 2}`)];
  if (family.role === "spatial_coordinate") return shape.length === 1 ? ["cell"] : ["cell", "coordinate", ...shape.slice(2).map((_, index) => `axis_${index + 2}`)];
  if (family.role === "anatomical_label") return shape.length === 1 ? ["item"] : ["cell", "region", ...shape.slice(2).map((_, index) => `axis_${index + 2}`)];
  if (family.role === "subject_index") return ["cell", ...shape.slice(1).map((_, index) => `axis_${index + 1}`)];
  if (family.role === "timing") return shape.map((_, index) => index === shape.length - 1 ? "time_boundary" : `timing_axis_${index}`);
  return undefined;
}

function attachSchemaVariants(family: FileFamily, samples: SchemaSample[]) {
  family.samples = samples;
  const groups = new Map<string, Json>();
  for (const sample of samples) {
    const key = JSON.stringify(sample.schema);
    const item = groups.get(key) || { schema: sample.schema, sample_count: 0, example_paths: [], example_units: [] };
    item.sample_count += 1;
    if (item.example_paths.length < 2) item.example_paths.push(sample.path);
    if (sample.unit && item.example_units.length < 4 && !item.example_units.includes(sample.unit)) item.example_units.push(sample.unit);
    groups.set(key, item);
  }
  family.schema_variants = [...groups.values()];
  const shapes = family.schema_variants.map((item) => item.schema?.shape).filter(Array.isArray) as number[][];
  if (shapes.length > 1) {
    const width = Math.max(...shapes.map((shape) => shape.length));
    family.variable_axes = Array.from({ length: width }, (_, index) => index).filter((index) => new Set(shapes.map((shape) => shape[index])).size > 1);
  }
  const firstShape = shapes[0];
  if (firstShape) family.axis_semantics = inferAxes(family, firstShape);
}

function familySchemaSignature(family: FileFamily): string {
  const schemas = (family.schema_variants || []).map((variant) => variant.schema);
  if (!schemas.length) return "";
  return JSON.stringify(schemas.map((schema) => JSON.stringify(schema)).sort());
}

function structuralSchema(value: unknown, key = ""): unknown {
  if (key === "shape" && Array.isArray(value)) return { rank: value.length };
  if (Array.isArray(value)) return value.map((item) => structuralSchema(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Json)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([childKey, child]) => [childKey, structuralSchema(child, childKey)]));
  }
  return value;
}

function familyStructuralSignature(family: FileFamily): string {
  const signatures = (family.schema_variants || [])
    .map((variant) => JSON.stringify(structuralSchema(variant.schema)))
    .filter(Boolean);
  return JSON.stringify([...new Set(signatures)].sort());
}

function learnedCollectionStem(pattern: string): string | undefined {
  const name = basename(pattern).replace(/\.nii\.gz$/i, "").replace(/\.[^.]+$/, "");
  const tokens = name.split(/[_\-.]+/).filter(Boolean);
  const variableIndex = tokens.findIndex((token) => token.includes("*"));
  if (variableIndex <= 0) return undefined;
  const stem = tokens.slice(0, variableIndex).join("_").replace(/[^A-Za-z0-9_<>:]+/g, "");
  return stem.length >= 2 ? stem : undefined;
}

function learnedCollectionPattern(parent: string, stem: string, format: string): string {
  const suffix = format === "no_extension" ? `${stem}_*` : `${stem}_*.${format}`;
  return parent === "." ? suffix : `${normalizePath(parent)}/${suffix}`;
}

function mergeFamilyGroup(group: FileFamily[], pattern: string, memberDimension: string): FileFamily {
  const first = group[0];
  const samples = group.flatMap((family) => family.samples || []);
  const memberExamples = [...new Set(group.flatMap((family) => [
    ...(family.member_examples || []),
    basename(family.representative_path),
  ]))].slice(0, 4);
  const merged: FileFamily = {
    ...first,
    pattern,
    count: group.reduce((sum, family) => sum + family.count, 0),
    examples: group.flatMap((family) => family.examples).slice(0, 2),
    paths: group.flatMap((family) => family.paths),
    samples,
    member_dimension: memberDimension,
    member_examples: memberExamples,
    schema_variants: undefined,
    variable_axes: undefined,
    semantic_status: group.every((family) => family.role !== "opaque_binary") ? "resolved" : "unresolved",
  };
  attachSchemaVariants(merged, samples);
  return merged;
}

function collapseLearnedStructuralCollections(families: FileFamily[]): FileFamily[] {
  const retained: FileFamily[] = [];
  const candidates = new Map<string, { parent: string; stem: string; families: FileFamily[] }>();
  for (const family of families) {
    const stem = learnedCollectionStem(family.pattern);
    const structure = familyStructuralSignature(family);
    if (!stem || !structure || family.member_dimension) {
      retained.push(family);
      continue;
    }
    const parent = dirname(family.pattern);
    const key = JSON.stringify({ parent, stem: stem.toLowerCase(), format: family.format, role: family.role, structure });
    const candidate = candidates.get(key) || { parent, stem, families: [] };
    candidate.families.push(family);
    candidates.set(key, candidate);
  }
  const collapsed: FileFamily[] = [];
  for (const candidate of candidates.values()) {
    if (candidate.families.length < 2) {
      retained.push(...candidate.families);
      continue;
    }
    const first = candidate.families[0];
    collapsed.push(mergeFamilyGroup(
      candidate.families,
      learnedCollectionPattern(candidate.parent, candidate.stem, first.format),
      COLLECTION_MEMBER_DIMENSIONS[first.role] || "record",
    ));
  }
  return [...retained, ...collapsed]
    .sort((a, b) => a.role.localeCompare(b.role) || a.pattern.localeCompare(b.pattern))
    .map((family, index) => ({ ...family, id: `family_${index + 1}` }));
}

function wildcardPattern(parent: string, format: string): string {
  const suffix = format === "no_extension" ? "*" : `*.${format}`;
  return parent === "." ? suffix : `${normalizePath(parent)}/${suffix}`;
}

function collapseHomogeneousCollections(families: FileFamily[]): FileFamily[] {
  const retained: FileFamily[] = [];
  const candidates = new Map<string, FileFamily[]>();
  for (const family of families) {
    const memberDimension = COLLECTION_MEMBER_DIMENSIONS[family.role];
    const schemaSignature = familySchemaSignature(family);
    if (!memberDimension || family.member_dimension || !schemaSignature) {
      retained.push(family);
      continue;
    }
    const parent = dirname(family.pattern);
    const key = JSON.stringify({ parent, format: family.format, role: family.role, schemaSignature });
    const group = candidates.get(key) || [];
    group.push(family);
    candidates.set(key, group);
  }

  const collapsed: FileFamily[] = [];
  for (const group of candidates.values()) {
    if (group.length < COLLECTION_MIN_FINE_FAMILIES) {
      retained.push(...group);
      continue;
    }
    const first = group[0];
    collapsed.push(mergeFamilyGroup(
      group,
      wildcardPattern(dirname(first.pattern), first.format),
      COLLECTION_MEMBER_DIMENSIONS[first.role],
    ));
  }

  return [...retained, ...collapsed]
    .sort((a, b) => a.role.localeCompare(b.role) || a.pattern.localeCompare(b.pattern))
    .map((family, index) => ({ ...family, id: `family_${index + 1}` }));
}

function serializableFamily(family: FileFamily): Json {
  const variants = family.schema_variants || [];
  return {
    id: family.id,
    pattern: family.pattern,
    count: family.count,
    format: family.format,
    role: family.role,
    representative_path: family.representative_path,
    ...(family.member_dimension ? { member_dimension: family.member_dimension } : {}),
    ...(family.member_examples?.length ? { member_examples: family.member_examples } : {}),
    ...(family.axis_semantics?.length ? { axis_semantics: family.axis_semantics } : {}),
    ...(variants.length ? { schema_variants: variants.map((variant) => ({
      ...variant.schema,
      ...(variant.example_units?.length ? { units: variant.example_units } : {}),
      ...(!variant.example_units?.length && variants.length > 1 && variant.example_paths?.[0] ? { example_path: variant.example_paths[0] } : {}),
    })) } : {}),
    ...(family.variable_axes?.length ? { variable_axes: family.variable_axes } : {}),
    ...(family.semantic_status === "unresolved" ? { semantic_status: "unresolved" } : {}),
  };
}

function buildConditionRelationships(entries: WalkEntry[]): Json[] {
  const byUnit = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    const unit = unitName(entry.path);
    const condition = normalizePath(entry.path).split("/").map(experimentCondition).find(Boolean);
    if (!unit || !condition) continue;
    const conditions = byUnit.get(unit) || new Set<string>();
    conditions.add(String(condition));
    byUnit.set(unit, conditions);
  }
  const signatures = new Map<string, { conditions: string[]; units: string[] }>();
  for (const [unit, values] of byUnit) {
    const conditions = [...values].sort();
    if (conditions.length < 2) continue;
    const key = conditions.join("|");
    const item = signatures.get(key) || { conditions, units: [] };
    item.units.push(unit);
    signatures.set(key, item);
  }
  const relationships: Json[] = [...signatures.values()].map((item) => ({
    kind: "subject_condition", unit_pattern: "fish*", conditions: item.conditions,
    unit_count: item.units.length, examples: item.units.slice(0, 3), evidence: "directory_layout",
  }));
  const stagesByParent = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    const parts = entry.path.split("/");
    const stage = String(parts.at(-1) || "").toLowerCase();
    if (!STAGE_NAMES.has(stage)) continue;
    const parent = parts.slice(0, -1).join("/");
    const values = stagesByParent.get(parent) || new Set<string>();
    values.add(stage);
    stagesByParent.set(parent, values);
  }
  const stageGroups = new Map<string, { unit_pattern: string; stages: string[]; count: number; examples: string[] }>();
  for (const [parent, values] of stagesByParent) {
    const stages = [...values].sort();
    if (stages.length < 2) continue;
    const unitPattern = patternedPath(parent);
    const key = `${unitPattern}|${stages.join(",")}`;
    const item = stageGroups.get(key) || { unit_pattern: unitPattern, stages, count: 0, examples: [] };
    item.count += 1;
    if (item.examples.length < 2) item.examples.push(parent);
    stageGroups.set(key, item);
  }
  relationships.push(...[...stageGroups.values()].map((item) => ({ kind: "unit_stage", ...item, evidence: "directory_layout" })));
  return relationships;
}

function firstDimension(sample: SchemaSample): number | undefined {
  const shape = sample.schema?.shape;
  return Array.isArray(shape) && Number.isFinite(shape[0]) ? Number(shape[0]) : undefined;
}

function buildSharedAxisRelationships(families: FileFamily[]): Json[] {
  const perUnit = new Map<string, Map<number, Set<string>>>();
  for (const family of families) {
    if (!CELL_ALIGNABLE_ROLES.has(family.role)) continue;
    for (const sample of family.samples || []) {
      if (!sample.unit) continue;
      const size = firstDimension(sample);
      if (size === undefined) continue;
      const sizes = perUnit.get(sample.unit) || new Map<number, Set<string>>();
      const members = sizes.get(size) || new Set<string>();
      members.add(family.id);
      sizes.set(size, members);
      perUnit.set(sample.unit, sizes);
    }
  }
  const signatures = new Map<string, { members: string[]; units: string[]; sizes: number[] }>();
  for (const [unit, sizes] of perUnit) {
    for (const [size, membersSet] of sizes) {
      const members = [...membersSet].sort();
      const roles = new Set(members.map((id) => families.find((family) => family.id === id)?.role));
      if (members.length < 3 || roles.size < 2) continue;
      const key = members.join("|");
      const item = signatures.get(key) || { members, units: [], sizes: [] };
      item.units.push(unit);
      item.sizes.push(size);
      signatures.set(key, item);
    }
  }
  const relationships: Json[] = [...signatures.values()].map((item) => ({
    kind: "shared_axis", scope: "repeated_unit", axis: 0, semantic: "cell",
    member_family_ids: item.members, verified_unit_count: item.units.length,
    example_units: item.units.slice(0, 3), variable_size: new Set(item.sizes).size > 1,
    evidence: "matching_headers_within_unit",
  }));

  const collectionGroups = new Map<string, Set<string>>();
  for (const family of families) {
    if (!CELL_ALIGNABLE_ROLES.has(family.role) || (family.samples || []).some((sample) => sample.unit)) continue;
    const sample = family.samples?.[0];
    const size = sample ? firstDimension(sample) : undefined;
    if (size === undefined) continue;
    const parent = patternedPath(dirname(family.representative_path));
    const key = `${parent}|${size}`;
    const members = collectionGroups.get(key) || new Set<string>();
    members.add(family.id);
    collectionGroups.set(key, members);
  }
  for (const [key, members] of collectionGroups) {
    const roles = new Set([...members].map((id) => families.find((family) => family.id === id)?.role));
    if (members.size < 3 || roles.size < 2) continue;
    const [scope, size] = key.split("|");
    relationships.push({
      kind: "shared_axis", scope, axis: 0, semantic: "cell", size: Number(size),
      member_family_ids: [...members].sort(), evidence: "matching_headers_within_collection",
    });
  }
  return relationships;
}

async function documentationEvidence(root: string, families: FileFamily[]): Promise<Json[]> {
  const docs = families.filter((family) => family.role === "documentation").slice(0, 8);
  return (await Promise.all(docs.map(async (family) => {
    const sample = await readSample(join(root, family.representative_path)).catch(() => undefined);
    const relevant = (sample?.text || "").split(/\r?\n/).map((line) => line.trim()).filter((line) =>
      line.length >= 8 && /dataset|subject|fish|session|neuron|cell|calcium|dff|gene|region|condition|license|doi|time|axis|shape|record/i.test(line),
    ).slice(0, 16);
    return { path: family.representative_path, excerpts: relevant };
  }))).filter((item) => item.excerpts.length);
}

function inferDatasetType(directoryFamilies: Json[], relationships: Json[], families: FileFamily[]): { code: "A" | "B" | "C"; label: string } {
  if (relationships.some((item) => item.kind === "subject_condition") || directoryFamilies.some((item) => /<fish>|subject|session|fish\*/i.test(item.pattern))) {
    return { code: "A", label: "repeated_subjects_or_sessions" };
  }
  const derivedFiles = families.filter((item) => item.role === "derived_analysis").reduce((sum, item) => sum + item.count, 0);
  const referenceFiles = families.filter((item) => ["anatomical_label", "spatial_coordinate"].includes(item.role)).reduce((sum, item) => sum + item.count, 0);
  if (derivedFiles > referenceFiles) return { code: "C", label: "derived_analysis_collection" };
  if (families.some((item) => ["anatomical_label", "spatial_coordinate"].includes(item.role))) return { code: "B", label: "reference_or_anatomy_collection" };
  return { code: "C", label: "data_collection" };
}

export function validateDatasetMetadata(metadata: Json): Json {
  const families = Array.isArray(metadata.asset_families) ? metadata.asset_families : [];
  const covered = families.reduce((sum: number, family: Json) => sum + Number(family.count || 0), 0);
  const fileCount = Number(metadata.inventory?.file_count || 0);
  const unresolved = families.filter((family: Json) => family.role === "opaque_binary" && SCIENTIFIC_FORMATS.has(String(family.format))).map((family: Json) => family.id);
  const missingSchema = families.filter((family: Json) => {
    if (!HEADER_FORMATS.has(String(family.format))) return false;
    if (!Array.isArray(family.schema_variants) || !family.schema_variants.length) return true;
    return family.schema_variants.every((variant: Json) => variant.inspection_error);
  }).map((family: Json) => family.id);
  const structuralChecks = {
    all_files_covered: covered === fileCount,
    relationship_references_valid: (metadata.relationships || []).every((relationship: Json) =>
      !relationship.member_family_ids || relationship.member_family_ids.every((id: string) => families.some((family: Json) => family.id === id)),
    ),
  };
  const inspectableFiles = families.filter((family: Json) => HEADER_FORMATS.has(String(family.format)))
    .reduce((sum: number, family: Json) => sum + Number(family.count || 0), 0);
  const missingSchemaFiles = families.filter((family: Json) => missingSchema.includes(family.id))
    .reduce((sum: number, family: Json) => sum + Number(family.count || 0), 0);
  const schemaCoverage = inspectableFiles > 0 ? (inspectableFiles - missingSchemaFiles) / inspectableFiles : 1;
  const scientificFiles = families.filter((family: Json) => SCIENTIFIC_FORMATS.has(String(family.format)))
    .reduce((sum: number, family: Json) => sum + Number(family.count || 0), 0);
  const unresolvedFiles = families.filter((family: Json) => unresolved.includes(family.id))
    .reduce((sum: number, family: Json) => sum + Number(family.count || 0), 0);
  const semanticCoverage = scientificFiles > 0 ? (scientificFiles - unresolvedFiles) / scientificFiles : 1;
  const status = Object.values(structuralChecks).every(Boolean) ? "complete" : "incomplete";
  return {
    status,
    checks: {
      ...structuralChecks,
      inspectable_headers_present: missingSchema.length === 0,
      scientific_families_classified: unresolved.length === 0,
    },
    structural: { status, checks: structuralChecks },
    schema: {
      status: missingSchema.length ? "partial" : "complete",
      coverage: schemaCoverage,
      uninspectable_collection_count: missingSchema.length,
    },
    semantic: {
      status: unresolved.length ? "partial" : "complete",
      coverage: semanticCoverage,
      ambiguous_collection_count: unresolved.length,
    },
    unresolved_family_ids: unresolved,
    missing_schema_family_ids: missingSchema,
  };
}

export function semanticEvidenceBundle(metadata: Json): Json {
  const unresolved = new Set(metadata.quality?.unresolved_family_ids || []);
  return {
    root_dir: metadata.root_dir,
    dataset_type: metadata.dataset_type,
    layout_patterns: metadata.layout_patterns,
    documentation: metadata.documentation,
    unresolved_families: (metadata.asset_families || []).filter((family: Json) => unresolved.has(family.id)).map((family: Json) => ({
      id: family.id, pattern: family.pattern, format: family.format, count: family.count,
      examples: family.examples, schema_variants: family.schema_variants,
    })),
    allowed_roles: DATASET_ROLES.filter((role) => role !== "opaque_binary"),
  };
}

export function applySemanticEnrichment(metadata: Json, enrichment: Json): Json {
  const allowed = new Set<string>(DATASET_ROLES);
  const updates = new Map((Array.isArray(enrichment.family_updates) ? enrichment.family_updates : []).map((item: Json) => [String(item.family_id), item]));
  metadata.asset_families = (metadata.asset_families || []).map((family: Json) => {
    const update = updates.get(String(family.id));
    if (!update || !allowed.has(String(update.role)) || family.role !== "opaque_binary") return family;
    return {
      ...family,
      role: String(update.role),
      semantic_status: "resolved",
      ...(Array.isArray(update.axis_semantics) ? { axis_semantics: update.axis_semantics.map(String) } : {}),
      semantic_evidence: Array.isArray(update.evidence) ? update.evidence.map(String) : [],
    };
  });
  if (typeof enrichment.description === "string" && enrichment.description.trim()) metadata.description = enrichment.description.trim();
  metadata.warnings = [...(metadata.warnings || []), ...(Array.isArray(enrichment.warnings) ? enrichment.warnings.map(String) : [])];
  metadata.quality = validateDatasetMetadata(metadata);
  return metadata;
}

export async function profileDatasetDeterministically(dataDir: string, env: NodeJS.ProcessEnv = process.env): Promise<DeterministicDatasetProfile> {
  const started = performance.now();
  const root = await realpath(resolve(dataDir)).catch(() => resolve(dataDir));
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`data_dir is not a directory: ${dataDir}`);
  const entries = await walkCompletely(root);
  const directoryFamilies = buildDirectoryFamilies(entries);
  const initialAssetFamilies = buildFileFamilies(entries);
  const selectedByFamily = new Map(initialAssetFamilies.map((family) => [family.id, samplePaths(family)]));
  const structuredPaths = initialAssetFamilies.flatMap((family) => PYTHON_PROBE_FORMATS.has(family.format) ? selectedByFamily.get(family.id) || [] : []).map((path) => join(root, path));
  const structured = await probeStructuredFiles(structuredPaths, env);
  await Promise.all(initialAssetFamilies.map(async (family) => {
    const paths = selectedByFamily.get(family.id) || [];
    const samples = await Promise.all(paths.map(async (path) => {
      const absolute = join(root, path);
      const schema = PYTHON_PROBE_FORMATS.has(family.format)
        ? structured.schemas.get(absolute) || { inspection_error: "Structured schema probe returned no result." }
        : await inspectNonHdf5(absolute).catch((error) => ({ inspection_error: String(error) }));
      return { path, unit: unitName(path), schema };
    }));
    if (samples.some((sample) => Object.keys(sample.schema).length)) attachSchemaVariants(family, samples);
    family.semantic_status = family.role === "opaque_binary" ? "unresolved" : "resolved";
  }));
  const learnedCollections = collapseLearnedStructuralCollections(initialAssetFamilies);
  const assetFamilies = collapseHomogeneousCollections(learnedCollections);
  const relationships = [...buildConditionRelationships(entries), ...buildSharedAxisRelationships(assetFamilies)];
  const datasetType = inferDatasetType(directoryFamilies, relationships, assetFamilies);
  const documentation = await documentationEvidence(root, assetFamilies);
  const fileCount = entries.filter((entry) => !entry.isDirectory).length;
  const directoryCount = entries.length - fileCount;
  const roles = [...new Set(assetFamilies.map((family) => family.role).filter((role) => role !== "documentation" && role !== "opaque_binary"))].sort();
  const warnings = [
    ...(structured.error ? [`Structured schema inspection was incomplete: ${structured.error}`] : []),
    ...(!assetFamilies.length ? ["No files were found below the dataset root."] : []),
  ];
  const serializableFamilies = assetFamilies.map(serializableFamily);
  const metadata: Json = {
    schema_version: 7,
    root_dir: root,
    description: `${datasetType.label} containing ${roles.join(", ") || "unclassified assets"}.`,
    dataset_type: datasetType.label,
    entities: {
      repeated_units: [...new Set(entries.map((entry) => unitName(entry.path)).filter(Boolean))].sort(),
      conditions: [...new Set(entries.flatMap((entry) => normalizePath(entry.path).split("/").map(experimentCondition).filter(Boolean)))].sort(),
    },
    inventory: { directory_count: directoryCount, file_count: fileCount, asset_family_count: serializableFamilies.length },
    top_level: entries.filter((entry) => !entry.path.includes("/")).map((entry) => ({ path: entry.path, kind: entry.isDirectory ? "directory" : "file" })),
    layout_patterns: directoryFamilies,
    documentation,
    asset_families: serializableFamilies,
    relationships,
    warnings,
  };
  metadata.quality = validateDatasetMetadata(metadata);
  if (metadata.quality.schema?.status === "partial") {
    metadata.warnings.push(
      `Schema inspection was unavailable for ${metadata.quality.schema.uninspectable_collection_count} structural collections; file coverage remains complete and these collections are preserved.`,
    );
  }
  const summary = `${datasetType.label}: ${directoryCount} directories, ${fileCount} files, ${serializableFamilies.length} semantic asset families; quality ${metadata.quality.status}.`;
  return {
    metadata, datasetType: datasetType.code, summary,
    inspectedPaths: [root, ...initialAssetFamilies.flatMap((family) => selectedByFamily.get(family.id) || []).map((path) => join(root, path))],
    warnings, elapsedMs: performance.now() - started,
  };
}
