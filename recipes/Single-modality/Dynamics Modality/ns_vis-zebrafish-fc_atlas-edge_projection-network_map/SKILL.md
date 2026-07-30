---
name: "ns_vis-zebrafish-fc_atlas-edge_projection-network_map"
description: "Draw the group-averaged functional connectivity network as an anatomical wiring diagram — regional centroids as nodes and FC strength as coloured edges — overlaid on the Mapzebrain top (XY) and side (XZ) brain projections, with the weakest quartile of connections hidden. Use this whenever someone wants to see connectivity on the brain rather than as a matrix: 'plot the FC network on the atlas', 'show the connectome anatomically', 'where are the strong functional connections in the brain', 'map the network onto brain anatomy', 'glass-brain view', 'node-and-edge brain graph', 'top and side view of the functional network', or 'are the strong connections long-range or local'. Reads Figure1_FC_matrix.npy and Figure1_excluded_regions.npy, mirrors the 65-region matrix to a bilateral 130-node graph via atlas centroids, and writes only a figure — no .npy artifacts — so reach for it after ns_ana-zebrafish-ca-pearson-fc_matrix when the goal is a publication-quality spatial rendering rather"
triggers:
- "Analyze functional connectivity network drawn on the brain atlas"
- "Generate functional connectivity network drawn on the brain atlas outputs"
- "Apply the ns_vis-zebrafish-fc_atlas-edge_projection-network_map recipe"
tags:
- "zebrafish"
- "fc"
- "atlas"
- "edge"
- "projection"
version: "1.0"
---

# Functional connectivity network drawn on the brain atlas

Places the 65-region group-average FC matrix on real anatomy: nodes at bilateral regional
centroids, edges coloured by correlation strength, over the atlas XY and XZ projections.

## When to use this

Use this recipe to draw a thresholded functional-connectivity network over dorsal and lateral atlas projections. Do not use it for directed-edge interpretation or before matching FC nodes to atlas centroids.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy` | (65, 65) |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| in | `$ATLAS_PATH` via `MapzebrainAtlas` | `.centroids`, `.XYprojection`, `.XZprojection` |
| out | `$SAVE_DIR/figure.png` | 300 dpi |
| out | `$SAVE_DIR/statistics.json` | descriptive only |

Full detail in `references/data_contract.md`.

## Procedure

1. Load the 65×65 FC matrix and the 5-element exclusion list.
2. Instantiate `MapzebrainAtlas(ATLAS_PATH)` and take `centroids_left = atlas.centroids['left']`
   and `centroids_right = atlas.centroids['right']`, each (70, 3). Use `.centroids`, not
   `.regionCentroids` — both exist on the class and are used by different figures in this
   dataset, and they are not interchangeable.
3. Concatenate left then right into a (140, 3) array. The concatenation order is what defines
   the `i` / `i + 70` bilateral pairing for the rest of the script.
4. Flip y into image orientation: `centroids[:, 1] = 974 - centroids[:, 1]`. 974 is the atlas
   y extent; without this the network sits mirrored relative to the background image.
5. Build the bilateral FC matrix with `np.tile(fc_matrix, (2, 2))` → (130, 130). Understand
   what this does before trusting the figure: it *copies* the 65×65 hemisphere-collapsed matrix
   into all four blocks, so left–left, left–right, right–left and right–right connectivity are
   identical by construction. Inter-hemispheric edges in this figure are assumed, not measured.
6. Drop the excluded regions from the centroids on both sides: exclude index `i` and `i + 70`
   for each `i` in the mask, giving (130, 3). Bounds-check with
   `excluded_regions[excluded_regions < 70]` before offsetting, as the script does — an index
   past the hemisphere size would otherwise wrap into the wrong hemisphere rather than error.
7. Assert the tiled matrix and the filtered centroids agree at 130. This is the one real
   integrity check in the script; keep it.
8. Enumerate the upper triangle, skipping `i == j`, and keep an edge only if its weight is
   neither NaN nor exactly 0. Collect `(i, j, weight)` triples.
9. Threshold at the 25th percentile of the kept weights and discard everything below. The point
   is legibility — 8320 edges over a brain outline is an unreadable wash.
10. Sort the survivors ascending by weight, so `LineCollection` draws strong edges last and they
    end up on top. Reversing this hides exactly the connections the figure is about.
11. Top panel: `imshow(atlas.XYprojection, cmap='binary', aspect='equal')`, edges as a
    `LineCollection` over `(x, y)` with `cmap='Reds'`, `clim(0.2, 0.9)`, `linewidths=0.5`,
    `alpha=0.7`, `zorder=1`; nodes as a white-faced, black-edged scatter at `zorder=10`.
    Limits x `[65, 505]`, y `[850, 50]`. Label "Top" upper-left.
12. Side panel: same edge list, coordinates `(359 - z, y)`, background
    `np.rot90(atlas.XZprojection, k=3)`. Limits x `[40, 359]`, y `[850, 50]`. Label "Side"
    upper-right.
13. Write `figure.png` at 300 dpi and a `statistics.json` describing node counts, edge counts,
    weight quantiles and centroid spread.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `TOP_VIEW_Y_MAX` | 974 | y-flip constant. Wrong value shifts every node off the anatomy. |
| `SIDE_VIEW_Z_MAX` | 359 | z-inversion constant, and also the side-view x upper limit. |
| bilateral construction | `np.tile(fc, (2, 2))` | Imposes bilateral symmetry rather than measuring it. See Pitfalls. |
| edge threshold | 25th percentile of kept weights | ≈ 0.2539 for the recorded dataset. Display only — it does not change any stored number. |
| edge draw order | ascending by weight | Strong edges on top. |
| edge `cmap` / `clim` | `'Reds'`, `[0.2, 0.9]` | Matches the FC heatmap in `ns_ana-zebrafish-ca-pearson-fc_matrix`, so the two figures are directly comparable. |
| edge `linewidths` / `alpha` | 0.5 / 0.7 | |
| node `s` / `linewidths` | 10 / 0.5, white face, black edge | |
| `zorder` | edges 1, nodes 10 | Nodes must sit above the edge bundle to stay visible. |
| panel geometry | `add_axes([0.05, 0.1, 0.54, 0.8])` and `[0.62, 0.1, 0.36, 0.8]` | 60 % / 40 % width split via explicit axes, not gridspec. |
| `figsize` | (8, 6) | |
| `dpi` | 300 | |

## Expected results

From `statistics.json`:

- 140 atlas centroids → **10 excluded** (5 regions × 2 hemispheres) → **130 nodes**
- FC matrix 65×65 → tiled to **130×130**
- **8320 edges** kept of the 8385 upper-triangle pairs, **6240** above the 25th percentile
  (exactly 75 %)
- Edge weights: min **−0.1643**, max **0.9308**, mean **0.4111**, median **0.3943**,
  25th pct **0.2539**, 75th pct **0.5632**
- Centroid spread: x 290.15 ± 75.89, y 463.68 ± 167.60, z 149.18 ± 62.51

The mean of 0.4111 is the same number `ns_ana-zebrafish-ca-pearson-fc_matrix` reports as
`fc_lower_triangle_mean`, which is the expected consistency check — tiling replicates each
off-diagonal FC entry exactly four times, so the mean is unchanged.

Claims supported: the network shows robust global integration at mean r ≈ 0.41 with 75 % of
connections above r ≈ 0.25, and the surviving edges span the full anterior–posterior and
dorso-ventral extent of the brain rather than clustering locally.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/reference_implementation.py
```
