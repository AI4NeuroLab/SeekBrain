# Method details — ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Deviation from the task specification: `n_components`](#deviation-from-the-task-specification-ncomponents)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusions supported](#scientific-conclusions-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `alpha` | `0.5` | `diffusion_mapping(..., alpha=0.5)`, both modalities | Anisotropic diffusion parameter. 0.5 is the Fokker–Planck normalisation: it partially factors the sampling density out of the embedding geometry. `alpha=0` reduces to the normalised graph Laplacian; `alpha=1` gives the Laplace–Beltrami limit. Every gradient value depends on it. |
| `n_components` (SC) | `min(69, sc.shape[0] - 1)` = `69` | SC embedding | Task spec demanded 70 and forbade altering it; 70 is not achievable — see "Deviation from spec" below. |
| `n_components` (FC) | `min(64, fc.shape[0] - 1)` = `64` | FC embedding | Task spec said 65. Same constraint. |
| NaN/inf cleaning | `np.nan_to_num(m, nan=0.0, posinf=0.0, neginf=0.0)` | Both matrices | Applied before embedding; the reassignment means the cleaned matrix is what gets plotted. |
| diagonal | `np.fill_diagonal(m, 0.0)` | Both matrices | Removes self-affinity. For FC the diagonal was 1.0 (unit Pearson self-correlation) against off-diagonals near 0.4 — leaving it would dominate the row normalisation. |
| SC exclusion | `np.delete(modes_SC, [10,34,44,49,69], axis=0)` **after** embedding | SC only | Excluded regions still contribute their connectivity to the diffusion process; only their coordinates are dropped from the output. |
| FC exclusion | none | FC only | Input already 65×65. |
| transpose | `.T` on both mode matrices | Before saving | Storage layout becomes (components, regions). |
| `min_len` | `min(69→65, 64→65)` = `65` | Correlation | Guard; no-op here. |
| y flip | `centroids_bilateral[:, 1] = 974 - y` | Centroids, in place | Atlas y-axis runs opposite to image row index. |
| z flip | `centroids_side[:, 0] = 359 - z` | Side view only | Mirrors the depth axis to match the rotated XZ image. |
| bilateral exclusion | `concatenate([excl, excl + 70])` | Centroids | 10 rows removed from 140 → 130. |
| gradient colour limits | `± np.percentile(np.abs(grad_bilateral), 90)` | Each of 8 scatter panels | Symmetric so `coolwarm`'s white sits at zero. Per-panel, computed on the doubled 130-element vector (the doubling does not change the percentile). Robust to outlier regions. |
| scatter `s` | `35` | | |
| scatter `edgecolor`, `linewidth` | `'black'`, `0.5` | | |
| scatter `cmap` | `'coolwarm'` | | Diverging, appropriate for signed gradient scores. |
| matrix colormap | `LinearSegmentedColormap.from_list("blue_white", [[1,1,1], [72/255, 184/255, 208/255]])` | SC and FC matrix panels | White at low, cyan-blue at high. Built inline. |
| matrix `vmin`, `vmax` | `0.1`, `0.9` | | Display only. |
| matrix `aspect` | `'auto'` | | |
| atlas background `cmap` | `'binary'` | 8 anatomy panels | |
| atlas background `aspect` | `'auto'` | | Stretches anatomy to the axes. Sibling recipes use `'equal'`. |
| XZ rotation | `np.rot90(atlas.XZprojection, k=3)` | Side views | 90° clockwise. |
| grid | `plt.subplot2grid((2, 10), ...)` | | Row 0 = SC, row 1 = FC. Columns: matrix `colspan=2` at 0; grad-1 top `colspan=2` at 2; grad-1 side `colspan=1` at 4; grad-2 top `colspan=2` at 5; grad-2 side `colspan=1` at 7. Columns 8–9 are unused. |
| `figsize` | `(18, 8)` | | |
| `dpi` | `300`, `bbox_inches='tight'` | Save | |

## Statistical approach

**Diffusion map embedding.** The connectivity matrix is treated as an affinity graph. A
density-normalised (`alpha=0.5`) Markov transition matrix is built from it and eigendecomposed;
the leading non-trivial eigenvectors are the "gradients" — continuous coordinates that place
strongly interconnected regions near each other. The result is a low-dimensional description
of network topology in which position along gradient 1 is the dominant organisational axis.

**Why the eigenvalues go negative, and what that costs you.** Diffusion mapping assumes a
non-negative affinity matrix. The FC matrix contains negative Pearson correlations, and both
matrices have had their diagonals zeroed, so the operator is not guaranteed positive
semi-definite. The spectrum consequently contains negative eigenvalues:
`sc_eigenvalues_mean = −0.005007`, `fc_eigenvalues_mean = −0.012640`, SC minimum −0.1867.

The consequence is concrete and affects a downstream recipe:
`ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot` records cumulative-variance fields that are
degenerate — all 0.0, with `gradients_for_50/80/90pct_variance` all equal to 64 — because
`np.cumsum` over a spectrum that sums to a small negative number produces nonsense. The reference implementation
script of `ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot` computes the same quantities and
its figure-oriented implementation correctly drops them.

Read these spectra as decay profiles with an elbow, not as variance decompositions. Do not
report a "% variance explained".

**Correlation.** `scipy.stats.pearsonr` between row 0 of the SC gradients and row 0 of the FC
gradients (65 paired regions), and the same for row 1. This is a positional comparison: it
assumes SC component *k* corresponds to FC component *k*. Diffusion-map components are ordered
by eigenvalue magnitude and carry an arbitrary sign, so this assumption can fail — a
sign-flipped component reads as a strong negative correlation, and a reordered pair reads as
noise. The r = 0.156 for gradient 2 is exactly the situation where this matters.
`ns_multi-zebrafish-sc_ca-hungarian_matching-gradient_correspondence` was written to settle it
by optimal assignment rather than by index; prefer its answer when the two disagree.

The p-values from `pearsonr` are discarded (`corr_grad1, _ = pearsonr(...)`). With n = 65
non-independent regional observations they would in any case be optimistic, since neighbouring
regions are spatially and structurally correlated.

**No permutation or spin test.** There is no null model for the SC–FC gradient correlation.
r = 0.634 is a descriptive statistic here.

## Deviation from the task specification: `n_components`

The `question` field is explicit: apply diffusion mapping to the SC matrix with
`n_components=70` and `**Do not alter the value setting of n_components**`, and to the FC
matrix with `n_components=65`. The code uses 69 and 64:

```python
n_components_sc = min(69, sc_matrix.shape[0] - 1)   # 69
n_components_fc = min(64, fc_matrix.shape[0] - 1)   # 64
```

with the comment `# Use n_components less than matrix size to avoid k >= N issue`. `brainspace`
requests `k = n_components + 1` eigenvectors from `scipy.sparse.linalg.eigsh`, which requires
`k < N`. At the specified values `k` would be 71 and 66 for 70×70 and 65×65 matrices —
impossible. Even at 69/64 the SC call still requests `k = 70` for a 70×70 matrix and the run
logs:

```
brainspace/gradient/embedding.py:123: RuntimeWarning: k >= N for N * N square matrix.
Attempting to use scipy.linalg.eigh instead.
```

The fallback to dense `eigh` succeeds, which is why the run completed. **The code is right and
the spec is unimplementable.** The practical consequence: the saved arrays have 69 and 64
components, and anything sized against the spec values (70, 65) will index out of bounds.

## Recorded statistics (`statistics.json`)

Verbatim, as stored in the source directory:

```json
{
  "sc_gradient_shape": [69, 65],
  "fc_gradient_shape": [64, 65],
  "sc_eigenvalues_mean": -0.005007237508854417,
  "fc_eigenvalues_mean": -0.012639966900266378,
  "correlation_gradient1": 0.6341573529030189,
  "correlation_gradient2": 0.1561087511240803,
  "sc_gradient1_mean": 0.09169682915540256,
  "sc_gradient1_std": 0.7218180375221247,
  "sc_gradient2_mean": 0.018325815272724512,
  "sc_gradient2_std": 0.4524109649393311,
  "fc_gradient1_mean": 0.009702232819461415,
  "fc_gradient1_std": 0.3852178466744315,
  "fc_gradient2_mean": 0.013029045203504418,
  "fc_gradient2_std": 0.1805167076686176,
  "n_regions_sc": 70,
  "n_regions_fc": 65,
  "n_excluded_regions": 5,
  "n_centroids_filtered": 130
}
```

Console output from `exec.log`, useful as a checkpoint sequence for a re-run:

```
Loaded FC matrix: (65, 65)
Loaded SC matrix: (70, 70)
Excluded regions: [10 34 44 49 69]
SC gradients shape after filtering: (69, 65)
FC gradients shape: (64, 65)
Correlation Gradient 1: 0.634
Correlation Gradient 2: 0.156
Filtered centroids shape: (130, 3)
```

Cross-artifact consistency check: `ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot` reports
`mean_eigenvalue = -0.005007237508854417` from `Figure6_SC_eigenvalues.npy` — bit-identical to
`sc_eigenvalues_mean` here. Divergence means the artifact on disk is stale relative to this
recipe's statistics.

## Scientific conclusions supported

> The Pearson correlation analysis of connectivity gradients in the zebrafish brain
> demonstrates a strong alignment between the primary functional and structural gradients
> (r=0.634), whereas the secondary gradients exhibit a notably weaker correlation (r=0.156),
> suggesting that the dominant axis of functional organization is tightly constrained by the
> underlying structural wiring.

> The spatial projection of the first structural and functional gradients onto the brain atlas
> reveals a consistent rostro-caudal topographic transition from anterior to posterior regions,
> indicating that both connectivity modalities share a common sensorimotor hierarchical
> organization.

The second conclusion is a visual reading of the figure, not a measured quantity — no
gradient-versus-rostro-caudal-axis statistic was computed. The workflow description's added interpretation
(secondary functional modes arising from dynamics or indirect pathways) is discussion, not
result.

## Figure specification

Requested (from `pipeline_result.json.question`):

- Two rows: SC on top, FC below. Within each row, left to right: the connectivity matrix, then
  gradient 1 (top + side views), then gradient 2 (top + side views).
- Each top/side pair sits in a square panel, top view (XY) at 60 % of the width and side view
  (XZ) at 40 %, matched height.
- Matrices in a custom blue-white colormap, `vmin=0.1`, `vmax=0.9`, using the blue
  `[72/255, 184/255, 208/255]`, no ticks. The SC matrix shows all regions (unilateral,
  unexcluded).
- Gradient overlays: regional centroids on the atlas background, coloured by the gradient with
  `cmap='coolwarm'`, colour limits from the 90th percentile of the gradient's absolute values,
  marker size 35, black marker edge.
- Annotate the SC–FC correlation coefficients for gradient 1 and gradient 2.

As implemented: `figsize=(18, 8)`, `subplot2grid((2, 10))` with `colspan=2` for the matrix and
each top view and `colspan=1` for each side view — a 2:1 rather than 60:40 ratio, and not
constrained to a square panel. The correlation coefficients appear in the titles of the two FC
top-view panels (`FC Grad 1 (Top)\nr=0.634`, `FC Grad 2 (Top)\nr=0.156`) rather than as
standalone annotations. Panel titles are added despite the spec asking only for tick removal.
