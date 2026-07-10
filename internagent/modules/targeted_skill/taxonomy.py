"""Neuroscience skill naming taxonomy: Stage-Species-Modality-Method-Target.

Single source of truth for the controlled vocabulary and the normalization used
when a Level-1 run is saved as a reusable skill. The companion human-readable doc
is ``library/skills/Neuroscience_Analysis_Skill_Taxonomy.md`` (keep it in sync).

Naming rule
-----------
``<stage>-<species>-<modality>-<method>-<target>``
  * the 5 axes are joined by hyphens
  * each axis value is snake_case (``^[a-z0-9_]+$``); underscores live WITHIN an axis
  * example: ``ns_reg-global-swc_em-affine-landmark_align``

Two derived identifiers (independent on purpose):
  * ``canonical_label`` (keeps underscores) -> the on-disk folder name and the
    ``INDEX.md`` heading the repo SkillLoader matches on.
  * ``pi_name`` (underscores -> hyphens) -> the pi frontmatter ``name`` used for
    ``/skill:<pi_name>`` (must be kebab ``^[a-z0-9-]+$``, <= 64 chars).

Naming is LLM-inferred (see the save_skill_namer subagent), not templated. This
module only provides the controlled vocabulary + few-shot examples that GUIDE the
model, and soft validation/normalization of what it returns. Stage/Species are
preferred-but-extensible; Modality is semi-open (compounds like ``swc_em`` and
derived representations like ``graph`` are allowed); Method/Target are open.
"""

from __future__ import annotations

import re
from typing import Optional

AXES = ("stage", "species", "modality", "method", "target")

# Known Stage prefixes. Prefer these; a justified new prefix is allowed (warns).
STAGE = {
    "ns_pre": ["preprocess", "preprocessing", "qc", "denoise", "correction", "cleanup"],
    "ns_seg": ["segmentation", "segment", "sorting", "spike_sorting", "roi", "cell_detection", "curation"],
    "ns_reg": ["registration", "register", "alignment", "align", "warp", "mapping", "atlas_mapping"],
    "ns_feat": ["feature", "features", "feature_extraction", "extraction"],
    "ns_ana": ["analysis", "analyse", "analyze", "modeling", "model", "statistics", "stat", "test"],
    "ns_multi": ["multimodal", "multi_modal", "integration", "integrate", "cross_modal", "transfer"],
}

SPECIES = {
    "zebrafish": ["zebrafish", "danio", "fish", "larva", "larval", "larval_zebrafish"],
    "mouse": ["mouse", "mice", "murine", "mus"],
    "marmoset": ["marmoset", "callithrix", "primate"],
    "human": ["human", "patient", "clinical"],
    "global": ["global", "cross_species", "species_agnostic", "generic", "any", "none"],
}

# Modality seed set. Semi-open: may be COMPOUND (swc_em, st_atlas) or a derived
# representation (graph). New values are allowed (warn).
MODALITY = {
    "ca": ["calcium", "ca_imaging", "calcium_imaging", "gcamp", "2p", "two_photon", "dff", "fluorescence"],
    "spike": ["spike", "ephys", "electrophysiology", "neuropixels", "extracellular", "unit", "mua"],
    "swc": ["swc", "morphology", "reconstruction", "skeleton", "neuron_morphology", "trace"],
    "st": ["st", "spatial_transcriptomics", "stereo_seq", "merfish", "visium", "transcriptomics", "scrna"],
    "video": ["video", "behavior_video", "behaviour", "behavior", "tracking", "pose"],
    "em": ["em", "electron_microscopy"],
    "swc_em": ["lm_em", "light_electron", "swc_em", "lm_to_em"],
    "st_atlas": ["st_atlas", "spatial_atlas"],
    "graph": ["graph", "network", "connectome", "connectivity", "adjacency"],
    "atlas": ["atlas", "reference_brain", "ccf", "ccfv3", "mapzebrain"],
}

# Method / Target are OPEN snake_case. Seeds only guide the model + provide aliases.
METHOD_SEED = {
    "glm": ["glm", "generalized_linear_model", "linear_model", "regression"],
    "pca": ["pca", "principal_component", "principal_component_analysis"],
    "dlc": ["dlc", "deeplabcut", "deep_lab_cut"],
    "nblast": ["nblast", "morphology_similarity"],
    "affine": ["affine", "rigid"],
    "lddmm": ["lddmm", "elastic", "nonlinear_registration", "deformable"],
    "harmony": ["harmony", "batch_correction"],
    "kilosort": ["kilosort", "spikesort"],
    "null_model": ["null_model", "edge_rewiring", "rewiring", "permutation_test"],
    "hypergeometric": ["hypergeometric", "enrichment_test", "enrichment"],
    "whitening": ["whitening", "zca"],
    "kinematics": ["kinematics", "kinematic"],
    "umap": ["umap"],
    "tsne": ["tsne", "t_sne"],
    "hdbscan": ["hdbscan"],
}

# Canonical Target hints (no aliases; open snake_case in practice).
TARGET_SEED = {
    "pose_qc", "bout_segment", "behavior_tuning", "landmark_align", "identity_transfer",
    "motif_test", "population_trajectory", "unit_curation", "drift_corr", "batch_correct",
    "volume_mapping", "region_enrich", "manifold", "kinematics", "tuning", "bout", "synapse",
}

# 12 canonical few-shot examples (provided by the domain expert).
EXAMPLES = [
    {"name": "ns_pre-zebrafish-video-dlc-pose_qc",
     "desc": "DeepLabCut keypoint extraction and low-confidence smoothing QC for zebrafish behavior video."},
    {"name": "ns_feat-zebrafish-video-kinematics-bout_segment",
     "desc": "Dynamic segmentation of tail-beat trajectories into swim bouts; extract kinematic features (amplitude, frequency, curvature)."},
    {"name": "ns_ana-zebrafish-ca-glm-behavior_tuning",
     "desc": "GLM analysis of zebrafish calcium signals to fit modulation/tuning curves for a specific behavior (e.g. hunting)."},
    {"name": "ns_reg-global-swc_em-affine-landmark_align",
     "desc": "Affine registration of light-microscopy SWC reconstructions to electron-microscopy skeletons."},
    {"name": "ns_multi-mouse-swc_em-nblast-identity_transfer",
     "desc": "Use NBLAST morphology similarity to transfer LM cell-type molecular labels onto EM connectome neurons."},
    {"name": "ns_ana-global-graph-null_model-motif_test",
     "desc": "Edge-rewiring null model on a structural connectivity matrix to test significance of network motifs (e.g. feed-forward loops)."},
    {"name": "ns_pre-mouse-spike-whitening-drift_corr",
     "desc": "Whitening and channel-drift correction of raw high-density electrophysiology (Neuropixels) signals."},
    {"name": "ns_seg-mouse-spike-kilosort-unit_curation",
     "desc": "Spike-sorting clustering and single-unit quality-control curation of electrophysiology data."},
    {"name": "ns_ana-mouse-spike-pca-population_trajectory",
     "desc": "PCA to extract low-dimensional temporal trajectories of population activity under task states."},
    {"name": "ns_pre-mouse-st-harmony-batch_correct",
     "desc": "Batch correction of the expression matrix across multiple spatial-transcriptomics (Stereo-seq) tissue sections."},
    {"name": "ns_reg-mouse-st_atlas-lddmm-volume_mapping",
     "desc": "Nonlinear (LDDMM) elastic registration of spatial-transcriptomics tissue sections onto the CCFv3 reference brain."},
    {"name": "ns_multi-mouse-st_atlas-hypergeometric-region_enrich",
     "desc": "Hypergeometric test for spatial enrichment of molecular cell types across anatomical brain regions."},
]

_SNAKE = re.compile(r"^[a-z0-9_]+$")
_KEBAB = re.compile(r"^[a-z0-9-]+$")
MAX_PI_NAME_LEN = 64

_TABLES = {"stage": STAGE, "species": SPECIES, "modality": MODALITY, "method": METHOD_SEED}


def _slug(raw: Optional[str]) -> str:
    """Lowercase snake_case slug: spaces/hyphens -> '_', drop other chars, collapse '_'."""
    s = (raw or "").strip().lower()
    s = re.sub(r"[\s\-]+", "_", s)
    s = re.sub(r"[^a-z0-9_]+", "", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def normalize_field(axis: str, raw: Optional[str]) -> Optional[str]:
    """Map a free-text axis value to its canonical term via alias tables; snake-slug otherwise."""
    slug = _slug(raw)
    if not slug:
        return None
    table = _TABLES.get(axis)
    if table:
        if slug in table:
            return slug
        for canon, aliases in table.items():
            if slug == canon or slug in aliases:
                return canon
    return slug


def validate_smmt(stage: str, species: str, modality: str, method: str, target: str):
    """Soft validation. Returns (ok, errors, warnings).

    errors  -> hard format problems (block the save until fixed).
    warnings -> out-of-known-set stage/species/modality (allowed; surfaced to the expert).
    """
    errors: list[str] = []
    warnings: list[str] = []
    fields = {"stage": stage, "species": species, "modality": modality,
              "method": method, "target": target}
    for axis, val in fields.items():
        if not val or not _SNAKE.match(val or ""):
            errors.append(f"{axis} '{val}' must be non-empty snake_case ([a-z0-9_]).")

    if stage and stage not in STAGE:
        warnings.append(f"stage '{stage}' is not in the known set {sorted(STAGE)}; using it as a new prefix.")
    if species and species not in SPECIES:
        warnings.append(f"species '{species}' is not in the known set {sorted(SPECIES)}.")
    if modality and modality not in MODALITY:
        warnings.append(f"modality '{modality}' is not in the seed set {sorted(MODALITY)}; allowed (compound/derived).")

    if not errors:
        name = pi_name(stage, species, modality, method, target)
        if len(name) > MAX_PI_NAME_LEN:
            errors.append(f"derived pi name '{name}' is {len(name)} chars (> {MAX_PI_NAME_LEN}); shorten an axis.")
        elif not _KEBAB.match(name):
            errors.append(f"derived pi name '{name}' is not kebab-case.")

    return (not errors), errors, warnings


def canonical_label(stage: str, species: str, modality: str, method: str, target: str) -> str:
    """The folder name + INDEX.md heading (keeps underscores within axes)."""
    return "-".join([stage, species, modality, method, target])


# Folder name and canonical label are the same identifier.
folder_name = canonical_label


def pi_name(stage: str, species: str, modality: str, method: str, target: str) -> str:
    """The pi frontmatter `name` (kebab): underscores -> hyphens, collapsed."""
    name = canonical_label(stage, species, modality, method, target).replace("_", "-")
    name = re.sub(r"-+", "-", name).strip("-")
    return name


def export_vocab() -> dict:
    """Machine-usable vocabulary + examples, embedded into the namer subagent prompt."""
    return {
        "naming_rule": "<stage>-<species>-<modality>-<method>-<target>; axes joined by '-'; "
                       "each axis value is snake_case (underscores allowed WITHIN an axis).",
        "stage": {k: v for k, v in STAGE.items()},
        "species": {k: v for k, v in SPECIES.items()},
        "modality": {k: v for k, v in MODALITY.items()},
        "method_seed": {k: v for k, v in METHOD_SEED.items()},
        "target_seed": sorted(TARGET_SEED),
        "rules": [
            "stage: prefer the known prefixes; propose a new ns_* prefix only with a clear justification.",
            "species: one of the known species, or 'global' when species-agnostic.",
            "modality: the underlying data modality; may be compound (e.g. swc_em, st_atlas) or a "
            "derived representation (e.g. graph) when the analysis operates on that representation.",
            "method: the core algorithm/engineering approach (open snake_case).",
            "target: the scientific feature or deliverable produced (open snake_case).",
            "infer every axis from the metadata, question, the actual analysis code, and the dialogue; "
            "do not guess randomly — leave a low confidence when unsure.",
        ],
        "examples": EXAMPLES,
    }


if __name__ == "__main__":  # tiny smoke test
    import json
    ok, errs, warns = validate_smmt("ns_reg", "global", "swc_em", "affine", "landmark_align")
    print("validate:", ok, errs, warns)
    print("folder:", canonical_label("ns_reg", "global", "swc_em", "affine", "landmark_align"))
    print("pi_name:", pi_name("ns_reg", "global", "swc_em", "affine", "landmark_align"))
    print("normalize modality 'calcium imaging' ->", normalize_field("modality", "calcium imaging"))
    print("normalize method 'DeepLabCut' ->", normalize_field("method", "DeepLabCut"))
    print("vocab keys:", list(export_vocab().keys()))
    assert json.dumps(export_vocab())  # serializable
