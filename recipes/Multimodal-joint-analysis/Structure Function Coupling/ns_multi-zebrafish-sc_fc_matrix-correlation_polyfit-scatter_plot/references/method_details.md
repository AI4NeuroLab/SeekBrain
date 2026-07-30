# Method details — ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| exclusion bounds filter | base: `excluded_regions[excluded_regions < num_regions]`; refine: `(excluded_regions >= 0) & (excluded_regions < num_regions)` | preprocessing | Drops index 69. Neither variant prevents the underlying double-exclusion; see below. |
| regions analysed | 61 (from 65) | keep-mask | The bug. Edge count 1830 instead of 2080. |
| diagonal zeroing | `np.fill_diagonal(..., 0.0)` on both matrices | reference implementation only | No effect — `k=1` already excludes the diagonal. Refine drops it. |
| triangle | `np.triu_indices(n, k=1)` | edge extraction | 1830 edges at n=61. One observation per unordered pair, from the i→j direction. |
| finite mask | `np.isfinite(fc_upper) & np.isfinite(pc1_upper)` | cleaning | Joint mask. Dropped nothing on this analysis: 1830 in, 1830 out. |
| minimum sample | base `assert len(fc_values) >= 3`; refine `raise ValueError` if `< 3` | guard | Same threshold, different failure mode. |
| correlation | `scipy.stats.pearsonr(pc1_values, fc_values)` | statistic | Two-sided p-value. |
| regression | `np.polyfit(pc1_values, fc_values, deg=1)` | fit | Unweighted OLS, FC as the response. `coefficients[0]` = slope, `[1]` = intercept. |
| line sampling | `np.linspace(pc1.min(), pc1.max(), 200)` | display | 200 points across the observed PC1 range; no extrapolation. |
| scatter `s` | `5` | `ax.scatter` | Display. |
| scatter `alpha` | `0.3` | `ax.scatter` | Display, but load-bearing — 1830 overlapping points are unreadable opaque. |
| scatter `color` | `'black'`, `edgecolors='none'` | `ax.scatter` | Display. |
| fit line | `'mediumvioletred'`, `linewidth=2` | `ax.plot` | Display. |
| r annotation | `f'r = {pearson_r:.3f}'` at axes `(0.05, 0.95)`, `mediumvioletred`, fontsize 11 | text | Renders as `r = 0.683`. |
| axis labels | `Structural PC1` (x), `FC` (y), fontsize 12 | display | |
| spines | top and right hidden | display | |
| `figsize` | `(5, 4)` | `plt.subplots(..., dpi=300)` | |
| `dpi` | `300` | figure and `savefig` | |
| `bbox_inches` | `'tight'` | `savefig` | |

No random seed anywhere; nothing stochastic. Both scripts are fully deterministic given their
inputs.

## Statistical approach

**Correlation.** Pearson r between the two upper-triangle vectors, 1830 paired observations.
Measures linear association only; a monotone-but-curved relationship would be understated.

**Independence is violated.** Connectome edges are not independent samples — edges sharing a
node covary, and both PC1 and FC carry strong distance dependence, so the effective sample size
is far below 1830. The workflow descriptioned p = 1.4e-251 is therefore anticonservative by orders of
magnitude. Read it as "clearly not chance" and nothing more precise. No spatial-autocorrelation
-preserving null is used here; `ns_multi-zebrafish-ca_behav-spatial_permutation-functional_atlas_map`
is the recipe in this set that does address that.

**Regression.** `np.polyfit(x, y, deg=1)` is ordinary least squares minimising vertical
residuals in FC. It is not symmetric: regressing PC1 on FC would give a different slope, though
the same r. The workflow descriptioned slope 0.0308 is dFC per unit PC1. The intercept 0.4002 is the fitted
FC at PC1 = 0, which is close to the global mean FC of 0.4111 reported by
`ns_ana-zebrafish-ca-pearson-fc_matrix` — expected, since PC1 is mean-centred by PCA, so PC1 = 0
is roughly the average edge.

**Heteroscedasticity.** The scatter is visibly wedge-shaped; no weighting, robust estimator or
residual diagnostic is applied. The line is descriptive.

**R².** Computed as `pearson_r ** 2`, not from the regression residuals. For a simple linear
fit these coincide, so the value is correct, but it inherits the same non-independence caveat.

**The region set is wrong.** All of the above is computed on 61 regions after a double-applied
exclusion mask (see `data_contract.md`). The correct 65-region equivalent is reported by
`ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction` (r = 0.6821, p = 8.5e-285, 2080 edges).

## Recorded statistics (`statistics.json`)

Verbatim, as stored — this is the **refine** script's trimmed output:

```json
{
  "sample_sizes": {
    "n_regions_original": 65,
    "n_regions_filtered": 61,
    "excluded_regions": [
      10,
      34,
      44,
      49,
      69
    ],
    "total_edges_upper_triangle": 1830,
    "valid_edges_after_filtering": 1830
  },
  "correlation_analysis": {
    "pearson_r": 0.6829054774551018,
    "pearson_p_value": 1.3847042366429555e-251,
    "r_squared": 0.4663598911381805
  },
  "linear_regression": {
    "slope": 0.03082002574780239,
    "intercept": 0.40019859908758104,
    "regression_equation": "FC = 0.0308 * PC1 + 0.4002"
  }
}
```

Note `n_regions_original: 65` — that field names the shape of the *input file*, which is
already post-exclusion, not the 70 original atlas regions. And `excluded_regions` records all
five values including 69, even though 69 was bounds-filtered out and never applied.

The reference implementation additionally writes `descriptive_statistics` (mean, std, median, min, max, p25,
p75 for both `fc` and `pc1`) and an `interpretation` block
(`significant_at_alpha_0.05`, `significant_at_alpha_0.01`, `correlation_direction`,
`variance_explained_by_pc1_percent`). Those fields are not on disk; re-run the reference implementation to
recover them.

The run log makes the bug explicit:

```
Loaded FC matrix: (65, 65)
Loaded PC1 matrix: (65, 65)
Loaded excluded regions: [10 34 44 49 69]
Warning: Excluded region indices [69] are out of bounds for matrix size 65
Using only valid excluded regions: [10 34 44 49]
FC matrix after filtering: (61, 61)
PC1 matrix after filtering: (61, 61)
Number of edges (upper triangle): 1830
Pearson r = 0.6829
```

The figure-oriented implementation log is identical apart from the warning wording (`Warning: Ignored 1 invalid
excluded indices.`) — same 61 regions, same 1830 edges, same r.

## Scientific conclusion supported

From `conclusions.json`:

> A significant positive correlation (Pearson r ≈ 0.68) exists between the first principal
> component of structural predictors and functional connectivity strength across brain regions,
> demonstrating that structural network properties collectively contribute to shaping
> functional coupling.

That claim survives the region-set bug — r ≈ 0.68 either way — but the supporting figures
(1830 edges, 61 regions, p = 1.4e-251) belong to the 61-region variant. The correct 65-region
statement is r = 0.6821, p = 8.5e-285 over 2080 edges, from
`ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction`.

The workflow description's Discussion claims `R² ≈ 0.47` means "approximately 47% of the variance in
functional connectivity strength can be explained by the first principal component of
structural predictors". That is the standard reading of R² and is fine as a descriptive
statement, provided it is not taken as a causal or predictive-out-of-sample claim — nothing
here is cross-validated.

## Figure specification

Single axes, 5 × 4 in at 300 dpi.

Scatter of the 1830 upper-triangle edges: structural PC1 on x, FC on y, marker size 5,
`alpha=0.3`, colour black, `edgecolors='none'`. The transparency carries information — at this
overlap an opaque scatter collapses into a solid mass and the density structure disappears.

Best-fit line overlaid in `mediumvioletred`, `linewidth=2`, drawn over 200 points spanning
`[pc1.min(), pc1.max()]` — no extrapolation beyond the observed range.

Axis labels `Structural PC1` (x) and `FC` (y), fontsize 12. Top and right spines hidden.
Pearson r annotated as `r = 0.683` in `mediumvioletred`, fontsize 11, at axes-fraction
coordinates (0.05, 0.95), top-left aligned.

`tight_layout()`, saved at 300 dpi with `bbox_inches='tight'`.

**Caption caveat.** The original task prose says each point is "each brain region"; the numbered
pipeline says upper triangles without the diagonal. The code follows the pipeline, so each
point is an **edge** (region pair), not a region. The figure critique noted the contradiction
and endorsed the code's reading. Any caption should say edges — 1830 of them — or a reader will
expect 61 points.

The only rendering defect found was the output filename; the plot itself was accepted.
