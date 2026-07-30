---
name: "ns_multi-zebrafish-structural_functional_matrix-graph_predictor_pca_correlation-pc1_fc_matrix"
description: "Extract the first principal component of the zebrafish structural-predictor matrix, reshape it into a region-by-region structural PC1 matrix, sign-align it to functional connectivity, and measure how strongly it predicts FC with an edge-wise Pearson correlation over the upper triangle. Use this whenever someone asks whether structure predicts function, 'does the connectome explain functional connectivity', 'correlate SC with FC', 'structure-function coupling', 'how well does the dominant structural mode match the FC matrix', or wants the composite half-SC/half-FC heatmap that makes the two matrices visually comparable. This is the middle link of the 2J→2K→2L chain: `ns_feat-zebrafish-sc-pca-predictor_dimensionality` establishes that PC1 dominates the predictor space, this recipe turns that PC1 into the artifact `Figure2_SC_predictor_PC1.npy` and reports r ≈ 0.68, and `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` consumes that artifact for the scatter plot. Reach"
triggers:
- "Analyze structural pc1 as a predictor of functional connectivity"
- "Generate structural pc1 as a predictor of functional connectivity outputs"
- "Apply the ns_multi-zebrafish-structural_functional_matrix-graph_predictor_pca_correlation-pc1_fc_matrix recipe"
tags:
- "zebrafish"
- "structural"
- "functional"
- "matrix"
- "graph"
version: "1.0"
---

# Structural PC1 as a predictor of functional connectivity

Rebuilds the structural predictor matrix, takes its leading principal component, reshapes it
into a 65×65 connectivity-like matrix, and correlates it edge-wise with the group-average FC.

## When to use this

Use this recipe to reduce structural graph predictors to PC1 and test its edge-wise association with functional connectivity. Do not use it when predictor columns or matrix edges are misaligned, or when interpretable single-predictor effects are required.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy` | (65, 65) — already post-exclusion |
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_directed_terminals_expanded.npy` | (70, 70) — pre-exclusion |
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy` | (70, 70) — pre-exclusion |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| in | `$ATLAS_PATH` via `MapzebrainAtlas.regionCentroids` | (70, 3) per hemisphere |
| out | `$PROCESS_DATA_DIR/Figure2_SC_predictor_PC1.npy` | (65, 65) |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load the FC matrix — it arrives **already filtered** at 65×65, unlike the SC matrices which
   are still 70×70. This asymmetry is the single most important thing to get right in this
   analysis; the scripts handle it by filtering SC and distance only.
2. Load both SC matrices (`allow_pickle=True`, cast to float) and the exclusion list.
3. Build the distance matrix: `atlas.regionCentroids['left']` and `['right']` averaged
   elementwise, then `squareform(pdist(centroids, 'euclidean'))` with a zeroed diagonal. Use
   `.regionCentroids`, not `.centroids` — they are different atlas members.
4. Filter the two SC matrices and the distance matrix from 70 to 65 regions with a
   bounds-checked keep-mask. Do not touch the FC matrix.
5. Assert all four shapes are now equal. This assertion is what catches a double-exclusion.
6. `model = Predictors(SC_directed_filtered, SC_undirected_filtered, distance_filtered)`, then
   `model.compute_predictors(directed=True)` → `model.predictors` of shape (4225, 40).
7. `pca_result = PCA(n_components=10).fit_transform(model.predictors)`. Take
   `PC1 = pca_result[:, 0]`. Note this is the **transformed scores** (`fit_transform`), one
   value per region pair — not the loading vector.
8. `PC1_matrix = PC1.reshape(65, 65)`, then `np.fill_diagonal(PC1_matrix, 0.0)`. The reshape
   is valid only because the predictor rows are the flattened 65×65 grid in C order.
9. Extract `np.triu_indices(65, k=1)` from both matrices — 2080 unique pairs — and mask to
   entries finite in both.
10. Compute Pearson r. Multiply `PC1_matrix` by `np.sign(r)`. A PCA component's sign is
    arbitrary, so without this the same analysis could report −0.68 on a rerun; fixing the
    orientation against FC makes the saved artifact and every downstream plot deterministic.
11. Recompute r on the sign-flipped matrix and assert it is non-negative.
12. Save `Figure2_SC_predictor_PC1.npy`. **This is the artifact
    `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` reads.**
13. For the figure, min-max normalise PC1 and FC *separately* to [0, 1] — they live on
    incomparable scales, so a shared colour axis would render one of them flat.
14. Build a composite: lower triangle (`k=-1`) from normalised PC1, upper triangle (`k=1`) from
    normalised FC, diagonal 0. `imshow` with `cmap='Blues_r'`, `aspect='equal'`,
    `origin='upper'`. Draw a white `linewidth=5` line along the diagonal to separate the halves.
15. Colorbar labelled `Normalized weight`, rotated 270°, `labelpad=20`, ticks removed.
    Y-ticks only at the first and last region. Text labels outside the axes.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `n_components` | 10 | Only PC1 is used, but fitting 10 keeps this identical to Figure 2J's PCA so the two runs agree. |
| `directed` | `True` | Selects the directed-SC feature set for `compute_predictors`. |
| PCA output used | `fit_transform(...)[:, 0]` | Scores, not loadings. Length 4225, one per ordered region pair. |
| diagonal | set to 0 before correlating | Removes self-pairs, which would otherwise be perfectly correlated artifacts. |
| triangle | `np.triu_indices(n, k=1)` | 2080 unique undirected pairs from 65 regions. |
| sign alignment | `PC1_matrix *= np.sign(r)` | Makes the arbitrary PCA sign reproducible and the saved artifact orientation-stable. |
| normalisation | min-max, per matrix | Display only; does not affect r or the saved artifact. |
| `cmap` | `'Blues_r'` | Reversed Blues, so high weight is dark. Display only. |
| `figsize`, `dpi` | `(6, 5.5)`, 300 | Display only. |

## Expected results

From `statistics.json` of the reference implementation (written by the figure-oriented implementation):

- `pearson_r` = **0.6821153902723572**
- `pearson_p_value` = **8.533757589388221e-285**

From the recorded outputs, the quantities the stats file does not record:

- FC (65, 65); SC directed and undirected (70, 70) → (65, 65) after exclusion
- Predictors (4225, 40); PCA result (4225, 10)
- **2080 edges** entered the correlation
- Explained variance ratio identical to Figure 2J: PC1 = 0.6489
- The initial and post-sign-flip correlations were both r = 0.6821, i.e. the raw PC1 already
  pointed the right way on this data and `np.sign` was a no-op.

The claim these support: the dominant structural mode is a strong, highly significant positive
predictor of functional connectivity (r ≈ 0.68, p < 1e-284) across 65 brain regions.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils_patch_xps.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils_predictors_xps.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
