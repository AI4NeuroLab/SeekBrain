# Method details — ns_vis-zebrafish-ca_atlas-edge_projection-fc_network_map

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusions supported](#scientific-conclusions-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `TOP_VIEW_Y_MAX` | `974` | `centroids_full[:, 1] = 974 - centroids_full[:, 1]` | Atlas y extent used to flip centroids into image orientation. Applied once, in place, to all 140 rows before exclusion. A wrong value translates every node off the anatomy. |
| `SIDE_VIEW_Z_MAX` | `359` | `centroids_side[:, 0] = 359 - centroids_side[:, 0]` | Depth inversion for the sagittal panel, matched to the `k=3` rotation of the background. Also the side-view x upper limit. |
| bilateral construction | `np.tile(fc_matrix, (2, 2))` | Edge weights | Replicates the 65×65 matrix into all four blocks → 130×130. Imposes bilateral symmetry; see "Statistical approach". |
| exclusion bounds check | `excluded_regions[excluded_regions < num_regions_per_hemisphere]` | Centroid filtering | Prevents an out-of-range index from being offset into the opposite hemisphere. |
| `num_regions_per_hemisphere` | `centroids_left.shape[0]` = 70 | Bilateral offset | Derived, not hard-coded. Note this is 70 while the post-exclusion offset is 65. |
| edge validity filter | `not np.isnan(w) and w != 0` | Edge enumeration | Drops the 65 homotopic pairs whose tiled weight is the FC diagonal. |
| edge threshold | `np.percentile(weights, 25)` = 0.25390972 | Edge filtering | Bottom quartile hidden. Computed over the 8320 kept edges, not the full matrix. Display only. |
| edge sort | `edges_filtered.sort(key=lambda x: x[2])` | Draw order | Ascending, so `LineCollection` renders strong edges last and they sit on top. |
| edge `cmap` | `'Reds'` | `LineCollection` | Matches the FC heatmap in `ns_ana-zebrafish-ca-pearson-fc_matrix`. |
| edge `clim` | `(0.2, 0.9)` | `lc.set_clim(0.2, 0.9)` | Same limits as the heatmap, so the two figures are directly comparable. Values outside clip. |
| edge `linewidths` | `0.5` | | |
| edge `alpha` | `0.7` | | |
| edge `zorder` | `1` | | |
| node `color` / `edgecolor` | `'white'` / `'black'` | `scatter` | |
| node `s` | `10` | | |
| node `linewidths` | `0.5` | | |
| node `zorder` | `10` | | Keeps nodes visible above the edge bundle. |
| background `cmap` | `'binary'` | both `imshow` calls | |
| background `aspect` | `'equal'` | both | |
| side rotation | `np.rot90(atlas.XZprojection, k=3)` | side background | `k=3` = 90° clockwise. |
| top panel axes | `[0.05, 0.1, 0.54, 0.8]` | `fig.add_axes` | ≈ 60 % width. Explicit axes, not `gridspec`. |
| side panel axes | `[0.62, 0.1, 0.36, 0.8]` | `fig.add_axes` | ≈ 40 % width, matched height. |
| top `xlim` / `ylim` | `[65, 505]` / `[850, 50]` | | y inverted: anterior up. |
| side `xlim` / `ylim` | `[40, 359]` / `[850, 50]` | | Vertical extent matched to the top panel. |
| panel labels | `'Top'` at `(0.05, 0.95)` axes-fraction, `'Side'` at `(0.95, 0.95)` | `ax.text(..., transform=ax.transAxes)` | fontsize 14, bold, black |
| `figsize` | `(8, 6)` | | |
| `dpi` | `300` | `savefig(..., bbox_inches='tight')` | |

## Statistical approach

**No statistics are computed.** This is an `ns_vis` recipe: it renders an already-computed
matrix. The `statistics.json` it writes is a record of the drawing — node counts, edge counts,
quantiles of the weights it plotted, and the spatial spread of the centroids. Nothing in it is
a new measurement, and nothing downstream consumes it.

**The bilateral tiling is a modelling assumption, and the strongest one in this recipe.**
`Figure1_FC_matrix.npy` is hemisphere-collapsed: region `r` pools neurons from both sides.
There is therefore no measured left-versus-right connectivity anywhere in the input.
`np.tile(fc, (2, 2))` fills the left–right and right–left blocks with copies of the
intra-hemispheric block, so:

- every inter-hemispheric edge drawn is a duplicate of an intra-hemispheric one;
- the figure is bilaterally symmetric by construction;
- each off-diagonal FC entry is drawn four times (left–left, left–right, right–left,
  right–right), which is why `2080 × 4 = 8320` and why the plotted edge mean equals the
  matrix's off-diagonal mean exactly.

This is a legitimate way to lay a collapsed matrix onto bilateral anatomy for display, but it
means the figure carries no inter-hemispheric information. The workflow description's discussion draws exactly
that unsupported inference; see Pitfalls in `RECIPE.md`.

**The homotopic edges vanish as a side effect.** The `(i, i + 65)` pairs take their weight from
`fc_matrix[i, i]`, which is NaN or zero in the stored artifact, so the validity filter removes
all 65 of them. The figure never draws a left-to-right homolog connection. Given the previous
paragraph that is the correct outcome — a homotopic edge would have carried the meaningless
diagonal value — but it is accidental, not intended.

**The 25th-percentile threshold is a legibility device, not a significance test.** 8320 edges
over a brain outline is an unreadable wash. Removing the bottom quartile leaves the backbone.
No null model, no correction, no claim that the surviving edges are individually reliable. Do
not describe the displayed edges as "significant".

**Negative weights are not distinguished.** The minimum edge is −0.164 and `clim` starts at
0.2, so anticorrelated pairs render identically to weakly positive ones. Most are removed by
the quartile cut, but not all of them necessarily, and the colormap conveys no sign.

## Recorded statistics (`statistics.json`)

Verbatim from the reference implementation:

```json
{
  "n_regions_original": 140,
  "n_regions_excluded": 10,
  "n_regions_per_hemisphere": 70,
  "n_regions_filtered": 130,
  "fc_matrix_shape_original": [65, 65],
  "fc_matrix_shape_bilateral": [130, 130],
  "fc_matrix_shape_filtered": [130, 130],
  "n_edges_total": 8320,
  "n_edges_above_25th_percentile": 6240,
  "edge_weight_statistics": {
    "min": -0.16428599979999012,
    "max": 0.9308013740304351,
    "mean": 0.4111060734713239,
    "median": 0.3942720914707972,
    "percentile_25": 0.25390972391295374,
    "percentile_75": 0.5632451412375769
  },
  "spatial_extent": {
    "top_view_x_range": [65, 505],
    "top_view_y_range": [50, 850],
    "side_view_x_range": [40, 359],
    "side_view_y_range": [50, 850]
  },
  "centroid_statistics": {
    "x_mean": 290.15293941779794,
    "x_std": 75.8949710808975,
    "y_mean": 463.675375428352,
    "y_std": 167.60228889898252,
    "z_mean": 149.18031403763402,
    "z_std": 62.50776572019582
  },
  "network_summary": {
    "description": "Functional connectivity network visualized on zebrafish brain atlas",
    "edges_displayed": "Top 75% by connection strength",
    "colormap": "Reds",
    "colormap_range": [0.2, 0.9]
  }
}
```

Corroborated by `exec.log`:

```
Loaded FC matrix with shape: (65, 65)
Loaded 5 excluded regions: [10 34 44 49 69]
Regions per hemisphere: 70
Full centroids shape: (140, 3)
Bilateral FC matrix shape: (130, 130)
Filtered centroids shape: (130, 3)
Total edges (upper triangle, non-zero): 8320
Edges after 25th percentile filter: 6240
```

Three cross-checks worth keeping as regression tests:

- `6240 / 8320 = 0.75` exactly — the quartile filter behaved.
- `8385 − 8320 = 65` — the number of homotopic pairs dropped, and the evidence that the FC
  diagonal is non-finite or zero.
- `mean = 0.4111060734713239` matches `fc_lower_triangle_mean = 0.41110607347132383` from
  `ns_ana-zebrafish-ca-pearson-fc_matrix`. Tiling replicates each off-diagonal entry exactly
  four times, so the mean must be preserved. A mismatch means the wrong matrix was loaded.
- `n_regions_filtered` (130) and `fc_matrix_shape_bilateral[0]` (130) are the two sides of the
  script's one assert.

`centroid_statistics.y_mean` reflects the *flipped* y (`974 − y`); `z_mean` reflects the
*un*-inverted z.

## Scientific conclusions supported

From `conclusions.json`:

> The group-averaged functional connectivity network in the zebrafish brain exhibits robust
> global integration, characterized by a mean correlation coefficient of 0.41, with 75% of
> inter-regional connections displaying moderate-to-strong positive coupling (correlation
> strengths > 0.25).

> The functional network topology manifests as a spatially extensive and dense web of
> connections that spans the entire anterior-posterior and dorso-ventral axes of the brain,
> indicating that strong functional coupling connects widely distributed anatomical regions.

Both are supportable from the figure. The workflow description's further claim about inter-hemispheric
coordination is not — it follows from the tiling, not from the data.

## Figure specification

Two-panel figure, 8 × 6 in, laid out with explicit `fig.add_axes` rather than `gridspec`.

**Left panel — Top (horizontal / XY), `[0.05, 0.1, 0.54, 0.8]`, ≈ 60 % width.**
Background: `imshow(atlas.XYprojection, cmap='binary', aspect='equal')`.
Edges: a `LineCollection` of segments between `centroids_filtered[:, [0, 1]]` node pairs,
`array=edge_weights`, `cmap='Reds'`, `set_clim(0.2, 0.9)`, `linewidths=0.5`, `alpha=0.7`,
`zorder=1`, drawn in ascending weight order.
Nodes: `scatter(x, y, color='white', edgecolor='black', s=10, linewidths=0.5, zorder=10)`.
Limits x `[65, 505]`, y `[850, 50]`. `axis('off')`.
Annotation: `'Top'` at axes-fraction `(0.05, 0.95)`, fontsize 14, bold, `va='top'`,
`ha='left'`.

**Right panel — Side (sagittal / XZ), `[0.62, 0.1, 0.36, 0.8]`, ≈ 40 % width.**
Background: `imshow(np.rot90(atlas.XZprojection, k=3), cmap='binary', aspect='equal')`.
Coordinates: `centroids_filtered[:, [2, 1]].copy()` with column 0 replaced by `359 - z`.
Edges and nodes: the **same edge list** and identical visual parameters as the top panel.
Limits x `[40, 359]`, y `[850, 50]`. `axis('off')`.
Annotation: `'Side'` at axes-fraction `(0.95, 0.95)`, fontsize 14, bold, `va='top'`,
`ha='right'`.

No colorbar, no legend, no title. Saved to `$SAVE_DIR/figure.png` at 300 dpi with
`bbox_inches='tight'`.
