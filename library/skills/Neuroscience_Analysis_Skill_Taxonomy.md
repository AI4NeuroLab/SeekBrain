# Neuroscience Analysis Skill Taxonomy

Controlled vocabulary for naming reusable neuroscience skills saved from a
Level-1 run. The machine-usable source of truth is
`internagent/modules/targeted_skill/taxonomy.py` — this document is kept in sync
with it; edit both together.

## Naming rule

```
Skill Name = <stage>-<species>-<modality>-<method>-<target>
```

- The **5 axes are joined by hyphens** (`-`).
- **Each axis value is `snake_case`** (`^[a-z0-9_]+$`), so underscores live *within*
  an axis, hyphens only *between* axes.
  - Example: `ns_reg-global-swc_em-affine-landmark_align`
    (stage=`ns_reg`, species=`global`, modality=`swc_em`, method=`affine`, target=`landmark_align`).

Two identifiers are derived from the name (independent on purpose):

| Identifier | Rule | Used for |
|---|---|---|
| `canonical_label` / folder name | keeps underscores | on-disk folder + the `INDEX.md` heading the repo `SkillLoader` matches |
| `pi_name` | underscores → hyphens, kebab, ≤64 chars | pi frontmatter `name`, i.e. `/skill:<pi_name>` |

e.g. folder `ns_reg-global-swc_em-affine-landmark_align` → pi name
`ns-reg-global-swc-em-affine-landmark-align`.

## The five axes

Naming is **inferred by an LLM** from the run's metadata, question, the actual
analysis code, and the dialogue — this vocabulary *guides* the model and is used
for soft normalization/validation afterwards, not as a rigid template. Stage and
Species are preferred-but-extensible; Modality is semi-open; Method and Target are open.

### Stage — analysis-stage prefix (preferred set; a justified new `ns_*` prefix is allowed)
| Prefix | Meaning |
|---|---|
| `ns_pre` | preprocessing / QC / denoising / correction |
| `ns_seg` | segmentation / spike-sorting / ROI / unit curation |
| `ns_reg` | registration / alignment / atlas mapping |
| `ns_feat` | feature extraction |
| `ns_ana` | analysis / modeling / statistics |
| `ns_multi` | multi-modal integration / label transfer |

### Species — biological boundary
`zebrafish`, `mouse`, `marmoset`, `human`, `global` (species-agnostic).

### Modality — underlying data modality
Seed terms: `ca` (calcium imaging), `spike` (high-density electrophysiology),
`swc` (morphology reconstruction), `st` (spatial transcriptomics),
`video` (behavior video), `em` (electron microscopy), `atlas` (reference brain).
May be **compound** (`swc_em` for LM–EM, `st_atlas` for ST-to-atlas) or a
**derived representation** (`graph` when the analysis operates on a network).

### Method — core algorithm / engineering approach (open `snake_case`)
Examples: `glm`, `pca`, `dlc` (DeepLabCut), `nblast`, `affine`, `lddmm`,
`harmony`, `kilosort`, `whitening`, `null_model`, `hypergeometric`, `umap`,
`hdbscan`, `kinematics`.

### Target — scientific feature or deliverable produced (open `snake_case`)
Examples: `pose_qc`, `bout_segment`, `behavior_tuning`, `landmark_align`,
`identity_transfer`, `motif_test`, `population_trajectory`, `unit_curation`,
`drift_corr`, `batch_correct`, `volume_mapping`, `region_enrich`, `manifold`,
`kinematics`, `tuning`, `synapse`.

## Canonical examples (few-shot)

**Zebrafish free-movement circuit & behavior**
- `ns_pre-zebrafish-video-dlc-pose_qc` — DeepLabCut keypoint extraction + low-confidence smoothing QC of zebrafish behavior video.
- `ns_feat-zebrafish-video-kinematics-bout_segment` — segment tail-beat trajectories into bouts; extract kinematic features (amplitude, frequency, curvature).
- `ns_ana-zebrafish-ca-glm-behavior_tuning` — GLM of zebrafish calcium signals to fit modulation curves for a behavior (e.g. hunting).

**Cross-scale LM–EM & connectomics**
- `ns_reg-global-swc_em-affine-landmark_align` — affine registration of LM SWC reconstructions to EM skeletons.
- `ns_multi-mouse-swc_em-nblast-identity_transfer` — NBLAST morphology similarity to transfer LM cell-type labels onto EM connectome neurons.
- `ns_ana-global-graph-null_model-motif_test` — edge-rewiring null model on a structural connectivity matrix to test network-motif significance (e.g. feed-forward loops).

**Neural dynamics & manifold**
- `ns_pre-mouse-spike-whitening-drift_corr` — whitening + channel-drift correction of raw Neuropixels signals.
- `ns_seg-mouse-spike-kilosort-unit_curation` — spike-sorting clustering + single-unit QC curation.
- `ns_ana-mouse-spike-pca-population_trajectory` — PCA to extract low-dimensional temporal trajectories of population activity under task states.

**Spatial transcriptomics & anatomy**
- `ns_pre-mouse-st-harmony-batch_correct` — batch correction of the expression matrix across multiple Stereo-seq sections.
- `ns_reg-mouse-st_atlas-lddmm-volume_mapping` — nonlinear (LDDMM) registration of ST sections onto CCFv3.
- `ns_multi-mouse-st_atlas-hypergeometric-region_enrich` — hypergeometric test for spatial enrichment of molecular cell types across brain regions.

## Derive / validate contract

1. **Derive** (LLM): infer each axis from `data_info` metadata (species/modality
   hints), the `question`, the actual analysis code (imports/functions signal
   method/modality: `deeplabcut`→`dlc`, `sklearn…PCA`→`pca`, `statsmodels…GLM`→`glm`,
   `kilosort`→`spike`), statistics keys, and the conversation digest — with a
   rationale and per-field confidence.
2. **Normalize** (`taxonomy.normalize_field`): alias-map free text to canonical
   terms (`calcium`→`ca`, `deeplabcut`→`dlc`, `neuropixels`→`spike`).
3. **Validate** (`taxonomy.validate_smmt`, soft): hard-fail only on bad format or a
   `pi_name` > 64 chars / non-kebab; *warn* (not reject) on out-of-known-set
   stage/species/modality so novel terms are allowed and surfaced to the expert.
4. **Confirm**: the expert reviews the proposed name (warnings + low-confidence
   fields highlighted) and may edit any axis before the skill is written.
