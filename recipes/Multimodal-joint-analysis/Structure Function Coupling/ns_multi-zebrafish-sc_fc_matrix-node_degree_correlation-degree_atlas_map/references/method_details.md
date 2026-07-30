# Method details — ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map

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
| SC variant | `SC_matrix_undirected_terminals_expanded.npy` | load | Symmetric connectome; row sums are true weighted degrees. |
| FC variant | `Figure1_FC_matrix.npy` (group average) | load | Degree of the mean network, not the mean of per-larva degrees. |
| SC degree | `np.sum(SC_filtered, axis=1)` | STEP 2 | Diagonal not zeroed. Safe only because the SC diagonal is already 0. |
| FC diagonal | `np.fill_diagonal(FC_copy, 0.0)` | STEP 2 | Removes the unit self-correlation, which would otherwise add exactly 1 to every region's degree. |
| FC degree | `np.sum(np.abs(FC_zero_diag), axis=1)` | STEP 2 | **Absolute value.** Anticorrelations count as coupling strength. Differs from the sibling recipe; see "Sibling-recipe collision". |
| NaN handling | `np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)` (base); `np.nan_to_num(x)` (refine) | STEP 2 | Same effect for finite-input data. |
| centroid source | `atlas.regionCentroids['left'|'right']` | STEP 3 | **Not** `atlas.centroids`. Both exist; they are different arrays. |
| y-flip | `centroids[:, 1] = 974 - centroids[:, 1]` | STEP 3 | Hard-coded projection height. Not derived from `xy_projection.shape[0]`. |
| bilateral mask | `mask[excl] = False`, `mask[70 + excl] = False` | STEP 3 | Removes each excluded region from both hemispheres. |
| centroid count assert | `== 130` | STEP 3, base only | Guards the 65/65 split. |
| hemisphere split | `[:65]` left, `[65:]` right | STEP 3 | Post-filter index, not 70. |
| z-score | `(x - mean) / (std + 1e-10)` (base); `scipy.stats.zscore(x)` (refine) | STEP 4 | Population σ (ddof=0) either way. The `1e-10` guard is inert for these data. |
| z-score sanity asserts | `|mean| < 0.5`, `|std - 1| < 0.5` | STEP 4, base only | Deliberately loose; they catch a catastrophic mis-scale, nothing subtler. |
| background `cmap` | `'binary'` | STEP 5 | Grayscale atlas projection. |
| background `aspect` | `'equal'` | STEP 5 | Keeps anatomy undistorted. |
| marker `cmap` | `plt.cm.Blues_r` | STEP 5 | Inverted Blues: **white = high degree**, dark blue = low. Confirmed intentional in the figure review, though it inverts the usual heat convention. |
| `vmin`, `vmax` | `-3`, `2` | STEP 5 | Asymmetric. Observed z-ranges are SC `[-3.250, 1.837]` and FC `[-2.461, 1.406]`, so the low tail clips at one region and the top of the scale is never reached. |
| marker size `s` | `55` | STEP 5 | |
| marker `edgecolors` | `'black'` | STEP 5 | |
| edge `linewidths` | `0.5` in the reference implementation) / `1.0` in the recommended implementation | STEP 5 | |
| `zorder` | `10` (base only) | STEP 5 | Forces markers above the `imshow` background. |
| label position | `(fig_width*0.25, fig_height*0.95)` data coords (base) / `(0.25, -0.05)` axes coords (refine) | STEP 5 | The figure-oriented implementation form is the fix; see "Base vs refine". |
| label style | fontsize 14, bold, black, `ha='center'`, `va='top'` | STEP 5 | |
| colorbar axes | `[0.05, 0.3, 0.02, 0.4]` in the reference implementation) / `[0.05, 0.35, 0.02, 0.3]` in the recommended implementation | STEP 5 | `fig.add_axes` on the far left, deliberately off the anatomy. |
| colorbar | mapped from the **left/SC** scatter, label `Weighted degree`, rotation 90, labelpad 10, fontsize 12, `set_ticks([])` | STEP 5 | Ticks removed as specified. Because both scatters share `vmin`/`vmax`, one colorbar legitimately serves both. |
| `figsize`, `dpi` | `(10, 8)`, `300` | STEP 5 | `bbox_inches='tight'` on save. |

## Statistical approach

**Weighted degree.** The row sum of a weighted adjacency matrix — the total connection strength
each region carries. For the symmetric SC matrix this is unambiguous. For FC it requires two
decisions, both made explicitly here: zero the diagonal (the unit self-correlation is not a
connection), and take absolute values (so an anticorrelated pair contributes to coupling
strength rather than cancelling a positive edge).

**Z-scoring.** Applied independently to each vector, population σ. Necessary because SC weights
are terminal counts (arbitrary units, mean ≈ 30 here by coincidence) and FC weights are summed
correlations (bounded, mean ≈ 26). Without normalization one colour scale cannot serve both
hemispheres. Note that z-scoring is monotone, so the *spatial pattern* and the SC–FC correlation
are unaffected by it — it only makes the two colour mappings comparable.

**Correlation.** `np.corrcoef(SC_degree, FC_degree)[0, 1]` on the **raw** (not z-scored) degrees,
r = 0.6941. Pearson r is scale-invariant so z-scoring first would give the same number. There is
no significance test in this script; the sibling `linregress-degree_coupling` recipe computes
p = 1.46e-10 for the equivalent quantity.

**No spatial statistics.** Regions are treated as 65 independent observations. Neighbouring
brain regions have correlated degrees, so the effective degrees of freedom are fewer than 63 —
a spin/spatial-permutation test (as used in
`ns_multi-zebrafish-ca_behav-spatial_permutation-functional_atlas_map`) would be the rigorous
way to test the anatomical correspondence claim. This recipe makes a descriptive claim only.

## Recorded statistics (`statistics.json`)

Verbatim, from the source run. Written by the **base** script; the figure-oriented implementation writes no
statistics at all.

```json
{
  "n_regions_original_SC": 70,
  "n_regions_original_FC": 65,
  "n_excluded_regions": 5,
  "n_regions_after_filtering": 65,
  "n_left_hemisphere_regions": 65,
  "n_right_hemisphere_regions": 65,
  "SC_degree_mean": 30.28036263152935,
  "SC_degree_std": 8.066031321011765,
  "SC_degree_median": 30.63053934269039,
  "SC_degree_min": 4.069355156581271,
  "SC_degree_max": 45.10070616196605,
  "SC_degree_25th_percentile": 26.028673629774037,
  "SC_degree_75th_percentile": 35.05451816594774,
  "FC_degree_mean": 26.370809389889466,
  "FC_degree_std": 6.99360704292885,
  "FC_degree_median": 27.416067904391983,
  "FC_degree_min": 9.161520280438227,
  "FC_degree_max": 36.20166340765178,
  "FC_degree_25th_percentile": 21.381497755346274,
  "FC_degree_75th_percentile": 32.57487467923871,
  "SC_degree_zscore_mean": 9.223391281501301e-17,
  "SC_degree_zscore_std": 0.9999999999876024,
  "FC_degree_zscore_mean": 2.781428933327736e-16,
  "FC_degree_zscore_std": 0.9999999999857012,
  "correlation_SC_FC_degree": 0.6941499985858877
}
```

Printed by the run but not stored (`exec.log`):

- `SC degree z-score range: [-3.250, 1.837]`
- `FC degree z-score range: [-2.461, 1.406]`
- `Total centroids after filtering: 130`

## Sibling-recipe collision

`ns_multi-zebrafish-sc_ca-linregress-degree_coupling` (source `Done-Figure2F-185422`) is a
near-duplicate run: same inputs, same two output filenames, same conceptual quantity, different
figure. It differs numerically in one place:

| | this recipe (2E) | degree_coupling (2F) |
|---|---|---|
| FC degree formula | `sum(abs(FC))` | `sum(max(FC, 0))` |
| FC diagonal | zeroed | zeroed |
| SC diagonal | left as-is | explicitly zeroed |
| FC degree min | 9.161520 | 8.704 |
| FC degree max | 36.20166 | 36.202 |
| SC degree range | [4.069, 45.101] | [4.069, 45.101] |
| SC–FC correlation | 0.694150 | 0.694003 |
| Figure | atlas projection, hemisphere-split colouring | scatter with linregress fit line |
| Extra statistics | full degree distribution summary | Pearson p, slope, intercept, R² |

The differing FC minima are direct evidence that the group-average FC matrix contains negative
entries. Both `.npy` files carry the same names in the same directory, so the last run wins.
Decide which definition you want before running either, and record the choice.

Choose this recipe when the deliverable is anatomical. Choose `degree_coupling` when the
deliverable is the regression statistic.

## Scientific conclusion supported

From `conclusions.json`:

> The spatial projection of z-scored node degrees across 65 zebrafish brain regions reveals a
> congruent distribution where structural connectivity hubs (visualized on the left hemisphere)
> align with functional connectivity hubs (visualized on the right hemisphere), statistically
> corroborated by a strong positive correlation (r ≈ 0.69) between the weighted degrees of the
> two modalities.

## Figure specification

Single-axes landscape figure, 10×8 in at 300 dpi.

Background: the atlas `XYprojection` (dorsal view) drawn with `imshow(cmap='binary',
aspect='equal')`, axes turned off entirely.

Overlay: two scatter layers on the same axes, both `Blues_r`, `vmin=-3`, `vmax=2`, `s=55`, black
marker edges. The 65 filtered left-hemisphere centroids are coloured by z-scored **SC** degree;
the 65 filtered right-hemisphere centroids by z-scored **FC** degree. Because the atlas
projection shows both hemispheres in one image, the figure reads as one brain whose left half
is annotated structurally and right half functionally.

Annotations: bold 14-pt "Structural" centred under the left half and "Functional" under the
right.

Colorbar: a manual `fig.add_axes` strip on the far left, vertical, tickless, labelled `Weighted
degree` (rotated 90°, labelpad 10, fontsize 12), taken from the left/SC scatter's mappable. It
sits outside the image so it never occludes anatomy — an explicit requirement of the original
specification.
