const TABLES: Record<string, Record<string, string[]>> = {
  stage: {
    ns_pre: ["preprocess", "preprocessing", "qc", "denoise", "correction", "cleanup"],
    ns_seg: ["segmentation", "segment", "sorting", "spike_sorting", "roi", "cell_detection", "curation"],
    ns_reg: ["registration", "register", "alignment", "align", "warp", "mapping", "atlas_mapping"],
    ns_feat: ["feature", "features", "feature_extraction", "extraction"],
    ns_ana: ["analysis", "analyse", "analyze", "modeling", "model", "statistics", "stat", "test"],
    ns_multi: ["multimodal", "multi_modal", "integration", "integrate", "cross_modal", "transfer"],
  },
  species: {
    zebrafish: ["zebrafish", "danio", "fish", "larva", "larval", "larval_zebrafish"],
    mouse: ["mouse", "mice", "murine", "mus"],
    marmoset: ["marmoset", "callithrix", "primate"],
    human: ["human", "patient", "clinical"],
    global: ["global", "cross_species", "species_agnostic", "generic", "any", "none"],
  },
  modality: {
    ca: ["calcium", "ca_imaging", "calcium_imaging", "gcamp", "2p", "two_photon", "dff", "fluorescence"],
    spike: ["spike", "ephys", "electrophysiology", "neuropixels", "extracellular", "unit", "mua"],
    swc: ["swc", "morphology", "reconstruction", "skeleton", "neuron_morphology", "trace"],
    st: ["st", "spatial_transcriptomics", "stereo_seq", "merfish", "visium", "transcriptomics", "scrna"],
    video: ["video", "behavior_video", "behaviour", "behavior", "tracking", "pose"],
    em: ["em", "electron_microscopy"],
    swc_em: ["lm_em", "light_electron", "swc_em", "lm_to_em"],
    st_atlas: ["st_atlas", "spatial_atlas"],
    graph: ["graph", "network", "connectome", "connectivity", "adjacency"],
    atlas: ["atlas", "reference_brain", "ccf", "ccfv3", "mapzebrain"],
  },
  method: {
    glm: ["glm", "generalized_linear_model", "linear_model", "regression"],
    pca: ["pca", "principal_component", "principal_component_analysis"],
    dlc: ["dlc", "deeplabcut", "deep_lab_cut"],
    nblast: ["nblast", "morphology_similarity"],
    affine: ["affine", "rigid"],
    lddmm: ["lddmm", "elastic", "nonlinear_registration", "deformable"],
    harmony: ["harmony", "batch_correction"],
    kilosort: ["kilosort", "spikesort"],
    null_model: ["null_model", "edge_rewiring", "rewiring", "permutation_test"],
    hypergeometric: ["hypergeometric", "enrichment_test", "enrichment"],
    whitening: ["whitening", "zca"],
    kinematics: ["kinematics", "kinematic"],
  },
};

export const SMMT_AXES = ["stage", "species", "modality", "method", "target"] as const;
export type Smmt = Record<(typeof SMMT_AXES)[number], string>;

export function slug(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]+/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export function normalizeField(axis: string, raw: unknown): string | undefined {
  const value = slug(raw);
  if (!value) return undefined;
  for (const [canonical, aliases] of Object.entries(TABLES[axis] ?? {})) {
    if (value === canonical || aliases.includes(value)) return canonical;
  }
  return value;
}

export function canonicalLabel(smmt: Smmt): string {
  return SMMT_AXES.map((axis) => smmt[axis]).join("-");
}

export function piName(smmt: Smmt): string {
  return canonicalLabel(smmt).replace(/_/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeSmmt(value: Record<string, unknown>): Smmt {
  return Object.fromEntries(SMMT_AXES.map((axis) => [axis, normalizeField(axis, value[axis]) ?? ""])) as Smmt;
}

export function validateSmmt(smmt: Smmt): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const axis of SMMT_AXES) {
    if (!/^[a-z0-9_]+$/.test(smmt[axis] ?? "")) errors.push(`${axis} '${smmt[axis]}' must be non-empty snake_case ([a-z0-9_]).`);
  }
  for (const axis of ["stage", "species", "modality"]) {
    if (smmt[axis as keyof Smmt] && !TABLES[axis]?.[smmt[axis as keyof Smmt]]) warnings.push(`${axis} '${smmt[axis as keyof Smmt]}' is outside the known vocabulary.`);
  }
  const name = piName(smmt);
  if (!errors.length && (name.length > 64 || !/^[a-z0-9-]+$/.test(name))) errors.push(`derived pi name '${name}' must be kebab-case and at most 64 characters.`);
  return { ok: errors.length === 0, errors, warnings };
}
