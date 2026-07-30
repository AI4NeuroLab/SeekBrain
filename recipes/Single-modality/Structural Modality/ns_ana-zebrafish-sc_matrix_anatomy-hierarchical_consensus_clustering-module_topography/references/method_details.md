# Method details — ns_vis-zebrafish-sc_atlas-node_projection-module_topography

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Scientific conclusions supported](#scientific-conclusions-supported)
- [Output requirements](#output-requirements)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| atlas member | `.centroids` | `atlas.centroids['left'\|'right']` | **Not** `.regionCentroids`. Both exist in this library and hold different coordinates. |
| concatenation order | left, then right | `np.concatenate([left, right], axis=0)` | Fixes the `i` / `i + 70` bilateral pairing and makes the label doubling valid. |
| y flip constant | `974` | `centroids[:, 1] = 974 - centroids[:, 1]` | Atlas image height. Converts atlas y (upward) to image row (downward). A wrong constant mirrors every node about the A-P axis. |
| bilateral offset | `70` | `exclusion_mask[i + 70] = False` | Regions per hemisphere. |
| `MODULE_COLORS` | `{1:'#8A2BE2', 2:'#00CED1', 3:'#F0E68C', 4:'#FF0000'}` | module level | Purple, cyan, pale yellow, red — anterior to posterior. Valid only because the upstream recipe already renumbered modules anteroposteriorly. |
| `figsize` | `(8, 6)` | `plt.figure` | |
| top-view axes rect | `[0.05, 0.1, 0.5, 0.8]` | `fig.add_axes` | left, bottom, width, height in figure fractions |
| side-view axes rect | `[0.6, 0.1, 0.35, 0.8]` | `fig.add_axes` | 0.5 : 0.35 ≈ the requested 60 : 40 split; the 0.05 gap holds the A-P arrow |
| image `cmap` | `'binary'` | both `imshow` calls | Greyscale anatomy that does not compete with categorical node colours |
| image `aspect` | `'equal'` | both `imshow` calls | Undistorted anatomy |
| scatter `s` | `60` | both panels | |
| scatter `alpha` | `0.8` | both panels | Lets overlapping nodes show through |
| scatter `edgecolors` | `'black'` | both panels | Essential for the pale-yellow module (`#F0E68C`) to be visible on a light background |
| scatter `linewidths` | `1` | both panels | |
| top-view `xlim` | `[65, 505]` | | Crops to the brain |
| top-view `ylim` | `[850, 50]` | | **Inverted** — anterior at the top |
| side-view `xlim` | `[40, 359]` | | |
| side-view `ylim` | `[850, 50]` | | Identical to the top view, so the two panels align row-for-row |
| side-view x transform | `359 - z` | | Inverts dorsoventral to match the rotated image; `359` is the rotated image width |
| side-view y transform | `y` (already flipped) | | Shared vertical axis with the top view |
| image rotation | `np.rot90(img, k=3)` | side panel | 270° CCW = 90° CW |
| panel labels | `'Top'` at `(70, 840)`, `'Side'` at `(45, 840)` | data coords | fontsize 14, black, `va='top'`, `ha='left'` |
| legend anchor | `(310, 100)` | side-view data coords | `'Modules'`, fontsize 12, bold, black |
| legend digit x | `320` (= `legend_x + 10`) | side-view data coords | |
| legend digit spacing | base `25`, refine `30` | `legend_y + 30 + i * spacing` | The refine script's only effective change |
| legend digit fontsize | base `11`, refine `12` | | |
| A-P arrow x | `0.555` | figure coords | Between the panels |
| A-P arrow y span | `0.15` → `0.25` | figure coords | `arrowstyle='<->'`, `linewidth=2`, `mutation_scale=15`, appended to `fig.patches` |
| `'A'` / `'P'` labels | `(0.545, 0.26)` / `(0.545, 0.14)` | figure coords | fontsize 12, bold |
| `dpi` | `300` | `savefig` | |
| `bbox_inches` | `'tight'` | `savefig` | |

Everything above is hard-coded. There are no derived limits: change the atlas volume or the
`add_axes` rectangles and every annotation position has to be revisited.

## Statistical approach

None in the inferential sense — this is a rendering recipe with a descriptive summary attached.

- **The partition is not computed here.** It is read from
  `ns_seg-zebrafish-sc-consensus_louvain-module_partition` (Ward linkage on
  `1 − coassignment_probability`, cut at 4 clusters, then renumbered anteroposteriorly).
- **No spatial statistic is computed.** The report's claims of "strict anterior-to-posterior
  topographic arrangement" and "high spatial contiguity … no interspersed or outlier regions"
  are read off the picture. Neither script measures within-module spatial dispersion, nor tests
  module centroid positions against a spatial null. If those claims need backing, that machinery
  exists in `ns_multi-zebrafish-ca_behav-spatial_permutation-functional_atlas_map`.
- **Bilateral symmetry is assumed, not measured.** The right hemisphere's colours are a copy of
  the left's (`np.concatenate([labels, labels])`). The second conclusion in `conclusions.json`
  — "modular assignment … mirrored across the left and right hemispheres" — restates the
  construction. Cite it as a design property of the visualisation, not a result.
- Reported percentages are `count / 130 × 100` over the doubled label vector, so they are
  identical to the unilateral percentages.

### Validation in the base script

- `assert len(filtered_centroids) == len(bilateral_module_labels)`
- A `raise ValueError` on the third alignment branch
- Two booleans recorded in `statistics.json`: `centroids_match_labels`, `is_bilateral`

All are length checks. None can detect a permuted label vector; the ordering discipline of
"left block then right block, same region order in both" is what actually guarantees
correctness.

## Recorded statistics (`statistics.json`)

Verbatim, from the original base run:

```json
{
  "total_regions_before_exclusion": 140,
  "excluded_regions_count": 10,
  "total_regions_after_exclusion": 130,
  "module_labels_input_count": 65,
  "bilateral_module_labels_count": 130,
  "module_counts": {
    "module_1": 44,
    "module_2": 22,
    "module_3": 38,
    "module_4": 26
  },
  "module_percentages": {
    "module_1": 33.84615384615385,
    "module_2": 16.923076923076923,
    "module_3": 29.230769230769234,
    "module_4": 20.0
  },
  "centroid_ranges": {
    "x_range": [
      104.44609527837996,
      466.3343535679873
    ],
    "y_range": [
      106.93206841313884,
      765.1077443657026
    ],
    "z_range": [
      43.42995267351719,
      291.854143906726
    ]
  },
  "validation": {
    "centroids_match_labels": true,
    "is_bilateral": true
  }
}
```

Cross-checks worth running on a re-run:

- Module counts are exactly twice the unilateral sizes recorded by
  `ns_vis-zebrafish-sc-module_sorted-sc_block_heatmap` (22, 11, 19, 13 → 44, 22, 38, 26).
- The counts sum to 130, and 130 = 140 − 2 × 5.
- `y_range` is **post-flip**. Comparing it against raw atlas y values will look wrong; the raw
  range is `974 − [765.108, 106.932]` = `[208.892, 867.068]`.
- `z_range` is pre-inversion; the side panel plots `359 − z`, i.e. `[67.146, 315.570]`.

## Implementation requirements

Apply the following implementation requirements (four ways:

1). **Attempts the side-view projection fix — and falls back.** It replaces the hard
   `atlas.XZprojection` with

   ```python
   if hasattr(atlas, 'YZprojection'):
       Side_projection_raw = atlas.YZprojection
   else:
       print("Warning: YZprojection not found, falling back to XZprojection.")
       Side_projection_raw = atlas.XZprojection
   ```

   On the original run the `else` branch executed — `exec_refine.log` contains that exact
   warning. **The refined figure therefore uses the same `XZprojection` as the base figure**,
   and the anatomical mismatch the critique identified is still present in
   `figure_refine.png`. The two PNGs differ by ~100 bytes, consistent with only the legend
   change.
2. **Legend spacing.** Digit spacing 25 → 30 data units, digit fontsize 11 → 12. This is the
   only change that actually took effect.
3. **Wraps everything in `run_visualization()`** under an `if __name__ == "__main__"` guard.
4. **Drops `import json` and the entire statistics block**, so it writes no `statistics.json`.
   It also softens the third alignment branch from `raise ValueError` to a silent "fallback
   assumption" that duplicates the labels regardless.

**Prefer `reference_implementation.py`** — the opposite of the usual advice in this recipe set.
The refine pass produced no visual improvement it intended, lost the statistics, and lost an
error guard. If you have an atlas that exposes `YZprojection`, take the refine script's
`hasattr` block and graft it into the base script: the node coordinates (`359 - z`, `y`) and
the `rot90(k=3)` rotation are already correct for a YZ image, since the critique's point 3 notes
the rotation logic "is correct for a `YZ` image (where columns are Y) … but failed because the
input image was `XZ`".

### What the figure critique said

1. **Incorrect side view projection** — `XZprojection` is a coronal/frontal view; a sagittal
   side view needs `YZprojection`. The scatter points are plotted in sagittal coordinates, so
   they do not align with the background anatomy.
2. **Legend layout** — numbers cramped against the "Modules" text.
3. **Coordinate alignment** — the `rot90(k=3)` rotation is right for a YZ image; only the input
   image was wrong.
4. **Data loading** — exclusion and concatenation logic judged correct.

Point 1 is the substantive one and remains unfixed for want of a `YZprojection` member.

## Scientific conclusions supported

From `conclusions.json`:

> The four modules identified from the structural connectivity co-assignment matrix exhibit a
> sequential spatial distribution along the anterior-posterior axis, transitioning from the
> anterior forebrain to the posterior hindbrain.

> The spatial organization of the structural connectivity modules displays distinct bilateral
> symmetry, with the modular assignment of brain regions mirrored across the left and right
> hemispheres.

The analytical report localises the modules as: module 1 (purple, n=44) telencephalon and
anterior diencephalon; module 2 (cyan, n=22) diencephalic-mesencephalic junction; module 3
(pale yellow, n=38) anterior hindbrain; module 4 (red, n=26) posterior hindbrain. These are
visual anatomical attributions, not label lookups — no region-name table is consulted anywhere
in the code.

The second conclusion is a restatement of the label-doubling step. See "Statistical approach".

## Output requirements

Figure 8×6 in at 300 dpi, two panels placed with explicit `fig.add_axes`.

**Left panel — Top (horizontal / XY) view**, rect `[0.05, 0.1, 0.5, 0.8]`. Atlas `XYprojection`
via `imshow(cmap='binary', aspect='equal')`. Bilateral filtered centroids scattered at their
`(x, y)` coordinates (y already flipped as `974 − y`), `s=60`, `alpha=0.8`,
`edgecolors='black'`, `linewidths=1`, coloured by module. `xlim=[65, 505]`,
`ylim=[850, 50]` (inverted, anterior at top). Spines and ticks off via `axis('off')`. Black
`'Top'` label, fontsize 14, at data `(70, 840)`.

**Right panel — Side (nominally sagittal / XZ) view**, rect `[0.6, 0.1, 0.35, 0.8]`. Projection
image rotated 90° clockwise (`np.rot90(img, k=3)`), same `binary` colormap and equal aspect.
Centroids replotted at `(359 − z, y)` with identical marker styling. `xlim=[40, 359]`,
`ylim=[850, 50]` — the shared vertical extent is what makes the two panels read as the same
brain. `axis('off')`. Black `'Side'` label at data `(45, 840)`.

**Legend**, hand-drawn in side-view data coordinates at the top right: bold black `'Modules'`
at `(310, 100)`, then the digits `1`, `2`, `3`, `4` stacked at `x = 320` starting `30` units
below and spaced `25` (base) / `30` (refine) units apart, each bold and in its own module
colour. No matplotlib legend object is created, so nothing reflows if the axes change.

**A-P arrow**, a `FancyArrowPatch` in figure coordinates from `(0.555, 0.15)` to `(0.555, 0.25)`,
`arrowstyle='<->'`, black, `linewidth=2`, `mutation_scale=15`, appended directly to
`fig.patches`. Bold `'A'` above and `'P'` below at `x = 0.545`.

Saved with `bbox_inches='tight'`.
