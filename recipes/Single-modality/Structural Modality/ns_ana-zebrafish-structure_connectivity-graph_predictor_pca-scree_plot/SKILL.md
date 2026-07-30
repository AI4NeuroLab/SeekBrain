---
name: ns_ana-zebrafish-structure_connectivity-graph_predictor_pca-scree_plot
description: 'Run PCA on the 40-column structural-predictor matrix built from the zebrafish directed and undirected structural connectome plus inter-regional Euclidean distances, and report per-component and cumulative explained variance for the first 10 principal components. Use this whenever someone asks how many dimensions the structural predictors really span, whether graph metrics are redundant or collinear, "how much variance does PC1 explain", "scree plot of the structural predictors", "do structural properties collectively contribute to functional connectivity", "can we compress the connectome features", or wants a dimensionality/redundancy check before regressing structure onto functional connectivity. This is the first step of the 2J→2K→2L chain: it establishes that one latent structural mode dominates, `ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction` then extracts that PC1 and correlates it with FC, and `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` plots the relationship.
  Reach for it before assuming a multi-predictor SC→FC model needs all its predictors.'
triggers:
- Run the Dimensionality of the structural predictor space (PCA scree) recipe
- Run PCA on the 40-column structural-predictor matrix built from the zebrafish directed and undirected structural connectome plus inter-regional Euclidean distances, and report per-component and cumulative explained variance for the first 10 principal components.
- Generate the outputs described by ns_ana-zebrafish-structure_connectivity-graph_predictor_pca-scree_plot
tags:
- zebrafish
- structure
- connectivity
- graph
- predictor
version: '1.0'
---

# Dimensionality of the structural predictor space (PCA scree)

Fits PCA to the structural predictor matrix derived from the terminal-expanded connectome
and quantifies how quickly its variance saturates.

## When to use this

The question is *"how redundant are the structural graph metrics?"* or *"how many latent
structural dimensions are there?"*. The answer here is: one component carries ~65% and ten
carry ~98%, which is what licenses the single-PC1 analyses downstream.

This recipe only reports variance. It does **not** produce the PC1 matrix — that is
`ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction`, which recomputes the identical predictor
matrix and PCA and then reshapes component 1. If you need both, run this one for the scree
numbers and that one for the artifact; they agree exactly because the inputs and the PCA call
are identical.

Related but distinct: `ns_multi-zebrafish-sc_ca-graph_predictors-fc_variance_explained`
(Figure 2I) builds the same predictor matrix but regresses each predictor against FC
individually. It writes `Figure2_SC_predictors.npy`; this recipe does **not** read that file —
it rebuilds the predictors from raw SC, so the two runs must be kept parameter-identical or
they silently diverge.

## Preconditions

- The library modules are vendored into `scripts/` — **three** files for two import lines.
  `zebrafish_Ca_utils.py` supplies `MapzebrainAtlas`, `zebrafish_Ca_utils_predictors_xps.py`
  supplies `Predictors`, and `zebrafish_Ca_utils_patch_xps.py` comes along transitively because
  `zebrafish_Ca_utils_predictors_xps` starts with `from zebrafish_Ca_utils_patch_xps import *`.
  The `sys.path` line points at the script's own directory, so imports resolve with no external
  setup. That line is the only edit to the script; everything else is as it ran.
- Env vars: `PROCESS_DATA_DIR`, `SAVE_DIR`, `ZEBRAFISH_PATH`, `ATLAS_PATH` — all four are read
  with bare `os.getenv`, which returns `None` rather than raising. An unset variable becomes a
  `TypeError` deep inside `os.path.join`, so check them yourself before running.
- `Figure1_excluded_regions.npy` in `PROCESS_DATA_DIR`, from
  `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`.
- `SC_matrix_directed_terminals_expanded.npy` and `SC_matrix_undirected_terminals_expanded.npy`
  under `$ZEBRAFISH_PATH/Files/`.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_directed_terminals_expanded.npy` | (70, 70) |
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy` | (70, 70) |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| in | `$ATLAS_PATH` via `MapzebrainAtlas.regionCentroids` | (70, 3) per hemisphere |
| out | `$PROCESS_DATA_DIR/Figure2_SC_predictor_PCA_expvar.npy` | (10,) float |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load both SC matrices with `allow_pickle=True` and cast to `float`. They arrive at 70×70,
   i.e. **pre-exclusion**, unlike the FC matrices which are already 65×65.
2. Load `Figure1_excluded_regions.npy` as int.
3. Build the atlas: `atlas = MapzebrainAtlas(ATLAS_PATH)`. Take `atlas.regionCentroids['left']`
   and `atlas.regionCentroids['right']` and average them elementwise. Use `.regionCentroids`,
   not `.centroids` — they are different members and other recipes in this set use the other
   one. Averaging the hemispheres collapses each bilateral pair to a single midline-symmetric
   point, which is what makes the distance matrix match the 70-region SC indexing.
4. `distance_matrix = squareform(pdist(centroids, metric='euclidean'))`, then
   `np.fill_diagonal(..., 0.0)`.
5. Drop the excluded rows **and** columns from all three matrices with a boolean keep-mask,
   giving 65×65 each. Assert the three shapes agree — a mismatch means the exclusion was
   applied twice somewhere upstream.
6. `model = Predictors(sc_directed_filtered, sc_undirected_filtered, distance_filtered)` —
   positional arguments, in that order.
7. `model.compute_predictors(directed=True)`. `model.predictors` comes back as (4225, 40):
   one row per ordered region pair (65², including the diagonal) and 40 predictor columns.
8. `PCA(n_components=10)` and `.fit(model.predictors)`. Read `explained_variance_ratio_` and
   its `np.cumsum`.
9. Save the ratio array (not the cumulative one) to
   `Figure2_SC_predictor_PCA_expvar.npy`.
10. Plot both curves on one axis: cumulative in black, per-component ratio in
    `mediumvioletred`, both `marker='o'`, `linewidth=2`, `markersize=6`, `figsize=(5,4)`,
    `ylim=(-0.05, 1.05)`, top and right spines removed. Draw the black cumulative line
    **first** so the pink markers sit on top — at PC1 the two curves coincide exactly and
    whichever is drawn last is the only one visible.
11. Annotate PC1's value as text at `(1, pc1_var + 0.03)` in pink, plus in-plot labels
    "Ratio" and "Cumulative" at x = 8.5.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `n_components` | 10 | Only the first 10 PCs are fit, so `cumulative_variance[-1]` is total-variance-captured-by-10, not 1.0. |
| `directed` | `True` | Passed to `compute_predictors`. Directed-SC features are computed; flipping this changes the 40-column feature set and every downstream number. |
| centroid source | `.regionCentroids`, hemisphere-averaged | Sets the distance predictor. `.centroids` would give a different geometry. |
| distance metric | `'euclidean'` | Straight-line, not path-length. |
| exclusion | applied once, 70 → 65 | Applying it again is the Figure2L bug; see that recipe. |
| `figsize` | `(5, 4)` | Display only. |
| `ylim` | `(-0.05, 1.05)` | Display only. |

## Expected results

From `statistics.json` of the original run:

- Predictor matrix shape **(4225, 40)**; 5 regions excluded, 65 retained.
- Per-component explained variance ratio:
  **0.6489, 0.1105, 0.0779, 0.0553, 0.0321, 0.0223, 0.0124, 0.0100, 0.0081, 0.0057**
- Cumulative: 0.6489 → 0.7595 → 0.8373 → 0.8926 → **0.9248** (5 PCs) → 0.9471 → 0.9594 →
  0.9694 → 0.9775 → **0.9832** (10 PCs)

The claims these support: a single latent factor accounts for 64.9% of the variance across
40 structural predictors, and 10 components reach 98.3% — the structural feature space is
highly collinear and compressible.

## Pitfalls

- **PCA is unscaled.** `sklearn.decomposition.PCA` mean-centres but does not standardise. The
  40 predictor columns are on wildly different units (Euclidean distance in atlas voxels,
  binary/weighted edge counts, communicability values), so the 64.9% PC1 is partly a
  statement about which columns happen to have the largest raw variance, not purely about
  shared topology. If you want a scale-free redundancy estimate, z-score the columns first —
  and expect a different number. Nothing in the source run does this.
- **The scree is fit to 10 components, not all 40.** Cumulative variance stops at 0.9832 by
  construction. Do not read the shortfall from 1.0 as residual noise in a full decomposition;
  it is the variance in PCs 11–40.
- **The base script silently defaults to `[10]`** (retina only) if the exclusion file is
  missing, whereas the refine script defaults to an empty array. Either default produces a
  differently-sized predictor matrix and a wrong answer with no error. Verify the exclusion
  file exists rather than relying on the fallback.
- **Only the base script writes `statistics.json`.** The refine script drops the `json` import
  and the stats block entirely, so the stored numbers above come from the base run. The refine
  script is the one to prefer for the figure, but re-run the base one if you need the stats.
- **The refine script honours the `import *` the spec demanded**; the base script used
  `from zebrafish_Ca_utils_predictors_xps import Predictors`. Functionally equivalent for
  `Predictors`, but the wildcard also pulls in whatever else the module exports, which matters
  if you compare against Figure 3A's wildcard-imported helpers.
- The rows of `model.predictors` are the **full** 65×65 grid, diagonal included, so the
  4225 rows are not 2080 unique edges. Downstream, `pca_result[:, 0].reshape(65, 65)` relies
  on this ordering exactly.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim. Writes `statistics.json`.
- `scripts/refine_implementation.py` — figure fixes (draw order, label positions, wildcard
  import). **Prefer this for the figure**; it writes no statistics.
- `references/data_contract.md` — env vars, file shapes, artifact consumers.
- `references/method_details.md` — every parameter, full statistics, provenance.
