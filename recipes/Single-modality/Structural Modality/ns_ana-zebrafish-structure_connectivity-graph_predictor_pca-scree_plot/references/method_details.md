# Method details — ns_feat-zebrafish-sc-pca-predictor_dimensionality

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Output requirements](#output-requirements)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `n_components` | `10` | `PCA(n_components=10)` | Only ten PCs are fit. Caps `cumulative_variance[-1]` below 1.0 by construction. |
| `directed` | `True` | `model.compute_predictors(directed=True)` | Selects the directed-SC feature set. Produces 40 predictor columns. |
| centroid member | `.regionCentroids` | `MapzebrainAtlas` | Not `.centroids`. Different member, different values. |
| hemisphere combination | `0.5 * (left + right)` | centroid averaging | Collapses each bilateral pair to a midline point, matching the 70-region SC indexing. |
| distance metric | `'euclidean'` | `pdist(..., metric='euclidean')` | Straight-line distance between centroids. |
| distance diagonal | `0.0` | `np.fill_diagonal` | Explicitly zeroed; `pdist`/`squareform` already gives 0 but the call is defensive. |
| exclusion applied | once, at 70×70 | keep-mask | 70 → 65 regions. |
| `allow_pickle` | `True` | both `np.load` calls for SC | The SC files were saved as object arrays; `.astype(float)` follows. |
| `figsize` | `(5, 4)` | `plt.subplots` | Display. |
| `xlim` | `(0.5, 10.5)` | axes | Display. |
| `ylim` | `(-0.05, 1.05)` | axes | Display. |
| `linewidth` | `2` | both curves | Display. |
| `markersize` | `6` | both curves, `marker='o'` | Display. |
| ratio colour | `'mediumvioletred'` | ratio curve + PC1 annotation + "Ratio" label | Display. |
| cumulative colour | `'black'` | cumulative curve + "Cumulative" label | Display. |
| PC1 annotation | `(1, pc1_var + 0.03)`, `f"{pc1_var:.3f}"` | text | Display. |
| "Ratio" label y | base `explained_variance_ratio[-2] + 0.02`; refine `explained_variance_ratio[7] + 0.03` | text at x=8.5 | Refine anchors on PC8 rather than PC9. |
| "Cumulative" label y | base `cumulative_variance[-2] - 0.05`; refine `cumulative_variance[7] - 0.06` | text at x=8.5 | Same change. |
| `dpi` | `300` | `savefig` | Save. |
| `bbox_inches` | `'tight'` | `savefig` | Save. |

No random seed appears anywhere. PCA on a fixed matrix is deterministic under the default
(`svd_solver='auto'` → full SVD at this size), so the run is reproducible without one.

## Statistical approach

**Feature construction.** `Predictors(directed_SC, undirected_SC, distance)` followed by
`compute_predictors(directed=True)` yields a (4225, 40) matrix: 65² ordered region pairs by 40
structural predictors. This run did not record the column identities, so nothing in *this
recipe's own artifacts* names them; the report speculates they include degree, path length and
communicability, which is plausible but is the report's inference, not documented fact. Treat
"40 predictors" as the reliable statement and the recorded column identities as unknown. Two
routes settle it: read the vendored `scripts/zebrafish_Ca_utils_predictors_xps.py`, which
defines the battery, or take the `Figure2_SC_predictor_names.npy` written by the sibling recipe
`ns_multi-zebrafish-sc_ca-graph_predictors-fc_variance_explained`.

**PCA.** `sklearn.decomposition.PCA` on the raw predictor matrix. This mean-centres each
column but performs **no variance standardisation**. Because the 40 columns are on
incommensurate scales — Euclidean distance in atlas units alongside edge weights and
dimensionless topological indices — the leading component is weighted toward whichever columns
happen to have the largest raw spread. The headline 64.9% is therefore a statement about this
particular unstandardised feature space, not a scale-invariant measure of topological
redundancy. Re-running with column-wise z-scoring is a legitimate and different analysis; the
source run does not do it.

**Assumptions.** PCA assumes the interesting structure is linear and captured by second
moments. Nothing checks the columns for near-degeneracy or for the heavy-tailed distributions
typical of connectome edge weights. The very fast decay (PC1 ≫ PC2) is consistent with strong
collinearity, which is the intended finding, but is also what an unscaled dominant-variance
column would produce.

**No inference.** No significance test, no null model, no cross-validation. This recipe is
descriptive.

## Recorded statistics (`statistics.json`)

Verbatim from the original run (written by the **base** script; the refine script writes none):

```json
{
  "n_components": 10,
  "explained_variance_ratio": [
    0.6489339663557484,
    0.11053861647320747,
    0.07786178077972238,
    0.05530547680922824,
    0.03212080134318444,
    0.022306272672378964,
    0.012355239300404275,
    0.009966950338423573,
    0.00809140817167006,
    0.005725311573171242
  ],
  "cumulative_variance": [
    0.6489339663557484,
    0.7594725828289559,
    0.8373343636086783,
    0.8926398404179066,
    0.924760641761091,
    0.9470669144334699,
    0.9594221537338742,
    0.9693891040722977,
    0.9774805122439678,
    0.9832058238171391
  ],
  "pc1_variance": 0.6489339663557484,
  "total_variance_10pcs": 0.9832058238171391,
  "predictor_matrix_shape": [4225, 40],
  "n_excluded_regions": 5,
  "n_regions_after_exclusion": 65
}
```

The run log confirms the intermediate shapes: SC directed and undirected both (70, 70),
distance matrix (70, 70), all three (65, 65) after exclusion, predictors (4225, 40).

Note that `Figure2K`'s statistics report the identical `explained_variance_ratio_` — the two
runs perform the same PCA on the same matrix, which is a useful consistency check between
them.

## Implementation requirements

Apply the following implementation requirements (five ways:

1). **Import style.** Refine uses `from zebrafish_Ca_utils_predictors_xps import *`, which the
   original the required configuration explicitly demanded ("Force using this"). The base script used
   `from zebrafish_Ca_utils_predictors_xps import Predictors`. The image critique flagged this
   as a compliance failure.
2. **Curve draw order.** Refine plots the black cumulative curve first and the pink ratio curve
   second. At PC1 both curves take the same value (0.6489), so in the base script the black
   marker completely covered the pink one while the pink `0.649` annotation pointed at it —
   visually contradictory. Drawing the ratio last fixes it.
3. **Label anchoring.** The "Ratio" and "Cumulative" in-plot labels move from index `-2` (PC9)
   to index `7` (PC8), with slightly larger offsets (+0.03 / −0.06 instead of +0.02 / −0.05).
   x-position stays at 8.5, so anchoring on PC8 is closer to where the text sits.
4. **No statistics.** Refine drops `import json` and the whole `statistics.json` block.
5. **Missing-file fallback.** Refine defaults `excluded_regions` to an empty array instead of
   the base script's `np.array([10])`.
6. Progress prints trimmed; output renamed to `figure_refine.png`.

The analysis path — matrices, distances, `Predictors`, `PCA(10)` — is byte-for-byte equivalent,
so both scripts produce the same explained-variance array and the same
`Figure2_SC_predictor_PCA_expvar.npy`.

**Use the refine script for the figure. Use the base script if you need `statistics.json`.**

## Scientific conclusion supported

From `conclusions.json`:

> The principal component analysis of 40 structural connectivity predictors demonstrates that
> the first principal component accounts for 64.9% of the total variance, indicating that a
> single latent factor drives the majority of the structural network variability.

> The cumulative explained variance reaches 98.3% with only the first 10 principal components,
> confirming that the high-dimensional structural predictor space of the zebrafish brain atlas
> can be efficiently condensed into a few informative dimensions.

The report adds that the ratio drops below 1% by PC8 (0.010) — consistent with the stored
array, where PC7 is 0.0124 and PC8 is 0.0100.

## Output requirements

Single axes, 5×4 in. X-axis: principal component index 1–10, ticked at every integer, limits
(0.5, 10.5), labelled `Principal component #` at fontsize 12. Y-axis: `Explained variance`,
fontsize 12, limits (−0.05, 1.05).

Two line-plus-marker curves, both `marker='o'`, `linewidth=2`, `markersize=6`:
- cumulative explained variance in `black` (drawn first),
- per-component explained variance ratio in `mediumvioletred` (drawn second, so its markers
  are on top).

Annotations: PC1's ratio printed as `0.649` in `mediumvioletred` at `(1, ratio[0] + 0.03)`,
centre-aligned, bottom-anchored, fontsize 10. In-plot legends rather than a legend box: the
word `Ratio` in `mediumvioletred` and `Cumulative` in `black`, both at x = 8.5, fontsize 10,
centre-aligned, placed just above the ratio curve and just below the cumulative curve
respectively.

Top and right spines removed. `tight_layout()`, saved at 300 dpi with `bbox_inches='tight'`.

The known rendering failure was the PC1 marker collision described above.
