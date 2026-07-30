# Method details — ns_multi-zebrafish-sc_ca-linregress-degree_coupling

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Sibling-recipe collision](#sibling-recipe-collision)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `DATA_ROOT` | `os.getenv("ZEBRAFISH_PATH", "<data-root>")` | module level | Dead hard-coded default. Set the env var explicitly. |
| SC variant | `SC_matrix_undirected_terminals_expanded.npy` | load | Symmetric; row sums are true weighted degrees. |
| FC variant | `Figure1_FC_matrix.npy` (group average) | load | Degree of the mean network, not the mean of per-larva degrees. |
| `allow_pickle` | `True` on all three loads, then `.astype(float)` on SC and FC | load | Not required by these arrays; harmless. |
| existence guards | `os.path.exists(...)` → `raise FileNotFoundError` on all three inputs | load | Fail-fast with the full path. Worth preserving when adapting. |
| exclusion bounds check | absent (base) / `excluded_regions[excluded_regions < sc_matrix.shape[0]]` (refine) | filtering | No-op on this data; guards against an out-of-range list. |
| FC re-filter branch | `if fc_matrix.shape[0] == sc_matrix.shape[0]` | filtering | Skipped here — FC arrives at 65. |
| shape assert | `sc_filtered.shape == fc_filtered.shape` | filtering | The only guard against a misaligned regression. Base also asserts 2-D and square. |
| diagonal | `np.fill_diagonal(sc, 0.0)` and `np.fill_diagonal(fc, 0.0)` | degrees | FC's unit diagonal would add a constant 1 to every degree. SC's is already zero. |
| SC degree | `np.sum(sc_filtered, axis=1)` | degrees | |
| FC NaN policy | `np.nan_to_num(fc, nan=0.0, posinf=0.0, neginf=0.0)` | degrees | Recorded NaN count is 0, so inert here. |
| FC degree | `np.sum(np.maximum(fc_clean, 0.0), axis=1)` | degrees | **Rectified.** Negative correlations are zeroed, not absolute-valued. This is the difference from the sibling atlas-map recipe. |
| validation asserts | equal shapes; no NaN, no Inf in either degree vector | degrees | Reference implementation only; the figure-oriented implementation keeps only the shape assert. |
| correlation | `scipy.stats.pearsonr(sc_degree, fc_degree)` | statistics | Symmetric in its arguments. |
| regression | `scipy.stats.linregress(sc_degree, fc_degree)` | statistics | **Asymmetric**: OLS of FC on SC. Swapping the arguments yields a different slope (0.605 → r²/0.605). |
| R² | `regression_result.rvalue ** 2` | statistics | Equals `pearson_r ** 2` for simple OLS — 0.6940² = 0.4816. Not an independent quantity. |
| scatter | `s=20`, `color='black'`, `edgecolors='none'`, `alpha=0.6` (base) / no alpha (refine) | figure | |
| fit line | `mediumvioletred`, `linewidth=2.5`, `np.linspace(sc.min(), sc.max(), 200)` | figure | Drawn only over the observed x-range; no extrapolation. |
| r annotation | axes coords `(0.05, 0.95)`, `va='top'`, `ha='left'`, fontsize 11 with a rounded white `bbox` (base) / fontsize 12, no bbox (refine) | figure | |
| spines | top and right hidden | figure | |
| axis labels | `Structural degree` (x), `Functional degree` (y) | figure | |
| `figsize`, `dpi` | `(5, 4)`, `300` | figure | `bbox_inches='tight'` on save. |

## Statistical approach

**Weighted degree.** The row sum of a weighted adjacency matrix — total connection strength per
region. Two decisions make the FC version non-obvious, and both are made explicitly in the code:
zero the diagonal (the unit self-correlation is not a connection), and rectify at zero.

**Rectification is a modelling choice.** `np.maximum(fc, 0)` discards anticorrelations entirely,
so a region strongly anticorrelated with the rest of the brain is scored as weakly coupled
rather than strongly coupled. The alternative — `abs`, used by
`ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map` — treats anticorrelation as coupling of
opposite sign but equal magnitude. Neither is wrong; they answer different questions. The choice
shifts the FC degree minimum from 9.162 (abs) to 8.704 (rectified) in this dataset, which is
small but real. State which one you used.

**Pearson correlation.** Tests the linear association between two 65-element vectors,
p = 1.456e-10 against the null of zero correlation with 63 degrees of freedom. That p value
assumes the 65 regions are independent observations, which they are not — neighbouring brain
regions have correlated degrees, and the atlas parcellation is nested and spatially smooth. The
effective degrees of freedom are fewer than 63, so p is optimistic. A spatial-permutation (spin)
null would be the rigorous test; this recipe does not perform one. The correlation's *magnitude*
(0.69) is the trustworthy result.

**Linear regression.** OLS of FC degree on SC degree, giving slope 0.6054 and intercept 8.0080 —
i.e. a region with zero structural degree is still predicted to carry a functional degree of
about 8, which is the indirect/common-input floor also visible in
`ns_multi-zebrafish-sc_ca-anova-directionality_effect` (unconnected pairs still average
FC ≈ 0.24). The regression is asymmetric by construction; reporting the slope as a symmetric
"coupling coefficient" would be wrong.

**R² = 0.4816.** For simple two-variable OLS this is exactly `pearson_r²`, not new information.
It is an in-sample fit on non-independent observations, so it describes shared variance, not
predictive accuracy. "Structural connectivity accounts for approximately 48% of the variance in
functional connectivity strength" (the stated requirement's phrasing) is defensible as a descriptive claim
and should not be upgraded to a prediction claim.

## Recorded statistics (`statistics.json`)

Verbatim, from the source run. This is the **refine** script's 7-key dict:

```json
{
  "n_regions": 65,
  "n_excluded_regions": 5,
  "pearson_r": 0.6940031410035106,
  "pearson_p": 1.455940080868987e-10,
  "regression_slope": 0.6054340322993742,
  "regression_intercept": 8.008036998532994,
  "regression_r_squared": 0.48164035972273844
}
```

The **base** script writes a 22-key dict adding `excluded_regions` (the list itself),
`fc_nan_count_original`, `regression_std_err`, and a full distribution summary for each degree
vector (`mean`, `std`, `median`, `min`, `max`, 25th and 75th percentiles). Those were overwritten
when the figure-oriented implementation run executed. Recoverable numbers from `exec.log`:

- `SC degree shape: (65,), min: 4.069, max: 45.101`
- `FC matrix NaN count: 0, replaced with 0`
- `FC degree shape: (65,), min: 8.704, max: 36.202`
- `Pearson correlation: r=0.6940, p=1.4559e-10`
- `Linear regression: slope=0.6054, intercept=8.0080`
- `Linear fit: y = 0.6054x + 8.0080 (R² = 0.4816)`

If you need the quartiles and standard error, run the reference implementation's statistics block.

## Sibling-recipe collision

`ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map` (source `Done-Figure2E-173756`) is a
near-duplicate: same three inputs, same two output filenames, same conceptual quantity, different
figure and a different FC-degree formula.

| | this recipe (2F) | degree_atlas_map (2E) |
|---|---|---|
| FC degree | `sum(max(FC, 0))` | `sum(abs(FC))` |
| SC diagonal | explicitly zeroed | left as-is |
| FC degree min / max | 8.704 / 36.202 | 9.162 / 36.202 |
| SC–FC correlation | 0.694003 | 0.694150 |
| Statistics written by | refine (trimmed) + base (full) | base only; refine writes none |
| Figure | scatter + `linregress` fit line, 5×4 in | atlas XY projection, hemisphere-split scatter, 10×8 in |
| Extra outputs | p, slope, intercept, R², std err | degree quartiles, z-score ranges |

Both write to the same paths in `PROCESS_DATA_DIR`; the last run wins. Choose this recipe when the
deliverable is the regression statistic, the other when it is the anatomical map.

## Scientific conclusion supported

From `conclusions.json`:

> In the zebrafish brain, the weighted node degrees of structural connectivity and functional
> connectivity across 65 regions exhibit a significant positive correlation (Pearson r ≈ 0.69),
> indicating that regions with dense physical wiring tend to serve as functional hubs with strong
> aggregate correlated activity.

The workflow description adds the caveat worth carrying forward: the ~52% unexplained variance is attributed to
non-linear dynamics and indirect polysynaptic pathways not captured by direct structural edges —
which is exactly the gap that
`ns_multi-zebrafish-sc_ca-graph_predictors-fc_variance_explained` goes on to probe with 40
higher-order graph predictors.

## Figure specification

Small landscape figure, 5×4 in at 300 dpi, single axes.

Scatter: 65 black points, `s=20`, no marker edges. X is structural weighted degree, y is
functional weighted degree.

Fit line: the `linregress` line evaluated at 200 points spanning `sc_degree.min()` to
`sc_degree.max()`, drawn in `mediumvioletred` at `linewidth=2.5`. No confidence band, no
extrapolation beyond the data range.

Axes: `Structural degree` (x), `Functional degree` (y). Top and right spines hidden; left and
bottom retained with default ticks.

Annotation: `r = 0.694` at axes coordinates `(0.05, 0.95)`, top-left aligned — boxed in the reference implementation
version, plain text in the axes-anchored implementation.

The two known rendering failures — gray-looking points from `alpha=0.6`, and the unwanted
bounding box around the r annotation — are recorded in `RECIPE.md` Pitfalls.
