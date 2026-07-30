---
name: "ns_multi-zebrafish-sc_fc_matrix-correlation_polyfit-scatter_plot"
description: "Produce the edge-wise scatter plot of structural PC1 against functional connectivity with a first-order polynomial best-fit line, reporting Pearson r, R², slope and intercept. Use this when someone wants to see the structure-function relationship rather than just quote it — 'plot SC against FC', 'scatter of structural PC1 vs functional connectivity', 'regression line for structure-function coupling', 'how much FC variance does structure explain', 'show me the correlation', or a figure panel accompanying an SC→FC claim. It consumes `Figure2_SC_predictor_PC1.npy` written by `ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction` together with `Figure1_FC_matrix.npy`, and closes the 2J→2K→2L chain that begins with `ns_feat-zebrafish-sc-pca-predictor_dimensionality`. Read the Pitfalls before quoting its numbers: this analysis re-applies the exclusion mask to already-filtered matrices and computes its r on 61 regions rather than the 65 used upstream."
triggers:
- "Analyze structural pc1 vs fc scatter and linear fit"
- "Generate structural pc1 vs fc scatter and linear fit outputs"
- "Apply the ns_multi-zebrafish-sc_fc_matrix-correlation_polyfit-scatter_plot recipe"
tags:
- "zebrafish"
- "sc"
- "fc"
- "matrix"
- "correlation"
version: "1.0"
---

# Structural PC1 vs FC scatter and linear fit

Correlates the upper triangles of the structural PC1 matrix and the group-average FC matrix,
fits a straight line, and renders the scatter.

## When to use this

Use this recipe to quantify and plot the edge-wise linear association between structural PC1 scores and functional connectivity. Do not use it before confirming that both matrices share the same region order and exclusion mask.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy` | (65, 65) |
| in | `$PROCESS_DATA_DIR/Figure2_SC_predictor_PC1.npy` | (65, 65) |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png` | |
| out | `$SAVE_DIR/statistics.json` | |

This recipe writes **no `.npy` artifact** — it is a terminal node in the pipeline DAG.

Full detail in `references/data_contract.md`.

## Procedure

1. Load the FC matrix, the PC1 matrix and the exclusion list. Assert FC and PC1 have the same
   shape; both are 65×65.
2. Bounds-filter the exclusion indices against the matrix size, then apply the keep-mask to
   both matrices. **On this data that is a mistake** — both inputs are already post-exclusion.
   See Pitfalls. To reproduce the stored numbers you must keep the step; to compute the
   scientifically correct value, skip it and work on all 65 regions.
3. Zero both diagonals (reference implementation only; the figure-oriented implementation drops this, harmlessly, because
   `k=1` already excludes them).
4. Extract `np.triu_indices(n, k=1)` from both filtered matrices. `k=1` excludes the diagonal,
   so each unordered region pair contributes one edge.
5. Mask to entries finite in both vectors. Nothing was dropped in the reference implementation.
6. `pearsonr(pc1_values, fc_values)` → r and p.
7. `np.polyfit(pc1_values, fc_values, deg=1)` → slope, intercept. This is ordinary least
   squares with FC as the response — the fit is not symmetric in x and y, so swapping the axes
   would give a different line (though the same r).
8. Build the line for plotting over `np.linspace(pc1.min(), pc1.max(), 200)`.
9. Scatter: `s=5`, `alpha=0.3`, `color='black'`, `edgecolors='none'`. The transparency is the
   point — at 1830 overlapping edges an opaque scatter reads as a solid blob and hides where
   the density actually is.
10. Overlay the fit in `mediumvioletred`, `linewidth=2`. Remove top and right spines. Label
    axes `Structural PC1` and `FC`. Annotate `r = 0.683` in `mediumvioletred` at axes
    coordinates (0.05, 0.95).
11. Save the figure and a `statistics.json` carrying sample sizes, correlation and regression
    parameters.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| exclusion re-application | present in both scripts | Reduces 65 → 61 regions. This is the bug; it changes which edges are analysed. |
| triangle | `np.triu_indices(n, k=1)` | 1830 edges at n=61 (2080 at n=65). |
| `deg` | `1` | First-order polynomial, i.e. a straight line, via `np.polyfit`. |
| regression direction | FC regressed on PC1 | Least squares is asymmetric; slope 0.0308 is dFC/dPC1, not the reverse. |
| `s`, `alpha` | `5`, `0.3` | Scatter density readability; display only. |
| `figsize`, `dpi` | `(5, 4)`, 300 | Display only. |
| fit colour | `'mediumvioletred'` | Display only. |

## Expected results

From `statistics.json` of the reference implementation:

- `n_regions_original` = **65**, `n_regions_filtered` = **61**, excluded = `[10, 34, 44, 49, 69]`
- `total_edges_upper_triangle` = **1830**, `valid_edges_after_filtering` = **1830**
- `pearson_r` = **0.6829054774551018**
- `pearson_p_value` = **1.3847042366429555e-251**
- `r_squared` = **0.4663598911381805**
- `slope` = **0.03082002574780239**, `intercept` = **0.40019859908758104**
- Regression equation: `FC = 0.0308 * PC1 + 0.4002`

Index 69 is out of bounds for the already filtered matrix and is silently dropped, leaving
`[10, 34, 44, 49]` as the incorrectly reapplied mask.

The claim these support: structural PC1 is a significant positive predictor of FC edge
strength, explaining about 47% of its variance.

## Pitfalls

- Both input matrices are already reduced from 70 to 65 regions. Do not apply
  `Figure1_excluded_regions.npy` again: doing so silently removes four unrelated regions and
  changes the analysis to 61 regions and 1,830 edges.
- Plot upper-triangle edges, not one point per region, and label the axes accordingly.
- Treat the unweighted OLS fit as descriptive; edges sharing nodes are not independent and
  the scatter is heteroscedastic.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
