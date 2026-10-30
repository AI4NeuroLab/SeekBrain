import { createJiti } from "jiti";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const builtinRoot = join(projectRoot, "recipes");
const defaultFmriRoot = "/mnt/shared-storage-gpfs2/ai4neuro-share/zhuyuqing/fmri-neuroimaging-recipes";
const auditRoot = join(projectRoot, "docs", "recipe_cards");
const args = new Map(process.argv.slice(2).map((item) => {
  const [key, ...rest] = item.split("=");
  return [key, rest.join("=") || "true"];
}));
const fmriRoot = resolve(args.get("--fmri-root") || defaultFmriRoot);
const outputName = args.get("--final") === "true" ? "recipe-card.json" : "recipe-card.draft.json";
const writeCards = args.get("--dry-run") !== "true";

const jiti = createJiti(import.meta.url);
const { validateRecipeCard } = await jiti.import("../src/targeted-skill/recipe-card.ts");

function compact(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function unique(values) {
  return [...new Set(values.map(compact).filter(Boolean))];
}

function slug(value) {
  return compact(value).toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]+/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function summarySentence(value, limit = 420) {
  const text = compact(value);
  const first = text.match(/^.*?[.!?](?=\s+[A-Z]|$)/)?.[0] || text;
  if (first.length <= limit) return first;
  const sliced = first.slice(0, limit + 1);
  const boundary = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, boundary > limit * 0.7 ? boundary : limit).trim()}…`;
}

function frontmatter(text) {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end < 0) return {};
  return parseYaml(text.slice(3, end)) || {};
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return {}; }
}

async function recipeDirectories(root) {
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) return [root];
  const found = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || ["references", "scripts"].includes(entry.name)) continue;
    found.push(...await recipeDirectories(join(root, entry.name)));
  }
  return found;
}

async function resourceFiles(directory) {
  const found = ["SKILL.md"];
  for (const folder of ["references", "scripts"]) {
    try {
      for (const entry of await readdir(join(directory, folder), { withFileTypes: true })) {
        if (entry.isFile() && !entry.name.startsWith(".")) found.push(`${folder}/${entry.name}`);
      }
    } catch {}
  }
  return found.sort();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function builtinKind(id) {
  if (/^ns_pre-/.test(id)) return "preprocess";
  if (/^ns_vis-/.test(id)) return "visualization";
  return "analysis";
}

function builtinSpecies(id) {
  return ["human", "mouse", "zebrafish", "macaque", "marmoset", "drosophila", "c_elegans"].filter((item) => id.includes(`-${item}-`) || id.includes(`_${item}-`));
}

function builtinInputSpec(id) {
  return id.match(/^ns_(?:ana|pre|vis|multi)-(?:human|mouse|zebrafish|macaque|marmoset|drosophila|c_elegans)-([^-]+)-/)?.[1] || "";
}

function builtinAnalysisSpec(id) {
  const input = builtinInputSpec(id);
  const marker = `-${input}-`;
  const index = id.indexOf(marker);
  return index >= 0 ? id.slice(index + marker.length) : id;
}

function builtinModalities(id) {
  const input = builtinInputSpec(id);
  const values = [];
  if (/(?:^|_)ca(?:_|$)/.test(input)) values.push("calcium");
  if (/(?:^|_)spike(?:_|$)/.test(input)) values.push("spike");
  if (/(?:^|_)behavior(?:_|$)/.test(input)) values.push("behavior");
  if (/(?:^|_)(?:gene|omics|expression)(?:_|$)/.test(input)) values.push("omics");
  if (/(?:^|_)swc(?:_|$)/.test(input)) values.push("morphology");
  if (/(?:^sc$|connectome|sc_matrix|sc_fc_matrix|structural_functional_matrix|structure_connectivity|fc_matrix|fc_atlas|sc_atlas)/.test(input)) values.push("connectome");
  if (/(?:anatomy|atlas|cell_coordinate)/.test(input)) values.push("atlas");
  return unique(values);
}

function builtinDoes(id, kind) {
  const values = [];
  if (kind === "preprocess") values.push("preprocess");
  if (kind === "visualization") values.push("visualization");
  const rules = [
    [["correlation", "corrcoef", "pearson", "spearman", "phase_locking", "cofluctuation", "circular_statistics", "vonmises"], "association"],
    [["regression", "glm", "polyfit", "gam"], "regression"],
    [["anova", "chi_square", "mannwhitney", "permutation", "shuffling", "cross_day", "cross_individual", "differential_gene"], "group_comparison"],
    [["pca", "tsne", "umap", "diffusion_map", "tensor_decomposition", "eigen_spectrum"], "dimensionality_reduction"],
    [["hdbscan", "clustering", "cluster_", "consensus_clustering"], "clustering"],
    [["latent_dynamical", "markov"], "latent_state"],
    [["svm", "decoding"], "decoding"],
    [["fc_", "connectivity", "connectome", "sc_matrix", "network", "graph_predictor", "node_degree", "degree_correlation"], "connectivity"],
    [["timeseries", "temporal", "psth", "trace", "decay", "epoch_interval", "trajectory", "tuning_curve"], "temporal_dynamics"],
    [["atlas", "spatial_density", "topography", "region_census", "edge_projection"], "spatial_mapping"],
    [["nblast", "morpholog"], "feature_extraction"],
  ];
  for (const [terms, value] of rules) if (includesAny(id, terms)) values.push(value);
  if (!values.length) values.push("feature_extraction");
  return unique(values);
}

function builtinEvidence(id, category, does) {
  const text = `${id} ${category}`.toLowerCase();
  const values = [];
  if (text.includes("behavior")) values.push("behavioral_encoding");
  if (includesAny(text, ["visual_stim", "stimulus", "odor_tuning"])) values.push("stimulus_encoding");
  if (includesAny(text, ["structure function", "sc_fc", "structural_functional", "structure_connectivity"])) values.push("structure_function_coupling");
  if (does.includes("connectivity")) values.push("connectivity");
  if (does.includes("temporal_dynamics")) values.push("temporal_dynamics");
  if (includesAny(text, ["atlas", "anatomy", "spatial_density", "topography", "region_census"])) values.push("regional_localization");
  if (includesAny(text, ["subtype", "cell_type", "neuronal_subtype"])) values.push("cell_type_specificity");
  if (does.includes("latent_state")) values.push("latent_state");
  return unique(values);
}

function observationUnits(modalities, id) {
  const values = [];
  if (modalities.includes("calcium") || modalities.includes("spike") || modalities.includes("morphology")) values.push("neuron");
  if (modalities.includes("behavior")) values.push("trial");
  if (modalities.includes("omics")) values.push("gene");
  if (modalities.includes("connectome")) values.push("region", "edge");
  if (modalities.includes("atlas")) values.push(id.includes("cell_coordinate") ? "cell" : "region");
  if (includesAny(id, ["timeseries", "trace", "temporal", "psth", "trajectory"])) values.push("timepoint");
  return unique(values);
}

function requirements(modalities) {
  const values = [];
  if (modalities.includes("calcium")) values.push("calcium_activity_matrix");
  if (modalities.includes("spike")) values.push("spike_times_or_firing_rates");
  if (modalities.includes("behavior")) values.push("aligned_behavior_measurements");
  if (modalities.includes("omics")) values.push("gene_expression_matrix");
  if (modalities.includes("morphology")) values.push("swc_reconstructions");
  if (modalities.includes("connectome")) values.push("connectivity_matrix");
  if (modalities.includes("atlas")) values.push("atlas_annotations_or_coordinates");
  return values;
}

function produces(id, kind, does) {
  const values = [];
  const output = builtinAnalysisSpec(id);
  const rules = [
    [["heatmap"], "heatmap_figure"],
    [["scatter"], "scatter_plot"],
    [["trace", "timeseries", "psth"], "time_series_plot"],
    [["distribution", "histogram", "pie_plot", "box_plot", "bar_plot"], "distribution_plot"],
    [["atlas", "topography", "spatial_density", "network_map"], "spatial_map"],
    [["performance", "accuracy", "variance_explained", "log_likelihood_ratio"], "model_performance_metrics"],
    [["clustering", "hdbscan"], "cluster_assignments"],
    [["trajectory"], "temporal_trajectory"],
    [["gradient"], "connectivity_gradient"],
    [["fingerprint"], "identity_fingerprint"],
  ];
  for (const [terms, value] of rules) if (includesAny(output, terms)) values.push(value);
  if (output.includes("fc_matrix")) values.push("connectivity_matrix");
  else if (output.includes("correlation_matrix")) values.push("correlation_matrix");
  else if (output.includes("stereotypy_matrix") || output.includes("similarity_matrix")) values.push("similarity_matrix");
  else if (output.includes("matrix")) values.push("result_matrix");
  if (!values.length && kind === "preprocess") values.push("processed_data_matrix");
  if (!values.length && kind === "visualization") values.push("analysis_figure");
  if (!values.length && does.includes("connectivity")) values.push("connectivity_metrics");
  if (!values.length) values.push("analysis_results");
  return unique(values);
}

function avoidWhen(id, modalities, does) {
  const values = [];
  if (modalities.includes("behavior") && (modalities.includes("calcium") || modalities.includes("spike"))) values.push("Neural and behavioral measurements cannot be aligned on a common time base");
  if (does.includes("association") || does.includes("regression")) values.push("The intended conclusion requires causal inference from an observational association alone");
  if (does.includes("decoding")) values.push("Leakage-safe cross-validation groups or labels are unavailable");
  if (does.includes("dimensionality_reduction") || does.includes("clustering")) values.push("A low-dimensional embedding alone would be treated as confirmatory statistical evidence");
  if (does.includes("connectivity")) values.push("Connectivity estimates are unsupported because sampling, preprocessing, or matrix alignment is inadequate");
  if (modalities.includes("atlas")) values.push("Atlas labels, coordinates, or registrations are missing or incompatible");
  if (includesAny(id, ["anova", "chi_square", "mannwhitney", "permutation", "shuffling"])) values.push("Independent biological replicates or an appropriate null model are unavailable");
  if (!values.length) values.push("The required input data contract is not satisfied");
  return unique(values).slice(0, 4);
}

async function builtinCard(directory) {
  const id = basename(directory);
  const text = await readFile(join(directory, "SKILL.md"), "utf8");
  const yaml = frontmatter(text);
  const category = relative(builtinRoot, directory).split(/[\\/]+/).slice(0, -1).join(" / ");
  const kind = builtinKind(id);
  const inputSpec = builtinInputSpec(id);
  const modalities = builtinModalities(id);
  let contextModalities = modalities.includes("atlas") && modalities.some((item) => item !== "atlas") ? ["atlas"] : [];
  let primaryModalities = modalities.filter((item) => !contextModalities.includes(item));
  if (inputSpec.includes("ca_fc_matrix")) {
    primaryModalities = ["connectome"];
    contextModalities = unique([...contextModalities, "calcium"]);
  }
  if (!primaryModalities.length) primaryModalities = modalities;
  const does = builtinDoes(id, kind);
  return {
    schema_version: 1,
    recipe_id: id,
    version: compact(yaml.version || "1.0"),
    status: "active",
    kind,
    summary: summarySentence(yaml.description),
    aliases: unique(yaml.tags || []).slice(0, 12),
    does,
    evidence_for: builtinEvidence(id, category, does),
    accepts: {
      species: builtinSpecies(id),
      modalities,
      observation_units: observationUnits(unique([...primaryModalities, ...contextModalities.filter((item) => item === "atlas")]), id),
      requires: requirements(unique([...primaryModalities, ...contextModalities.filter((item) => item === "atlas")])),
    },
    primary_modalities: primaryModalities,
    context_modalities: contextModalities,
    transferable_roles: [],
    produces: produces(id, kind, does),
    use_when: unique(yaml.triggers || []).slice(0, 6),
    avoid_when: avoidWhen(id, modalities, does),
    source: { type: "builtin", evidence_refs: await resourceFiles(directory) },
    quality: { passed_runs: 0, recipe_attributed_failures: 0 },
  };
}

const FMRI_OVERRIDES = {
  "fmriprep": {
    kind: "preprocess", does: ["preprocess", "registration", "segmentation"], evidence_for: [],
    accepts: { species: [], modalities: ["fmri"], observation_units: ["subject", "session", "run"], requires: ["bids_dataset"] },
    primary_modalities: ["fmri"], context_modalities: ["atlas"],
    produces: ["preprocessed_bold", "confounds_table", "spatial_transforms", "quality_report"],
    avoid_when: ["The dataset is not sufficiently BIDS-compliant", "The task requires statistical modeling rather than preprocessing", "The user expects fMRIPrep itself to perform denoising or statistical inference"],
  },
  "fmri-preprocessing-pipeline-guide": {
    kind: "preprocess", does: ["preprocess", "registration"], evidence_for: [],
    accepts: { species: [], modalities: ["fmri"], observation_units: ["subject", "session", "run"], requires: ["raw_fmri_data", "acquisition_metadata"] },
    primary_modalities: ["fmri"], context_modalities: ["atlas"],
    produces: ["preprocessing_plan", "quality_control_plan", "analysis_ready_fmri"],
    avoid_when: ["Acquisition metadata needed to select distortion and timing corrections are unavailable", "A software-specific command reference is required instead of a methodological preprocessing plan", "The requested operation is downstream statistical modeling rather than preprocessing"],
  },
  "fmri-glm-analysis-guide": {
    kind: "analysis", does: ["regression", "group_comparison"], evidence_for: ["stimulus_encoding", "behavioral_encoding"],
    accepts: { species: [], modalities: ["fmri"], observation_units: ["voxel", "region", "subject", "run"], requires: ["preprocessed_bold", "design_matrix", "contrast_definition"] },
    primary_modalities: ["fmri"], context_modalities: ["behavior"],
    produces: ["parameter_estimates", "contrast_map", "statistical_map", "group_inference"],
    avoid_when: ["The design matrix is rank-deficient or incompatible with the acquisition timing", "Temporal autocorrelation and nuisance structure cannot be modeled adequately", "The question requires multivariate decoding rather than a general linear model"],
  },
  "fmri-task-design-guide": {
    kind: "analysis", does: ["experimental_design"], evidence_for: ["stimulus_encoding", "behavioral_encoding"],
    accepts: { species: [], modalities: ["fmri"], observation_units: ["trial", "run", "subject"], requires: ["scientific_hypothesis", "experimental_constraints"] },
    primary_modalities: ["fmri"], context_modalities: ["behavior"],
    produces: ["task_timing_plan", "condition_order", "contrast_plan", "design_efficiency_assessment"],
    avoid_when: ["The task timing cannot be reconciled with scanner timing and behavioral constraints", "The scientific contrast and expected response are not defined", "The dataset has already been acquired and only retrospective statistical analysis is requested"],
  },
  "brain-connectivity-modeler": {
    kind: "analysis", does: ["connectivity", "association", "regression"], evidence_for: ["connectivity", "structure_function_coupling"],
    accepts: { species: [], modalities: ["fmri", "connectome"], observation_units: ["subject", "region", "edge", "timepoint"], requires: ["preprocessed_neural_data", "region_definition"] },
    primary_modalities: ["fmri", "connectome"], context_modalities: ["atlas"],
    produces: ["connectivity_matrix", "connectivity_model", "network_metrics", "model_comparison"],
    avoid_when: ["Temporal resolution or preprocessing cannot support the requested connectivity interpretation", "Directed or causal claims are requested from an unsuitable observational method", "Region definitions or connectivity matrices are not aligned across subjects"],
  },
  "neural-decoding-analysis": {
    kind: "analysis", does: ["decoding", "feature_extraction", "spatial_mapping"], evidence_for: ["stimulus_encoding", "behavioral_encoding", "regional_localization"],
    accepts: { species: [], modalities: ["fmri"], observation_units: ["trial", "voxel", "region", "subject"], requires: ["feature_matrix", "target_labels", "cross_validation_groups"] },
    primary_modalities: ["fmri"], context_modalities: ["behavior", "atlas"],
    produces: ["decoding_scores", "permutation_inference", "searchlight_map", "representational_similarity_matrix"],
    avoid_when: ["Cross-validation splits would leak subjects, runs, trials, or preprocessing information", "The sample size or label balance cannot support the proposed model", "Above-chance prediction would be interpreted as a unique neural mechanism without appropriate controls"],
  },
  "netneurotools-guide": {
    kind: "analysis", does: ["connectivity", "association", "clustering", "structure_function_coupling"], evidence_for: ["connectivity", "structure_function_coupling", "regional_localization"],
    accepts: { species: [], modalities: ["connectome"], observation_units: ["subject", "region", "edge"], requires: ["connectivity_matrix_or_brain_map"] },
    primary_modalities: ["connectome"], context_modalities: ["atlas"],
    produces: ["network_metrics", "null_networks", "community_assignments", "spatial_statistics", "surface_plot"],
    avoid_when: ["Parcellations or node ordering are inconsistent across matrices", "Spatial autocorrelation is ignored in brain-map inference", "A dataset-specific preprocessing pipeline is required rather than network-neuroscience utilities"],
  },
  "pycortex-guide": {
    kind: "visualization", does: ["visualization", "spatial_mapping", "registration"], evidence_for: ["regional_localization"],
    accepts: { species: [], modalities: ["fmri"], observation_units: ["voxel", "vertex", "region", "subject"], requires: ["brain_map", "cortical_surface", "volume_to_surface_transform"] },
    primary_modalities: ["fmri"], context_modalities: ["atlas"],
    produces: ["cortical_flatmap", "surface_visualization", "webgl_viewer", "roi_overlay"],
    avoid_when: ["The subject surface or volume-to-surface transform is unavailable", "The result should remain in native volume space without cortical projection", "Quantitative inference is requested but only a visualization operation has been specified"],
  },
};

async function fmriCard(directory) {
  const id = basename(directory);
  const text = await readFile(join(directory, "SKILL.md"), "utf8");
  const yaml = frontmatter(text);
  const metadata = await readJson(join(directory, "metadata.json"));
  const semantic = metadata.yaml_metadata || {};
  const override = FMRI_OVERRIDES[id];
  if (!override) throw new Error(`missing curated fMRI override: ${id}`);
  return {
    schema_version: 1,
    recipe_id: id,
    version: "1.0",
    status: "provisional",
    kind: override.kind,
    summary: summarySentence(yaml.description || semantic.description),
    aliases: unique([...(semantic.tags || []), id]),
    does: override.does,
    evidence_for: override.evidence_for,
    accepts: override.accepts,
    primary_modalities: override.primary_modalities,
    context_modalities: override.context_modalities,
    transferable_roles: [],
    produces: override.produces,
    use_when: unique(semantic.triggers || []).slice(0, 6),
    avoid_when: override.avoid_when,
    source: { type: "expert", evidence_refs: await resourceFiles(directory) },
    quality: { passed_runs: 0, recipe_attributed_failures: 0 },
  };
}

const builtinDirectories = await recipeDirectories(builtinRoot);
const fmriDirectories = await recipeDirectories(fmriRoot);
const records = [];
for (const directory of builtinDirectories) records.push({ directory, collection: "builtin", card: await builtinCard(directory) });
for (const directory of fmriDirectories) records.push({ directory, collection: "fmri-local", card: await fmriCard(directory) });

const ids = new Set();
for (const record of records) {
  if (ids.has(record.card.recipe_id)) throw new Error(`duplicate recipe_id: ${record.card.recipe_id}`);
  ids.add(record.card.recipe_id);
  const validation = validateRecipeCard(record.card);
  if (!validation.ok || validation.warnings.length) {
    throw new Error(`${record.card.recipe_id}: ${[...validation.issues, ...validation.warnings].join("; ")}`);
  }
  for (const ref of record.card.source.evidence_refs) await readFile(join(record.directory, ref));
  if (writeCards) {
    await writeFile(join(record.directory, outputName), `${JSON.stringify(record.card, null, 2)}\n`, "utf8");
    if (outputName === "recipe-card.json") await rm(join(record.directory, "recipe-card.draft.json"), { force: true });
  }
}

await mkdir(auditRoot, { recursive: true });
const header = ["collection", "recipe_id", "status", "kind", "species", "primary_modalities", "context_modalities", "observation_units", "does", "evidence_for", "produces", "use_when_count", "avoid_when_count", "evidence_ref_count"];
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csvRows = records.map(({ collection, card }) => [
  collection, card.recipe_id, card.status, card.kind, card.accepts.species.join("|"), card.primary_modalities.join("|"), card.context_modalities.join("|"),
  card.accepts.observation_units.join("|"), card.does.join("|"), card.evidence_for.join("|"), card.produces.join("|"), card.use_when.length, card.avoid_when.length, card.source.evidence_refs.length,
].map(csvCell).join(","));
await writeFile(join(auditRoot, "recipe_card_audit.csv"), `${header.map(csvCell).join(",")}\n${csvRows.join("\n")}\n`, "utf8");

const counts = (field) => Object.entries(records.reduce((acc, record) => {
  for (const value of field(record.card)) acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {})).sort((a, b) => b[1] - a[1]);
const report = [
  "# RecipeCard generation audit",
  "",
  `- Output: \`${outputName}\``,
  `- Total: ${records.length}`,
  `- Built-in: ${builtinDirectories.length}`,
  `- Local fMRI: ${fmriDirectories.length}`,
  `- Schema errors: 0`,
  `- Validation warnings: 0`,
  `- Duplicate IDs: 0`,
  `- Broken evidence references: 0`,
  "",
  "## Kinds",
  "",
  ...counts((card) => [card.kind]).map(([name, count]) => `- ${name}: ${count}`),
  "",
  "## Primary modalities",
  "",
  ...counts((card) => card.primary_modalities).map(([name, count]) => `- ${name}: ${count}`),
  "",
  "## Review policy",
  "",
  "- Modality fields are derived only from recipe identity/category or curated fMRI overrides, never from unrestricted body keyword matches.",
  "- Quality counters remain zero until observed runs can be attributed to a Recipe.",
  "- Local fMRI cards remain provisional pending empirical runs, even after retrieval regression passes.",
];
await writeFile(join(auditRoot, "recipe_card_audit.md"), `${report.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ output: outputName, write_cards: writeCards, total: records.length, builtin: builtinDirectories.length, fmri_local: fmriDirectories.length, audit_root: auditRoot }, null, 2));
