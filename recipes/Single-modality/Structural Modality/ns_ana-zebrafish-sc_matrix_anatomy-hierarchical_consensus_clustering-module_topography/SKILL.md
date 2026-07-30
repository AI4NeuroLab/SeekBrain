---
name: ns_ana-zebrafish-sc_matrix_anatomy-hierarchical_consensus_clustering-module_topography
description: Project structural-connectome module membership onto zebrafish brain anatomy — plot the bilateral Mapzebrain region centroids as coloured nodes over the atlas top (XY) and side projections, one colour per consensus-Louvain module, to show where each module sits along the anterior-posterior axis. Reach for this whenever someone asks "where are these modules in the brain", "map the communities onto the atlas", "show the module topography", "are the structural modules spatially contiguous", "do the modules follow the forebrain-to-hindbrain axis", or wants the Figure 3C-style two-panel top-and-side anatomical view with a coloured module legend. It consumes Figure3_coassignment_matrix_SC_4module_ordered.npy plus the atlas centroids, writes no .npy artifact, and exists purely to produce the figure and its descriptive statistics.
triggers:
- Run the Module topography on atlas projections recipe
- Project structural-connectome module membership onto zebrafish brain anatomy — plot the bilateral Mapzebrain region centroids as coloured nodes over the atlas top (XY) and side projections, one colour per consensus-Louvain module, to show where each module sits along the anterior-posterior axis.
- Generate the outputs described by ns_ana-zebrafish-sc_matrix_anatomy-hierarchical_consensus_clustering-module_topography
tags:
- zebrafish
- sc
- matrix
- anatomy
- hierarchical
version: '1.0'
---

# Module topography on atlas projections

Places the four structural-connectivity modules on brain anatomy: bilateral region centroids,
colour-coded by module, scattered over the atlas top and side projection images.

## When to use this

The question is *"where in the brain are these communities?"* — the anatomical counterpart to
the matrix view. The answer is a picture plus per-module region counts, not a statistic.

This is a pure figure-production step. It writes **no `.npy` artifact** and nothing downstream
consumes it. The matrix-space view of the same partition is
`ns_vis-zebrafish-sc-module_sorted-sc_block_heatmap` (Figure 3B); the partition itself comes
from `ns_seg-zebrafish-sc-consensus_louvain-module_partition` (Figure 3A). All three read the
same label vector.

## Preconditions

- The one library module this recipe imports is vendored into `scripts/`:
  `zebrafish_Ca_utils.py`, supplying `MapzebrainAtlas`. The `sys.path` line points at the
  script's own directory, so the import resolves with no external setup. That line is the only
  edit to either script; everything else is as it ran. The atlas *data* at `ATLAS_PATH` is a
  separate matter and is still absent here.
- Env vars `PROCESS_DATA_DIR`, `SAVE_DIR`, `ATLAS_PATH`. Read with plain `os.getenv` and **not
  validated** — an unset variable becomes `None` and fails obscurely inside
  `os.path.join` or `MapzebrainAtlas(None)`. Check them yourself. `ZEBRAFISH_PATH` is not used.
- `Figure3_coassignment_matrix_SC_4module_ordered.npy` in `PROCESS_DATA_DIR` — despite the
  name, a **(65,) integer label vector** with values 1–4, already post-exclusion.
- `Figure1_excluded_regions.npy` in `PROCESS_DATA_DIR`, from
  `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`.
- The atlas exposes `.centroids['left']`, `.centroids['right']`, `.XYprojection` and
  `.XZprojection`. Note this recipe uses **`.centroids`, not `.regionCentroids`** — both members
  exist across this dataset and they are not interchangeable.

## Inputs and outputs

| Direction | File / member | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure3_coassignment_matrix_SC_4module_ordered.npy` | (65,) int, values 1–4 |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| in | `MapzebrainAtlas(ATLAS_PATH).centroids['left'\|'right']` | (70, 3) each |
| in | `MapzebrainAtlas(ATLAS_PATH).XYprojection`, `.XZprojection` | 2-D images |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png` | 8×6 in, 300 dpi |
| out | `$SAVE_DIR/statistics.json` | base script only |

No `.npy` artifact is written. Full detail in `references/data_contract.md`.

## Procedure

1. Load the (65,) module label vector and the (5,) exclusion index array (cast to `int`).
2. Instantiate `atlas = MapzebrainAtlas(ATLAS_PATH)`.
3. Read `atlas.centroids['left']` and `atlas.centroids['right']`, each (70, 3) in (x, y, z), and
   concatenate **left first, then right** along axis 0 → (140, 3). The left-then-right order is
   load-bearing: the exclusion arithmetic and the label doubling both assume it.
4. Flip the y coordinate in place: `centroids[:, 1] = 974 - centroids[:, 1]`. Atlas coordinates
   count y upward while `imshow` counts rows downward, so without this the nodes land mirrored
   about the anterior-posterior axis. `974` is the atlas image height and is hard-coded.
5. Build a (140,) keep-mask and, for each excluded unilateral index `i`, clear **both** `i` and
   `i + 70` — the left and right copies of the same anatomical region. Guard with
   `if i < 70`, since the exclusion list is unilateral by construction. 5 exclusions remove 10
   centroids, leaving 130.
6. Double the label vector: `np.concatenate([labels, labels])` → (130,). This is correct only
   because both the centroid array and the label vector are ordered left-block-then-right-block
   with matching region order; a homologous region gets the same module in both hemispheres by
   construction, not by measurement, so the figure's bilateral symmetry is an assumption made
   visible, not evidence.
7. Assert `len(filtered_centroids) == len(bilateral_labels)`. A length-only check cannot catch a
   permutation — keep the ordering discipline of steps 3 and 6.
8. Map labels to colours through `MODULE_COLORS = {1: '#8A2BE2', 2: '#00CED1', 3: '#F0E68C',
   4: '#FF0000'}` — purple, cyan, pale yellow, red, running anterior to posterior because the
   upstream recipe already renumbered the modules anteroposteriorly.
9. Lay out the figure by explicit `fig.add_axes`, not `subplots`: top view at
   `[0.05, 0.1, 0.5, 0.8]`, side view at `[0.6, 0.1, 0.35, 0.8]` — roughly the requested 60/40
   width split with matched heights, leaving a gap between the panels for the A–P arrow.
10. **Top view**: `imshow(atlas.XYprojection, cmap='binary', aspect='equal')`, then scatter
    `(x, y)` of the filtered centroids with `s=60`, `alpha=0.8`, `edgecolors='black'`,
    `linewidths=1`. Fix `xlim=[65, 505]` and `ylim=[850, 50]` — the inverted ylim crops the
    volume to the brain and puts anterior at the top. `axis('off')`, then a `'Top'` text label
    at `(70, 840)`.
11. **Side view**: build 2-D plotting coordinates as `x_plot = 359 - z` (z inverted so dorsal
    is up after rotation) and `y_plot = y` (the already-flipped y). Rotate the projection image
    with `np.rot90(img, k=3)` — 270° counter-clockwise, i.e. 90° clockwise — so its
    anterior-posterior axis runs vertically and matches the top panel. Same scatter styling,
    `xlim=[40, 359]`, `ylim=[850, 50]` (identical vertical extent to the top view, which is what
    makes the two panels read as the same brain), `axis('off')`, `'Side'` label at `(45, 840)`.
12. Draw the legend by hand, in side-view data coordinates: bold black `'Modules'` at
    `(310, 100)`, then the digits `1`–`4` stacked below at `x = 320`, each in its own module
    colour. There is no matplotlib legend object, so nothing auto-adjusts if the axes change.
13. Add a `FancyArrowPatch` in figure coordinates at `x = 0.555` from `y = 0.15` to `0.25`,
    `arrowstyle='<->'`, appended to `fig.patches`, with bold `'A'` above and `'P'` below.
14. Save at 300 dpi with `bbox_inches='tight'`, then write `statistics.json`.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| atlas member | `.centroids` | Not `.regionCentroids`. Both exist in this library; picking the wrong one silently shifts every node. |
| y flip constant | `974` | Atlas image height. Hard-coded — a different atlas volume needs a different number, and a wrong one mirrors the whole figure. |
| bilateral pairing | `i` ↔ `i + 70` | 70 unilateral regions; left block is 0–69, right block 70–139. |
| module colours | `#8A2BE2`, `#00CED1`, `#F0E68C`, `#FF0000` | Anterior → posterior. Pale yellow on a white-ish `binary` background is the weakest of the four; black marker edges are what keep it legible. |
| marker `s`, `alpha`, `edgecolors` | `60`, `0.8`, `'black'` | Identical in both panels so the two views are comparable. |
| `cmap` (images) | `'binary'` | Greyscale anatomy that does not compete with the categorical node colours. |
| top view limits | x `[65, 505]`, y `[850, 50]` | y inverted → anterior at top. |
| side view limits | x `[40, 359]`, y `[850, 50]` | Matching y extent aligns the two panels row-for-row. |
| side-view z transform | `359 - z` | Inverts dorsoventral to match the rotated image. `359` is the rotated image width. |
| image rotation | `np.rot90(img, k=3)` | 90° clockwise. |
| `figsize`, `dpi` | `(8, 6)`, `300` | |

## Expected results

A correct re-run on the same data should reproduce:

- 140 bilateral centroids before exclusion, **10** removed (5 unilateral × 2), **130** after
- 65 input module labels → **130** bilateral labels
- Module counts (bilateral): module 1 = **44** (33.85 %), module 2 = **22** (16.92 %),
  module 3 = **38** (29.23 %), module 4 = **26** (20.00 %) — exactly twice the unilateral
  sizes 22, 11, 19, 13 reported by Figure 3B
- Centroid ranges after the y flip: x **[104.446, 466.334]**, y **[106.932, 765.108]**,
  z **[43.430, 291.854]**
- Validation flags: `centroids_match_labels` true, `is_bilateral` true

The claims these support: the four modules are laid out sequentially along the
anterior-posterior axis, from anterior forebrain to posterior hindbrain; and their spatial
arrangement is bilaterally symmetric across hemispheres.

## Pitfalls

- **The side view is an XZ projection, not a true sagittal view — and the refine script's fix
  did not take.** The figure critique correctly identified that a lateral view needs
  `YZprojection`, and the refine script asks for it via `hasattr(atlas, 'YZprojection')` with a
  fallback. On the original run that `hasattr` returned False: `exec_refine.log` reads
  `Warning: YZprojection not found, falling back to XZprojection.` So both figures use
  `XZprojection` and the diagnosed misalignment between the "Side" background anatomy and the
  scatter points is still present in `figure_refine.png`. Treat the side panel's background as
  approximate. If you re-run against an atlas that does expose `YZprojection`, the node
  coordinates (`359 - z`, `y`) and the `rot90(k=3)` rotation are already correct for it — only
  the image source changes.
- **`.centroids`, not `.regionCentroids`.** Other recipes in this set use `.regionCentroids`.
  They are different members with different contents; swapping them produces a figure that
  looks plausible and is wrong.
- **The y flip mutates the atlas array in place.** `bilateral_centroids[:, 1] = 974 - ...`
  writes into the array returned by `np.concatenate`, which is a fresh copy — safe here — but
  the pattern is one line away from mutating `atlas.centroids` itself if the concatenation is
  ever removed. The recorded `y_range` of `[106.9, 765.1]` is post-flip; do not compare it
  against raw atlas coordinates.
- **The file named `..._4module_ordered.npy` is a label vector, not a matrix.** It is
  `communities_ordered`, (65,) int, values 1–4 renumbered anteroposteriorly. The real
  co-assignment matrix is `Figure3_coassignment_matrix_SC.npy`.
- **The bilateral label doubling is an assumption, not a measurement.** The partition was
  computed on a 65-region unilateral SC matrix; the right hemisphere is coloured by copying
  the left. The report's claim of "distinct bilateral symmetry" therefore describes the
  construction, not an independent finding. Say so if you cite it.
- **Prefer the base script for the numbers.** The refine script dropped `import json` and the
  whole statistics block, so it writes **no `statistics.json`**; the stored statistics come from
  the base run. Its only effective change is widening the legend digit spacing from 25 to 30
  data units and bumping the digit fontsize from 11 to 12 — the intended `YZprojection` fix
  fell through to the fallback.
- **All annotations are positioned in hard-coded data or figure coordinates.** The legend at
  `(310, 100)`, the panel labels at `(70, 840)` / `(45, 840)`, and the arrow at figure
  `x = 0.555` will all drift if you change the axis limits or the `add_axes` rectangles.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim. Produces the figure
  **and** `statistics.json`. **Prefer this one.**
- `scripts/refine_implementation.py` — wraps the body in `run_visualization()`, attempts the
  `YZprojection` switch (which falls back to `XZprojection`), widens legend spacing; figure
  only, no statistics.
- `references/data_contract.md` — env vars, atlas members, file shapes, the bilateral indexing
  convention.
- `references/method_details.md` — every parameter, full statistics, base-vs-refine diff,
  figure specification, provenance.
