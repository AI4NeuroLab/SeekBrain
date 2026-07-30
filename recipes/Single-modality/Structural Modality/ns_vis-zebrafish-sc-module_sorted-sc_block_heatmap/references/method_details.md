# Method details — ns_vis-zebrafish-sc-module_sorted-sc_block_heatmap

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| element-wise power | `2` | `sc_matrix_filtered ** 2` | Contrast enhancement before display. Weights are in [0, 1], so squaring is monotonic and rank-preserving: it suppresses weak edges toward 0 while leaving near-1 edges almost untouched. Purely a display transform — the stated requiremented `SC²` statistics describe the transformed values, not connectivity strength. |
| sort key | `np.argsort(module_labels_filtered)` | Row/column reordering | Block-diagonalises the matrix. `argsort` is stable, so within a module the original region order survives. |
| `cmap` | `'Purples'` | `imshow` | Sequential light→dark. |
| `aspect` | `'equal'` | `imshow` | Square cells, square figure. The reference implementation additionally calls `ax.set_aspect('equal')` redundantly. |
| `interpolation` | `'nearest'` | `imshow` | Keeps cell edges crisp. The default (`'antialiased'`) would smear colour across module boundaries and blunt the block structure. |
| rectangle `linewidth` | `3` | `plt.Rectangle` | "Thick-edge black boxes" per the figure spec. |
| rectangle `edgecolor` | `'black'` | `plt.Rectangle` | |
| rectangle `facecolor` | `'none'` | `plt.Rectangle` | Outline only — a filled patch would hide the data. |
| rectangle anchor | `(start - 0.5, start - 0.5)` | `plt.Rectangle` | `imshow` puts integer coordinates at pixel *centres*; the −0.5 shifts the box to the pixel *edge* so it encloses the block instead of bisecting its first row and column. |
| rectangle size | `end - start` | `plt.Rectangle` | Module size in cells. |
| colorbar orientation | `'horizontal'` | `plt.colorbar` | |
| colorbar `fraction`, `pad` | `0.046`, `0.08` | `plt.colorbar` | |
| colorbar label | `'SC^2'`, fontsize 12 | `cbar.set_label` | |
| ticks | all cleared | `set_xticks([])`, `set_yticks([])`, `set_xticklabels([])`, `set_yticklabels([])` | |
| `figsize` | `(8, 8)` | `plt.subplots` | |
| `dpi` | `300` | figure creation and `savefig` | |
| `bbox_inches` | `'tight'` | `savefig` | |

No colour limits (`vmin`/`vmax`) are set — the scale runs over the full data range of `SC²`,
which happens to be exactly `[0.0, 1.0]` here because the raw SC weights span `[0, 1]`.

## Statistical approach

There is none in the inferential sense. This recipe is descriptive:

- **Module partition** is not computed here. It is read from
  `ns_seg-zebrafish-sc-consensus_louvain-module_partition`, which derived it by Ward linkage on
  `1 − coassignment_probability` cut at 4 clusters and then renumbered the clusters
  anteroposteriorly.
- **No modularity statistic, no null model, no significance test.** The claim "within-module
  connections are stronger than between-module" is supported visually by the block-diagonal
  appearance, not by a quantitative contrast. If that claim needs backing, compute a
  within-vs-between mean edge weight and test it against a degree-preserving rewiring null —
  neither script does.
- The workflow descriptioned `SC²` distribution is over the whole 65×65 filtered matrix (including the
  diagonal and both triangles of a symmetric matrix), not per block.

### Validation assertions in the reference implementation

1. `sc_matrix_filtered.shape[0] == sc_matrix_filtered.shape[1]` — still square after filtering
2. `sc_matrix_filtered.shape[0] == len(module_labels_filtered)` — labels align with matrix
3. `not np.any(np.isnan(sc_matrix_filtered))`
4. `not np.any(np.isinf(sc_matrix_filtered))`

Assertion 2 compares lengths only. It cannot detect a *permuted* label vector — the figure
would render happily and be wrong. This is why the exclusion must be applied exactly once, at
the SC-matrix stage.

## Recorded statistics (`statistics.json`)

Verbatim, from the original reference implementation:

```json
{
  "original_matrix_shape": [
    70,
    70
  ],
  "n_excluded_regions": 5,
  "filtered_matrix_shape": [
    65,
    65
  ],
  "n_modules": 4,
  "module_labels": [
    1,
    2,
    3,
    4
  ],
  "regions_per_module": {
    "1": 22,
    "2": 11,
    "3": 19,
    "4": 13
  },
  "sc_squared_statistics": {
    "min": 0.0,
    "max": 1.0,
    "mean": 0.29895987221581277,
    "median": 0.3061414633020998,
    "std": 0.22377681331254307,
    "percentile_25": 0.1091362840263505,
    "percentile_75": 0.4652427990264051,
    "percentile_90": 0.592805685018394,
    "percentile_95": 0.6738914249855023
  },
  "module_boundaries": [
    [
      0,
      22
    ],
    [
      22,
      33
    ],
    [
      33,
      52
    ],
    [
      52,
      65
    ]
  ]
}
```

Module sizes sum to 65, and the boundaries are the running cumulative sums of those sizes —
these are the two consistency checks worth running on a re-run.

## Scientific conclusion supported

From `conclusions.json`:

> The squared undirected structural connectivity (SC^2) matrix of the zebrafish brain, analyzed
> across 65 regions, exhibits a distinct modular architecture organized into four communities,
> characterized by high-intensity connectivity clustered within diagonal blocks compared to
> sparse inter-modular connections.

The analytical report adds the observation that the four diagonal blocks span sorted indices
0–22, 22–33, 33–52 and 52–65, and that squaring "served to suppress weak links and accentuate
the structural backbone". Note that the suppression is a *display* effect; no edge was removed.

## Figure specification

Square figure, 8×8 in at 300 dpi. Element-wise squared undirected SC matrix, 65×65, rows and
columns reordered by module label so the four communities form contiguous diagonal blocks.
`Purples` colormap over the full data range `[0, 1]`, `aspect='equal'`,
`interpolation='nearest'`. Four thick black square outlines (`linewidth=3`, no fill) drawn
along the diagonal at the module boundaries, anchored half a pixel up and left so the outline
sits on cell edges. A horizontal colorbar beneath the matrix labelled `SC^2` (fontsize 12,
`fraction=0.046`, `pad=0.08`). All x and y ticks and tick labels suppressed, so only the
topology is visible. Saved with `bbox_inches='tight'`.
