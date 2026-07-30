# Method details — ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `n_components` | `10` | `PCA(n_components=10)` | Only PC1 is used downstream. Fitting 10 keeps this identical to Figure 2J's PCA, so the explained-variance arrays match exactly. |
| PCA output | `fit_transform(...)` | `pca_result = pca.fit_transform(model.predictors)` | Component **scores** (4225, 10), one row per region pair — not loadings. `PC1 = pca_result[:, 0]`. |
| `directed` | `True` | `model.compute_predictors(directed=True)` | Directed-SC feature set, 40 columns. |
| centroid member | `.regionCentroids` | `MapzebrainAtlas` | Not `.centroids`. |
| hemisphere combination | `0.5 * (left + right)` | centroid averaging | Midline collapse of bilateral pairs. |
| distance metric | `'euclidean'` | `pdist` | Straight-line centroid distance. |
| distance diagonal | `0.0` | `np.fill_diagonal` | |
| PC1 reshape | `(65, 65)` | `PC1.reshape(n_regions, n_regions)` | Valid only because predictor rows are the C-order flattened 65×65 grid. |
| PC1 diagonal | `0.0` | `np.fill_diagonal(PC1_matrix, 0.0)` | Removes self-pairs before correlating. |
| triangle | `np.triu_indices(65, k=1)` | edge extraction | 2080 unique pairs. `k=1` excludes the diagonal. |
| NaN handling | `np.isfinite(PC1_upper) & np.isfinite(FC_upper)` | `valid_mask` | Both scripts mask jointly. On this analysis nothing was dropped — 2080 edges in, 2080 correlated. |
| sign alignment | `PC1_matrix *= np.sign(corr_coef)` | orientation | A PCA component's sign is arbitrary; this pins it. Was a no-op here (r already positive). |
| assertion | `corr_coef_final >= 0` | reference implementation only | The figure-oriented implementation drops this check. |
| normalisation | min-max per matrix | `normalize_matrix` | Display only. Applied separately to PC1 and FC because they are on incomparable scales. |
| composite layout | lower = PC1 (`tril_indices(n, k=-1)`), upper = FC (`triu_indices(n, k=1)`) | display | Diagonal left at 0 and then covered by the white line. |
| `cmap` | `'Blues_r'` | `imshow` | Reversed Blues: high normalised weight is dark. |
| `aspect` | `'equal'` | `imshow` | |
| `origin` | `'upper'` | `imshow` | Row 0 at the top. |
| diagonal line | white, `linewidth=5`, `solid_capstyle='butt'` | `ax.plot` | Base endpoints `[0, n-1]`; refine endpoints `[-0.5, n-0.5]`. |
| colorbar | `fraction=0.046`, `pad=0.04`, label rotated 270°, `labelpad=20`, `set_ticks([])` | display | Labelled `Normalized weight`, deliberately tickless. |
| y-ticks | `[0, n-1]` labelled `['1', '65']` | display | First and last region only; x-ticks removed entirely. |
| `figsize` | `(6, 5.5)` | `plt.subplots(..., dpi=300)` | |
| `dpi` | `300` | figure and `savefig` | |
| `bbox_inches` | `'tight'` | `savefig` | |

No random seed. PCA at this size uses a deterministic full SVD, so the run is reproducible
without one.

## Statistical approach

**Feature construction.** Identical to Figure 2J: `Predictors(directed, undirected, distance)`
then `compute_predictors(directed=True)`, giving (4225, 40). This run recorded no column labels,
so the identities of the 40 columns cannot be recovered from its artifacts; the stated requirement's guess
that they include path lengths, communicability and direct edge weights is inference, not
documentation. The vendored `scripts/zebrafish_Ca_utils_predictors_xps.py` is the authoritative
definition if you need to settle what the columns actually are.

**PCA.** Unstandardised — `sklearn.decomposition.PCA` mean-centres but does not scale. With
40 columns on incommensurate units, PC1 is weighted toward the largest-raw-variance features.
The 64.9% figure and the resulting PC1 vector are properties of this particular unscaled
feature space. See `ns_feat-zebrafish-sc-pca-predictor_dimensionality` for the full discussion.

**Sign alignment.** PCA components are defined up to sign. The script computes r against FC,
multiplies PC1 by `np.sign(r)`, and recomputes. This makes the saved artifact and every
downstream figure orientation-stable across reruns. It is also a mild circularity: the
orientation of the predictor is chosen using the very outcome it is then correlated against.
The magnitude of r is unaffected — only its sign could have flipped — so the stated requiremented r ≈ 0.68
is not inflated by this step, but a strict reader should note that "positive correlation" is
partly a convention here rather than a finding.

**Correlation.** Pearson r over the 2080 upper-triangle entries, `k=1`, diagonal excluded.
Edges are treated as independent observations. They are not — connectivity edges sharing a
node are correlated, and both matrices carry strong distance dependence — so the p-value
(8.5e-285) is severely anticonservative and should be read as "not remotely attributable to
chance" rather than as a calibrated probability. No spatial-autocorrelation-preserving null
model is used. `ns_multi-zebrafish-ca_behav-spatial_permutation-functional_atlas_map` is the
recipe in this set that does handle that concern.

**Symmetry.** The upper triangle of a non-symmetric PC1 matrix is correlated against the upper
triangle of a symmetric FC matrix. For each unordered pair {i, j} the analysis therefore uses
the i→j direction only. Using the lower triangle would give a different (though likely similar)
r. This choice is undocumented in the source run.

## Recorded statistics (`statistics.json`)

Verbatim, as stored — this is the **refine** script's output:

```json
{
  "pearson_r": 0.6821153902723572,
  "pearson_p_value": 8.533757589388221e-285
}
```

The **base** script writes a much larger dict that is not preserved on disk:
`n_regions_after_exclusion`, `n_excluded_regions`, `n_edges_analyzed`, `pearson_r`,
`pearson_p_value`, `PC1_mean`/`_std`/`_median`/`_min`/`_max`, `FC_mean`/`_std`/`_median`/
`_min`/`_max`, `pca_explained_variance_PC1`, `pca_explained_variance_total_10PCs`. Re-run the
reference implementation if those are needed.

The run log records what the output file omits:

```
Loaded FC matrix: (65, 65)
Loaded directed SC matrix: (70, 70)
Loaded undirected SC matrix: (70, 70)
Loaded excluded regions: 5 regions -> [10 34 44 49 69]
Computed distance matrix: (70, 70)
After exclusion - FC: (65, 65), SC_dir: (65, 65), SC_und: (65, 65), Dist: (65, 65)
Computed predictors shape: (4225, 40)
PCA result shape: (4225, 10)
Explained variance ratio: [0.64893397 0.11053862 0.07786178 0.05530548 0.0321208
                           0.02230627 0.01235524 0.00996695 0.00809141 0.00572531]
Initial correlation: r=0.6821, p=8.5338e-285
Final correlation after sign adjustment: r=0.6821, p=8.5338e-285
Number of edges: 2080
```

Two things to take from that log. The explained-variance array is bit-identical to Figure 2J's
`statistics.json`, confirming both runs saw the same predictor matrix. And the initial and
final correlations are equal, so the sign flip did nothing on this data.

**Regions: 65, not 215.** The workflow description's Results section and the first entry in
`conclusions.json` both say 215 brain regions. The code, the log and the shapes all say 65
(2080 edges). The workflow description is wrong. The same paragraph's claim about "off-diagonal clusters
between region indices 50-100 and 150-200" describes indices that cannot exist in a 65×65
matrix and should be discarded entirely.

## Scientific conclusion supported

From `conclusions.json`, with the region count corrected:

> Across [65 — the file says 215, which is wrong] zebrafish brain regions, the first principal
> component (PC1) of structural predictors (derived from structural connectivity and
> inter-regional distances) exhibits a strong and statistically significant positive
> correlation (Pearson r ≈ 0.68, p < 1e-284) with the functional connectivity (FC) matrix.

> The spatial distribution of normalized weights in the structural PC1 matrix aligns
> symmetrically with the modular block patterns and off-diagonal clusters observed in the
> functional connectivity matrix, suggesting that aggregate structural properties effectively
> predict the topological organization of functional networks.

The second conclusion is a visual claim about the composite figure and is not backed by any
statistic for the recorded dataset.

## Figure specification

Single axes, 6 × 5.5 in at 300 dpi. A composite 65×65 matrix: the lower triangle
(`tril_indices(n, k=-1)`) holds the independently min-max normalised structural PC1, the upper
triangle (`triu_indices(n, k=1)`) holds the independently min-max normalised FC. Rendered with
`imshow`, `cmap='Blues_r'`, `aspect='equal'`, `origin='upper'`. Normalising the two halves
separately is required — they are on incomparable scales and a shared range would flatten one.

A white line of `linewidth=5` and `solid_capstyle='butt'` runs along the main diagonal,
spanning `[-0.5, n-0.5]` so the corner pixels are fully covered, visually separating the two
halves.

Colorbar on the right: `fraction=0.046`, `pad=0.04`, label `Normalized weight` rotated 270°
with `labelpad=20`, and **no ticks** (`set_ticks([])`) — the two halves have different absolute
meanings so numeric ticks would be misleading.

Y-axis: ticks only at positions `[0, n-1]`, labelled `['1', '65']`, axis label `Brain regions`.
X-axis: no ticks at all. Two text labels outside the axes — `Functional connectivity`
right-aligned above the top-right corner, `Structural PC1` left-aligned below the bottom-left
corner — naming which triangle is which.

`tight_layout()`, saved at 300 dpi with `bbox_inches='tight'`.

The known rendering failures were the in-matrix text placement and the short diagonal line;
both are fixed in the figure-oriented implementation.
