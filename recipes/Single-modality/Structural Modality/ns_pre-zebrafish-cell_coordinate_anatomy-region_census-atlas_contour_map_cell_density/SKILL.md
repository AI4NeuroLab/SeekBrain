---
name: "ns_pre-zebrafish-cell_coordinate_anatomy-region_census-atlas_contour_map_cell_density"
description: "Census every neuron from every zebrafish larva into Mapzebrain atlas regions, report the whole-brain neuron count per fish (mean ± SD), and derive the quality-control exclusion mask that every downstream analysis in this dataset filters by. Use this whenever someone asks how many neurons were recorded, how many cells map to each brain region, which regions are too sparsely sampled to trust, which regions should be dropped or excluded, how to build or regenerate Figure1_excluded_regions.npy, or wants the atlas region projection backgrounds for plotting neurons on brain anatomy — including phrasings like 'how well is each region sampled', 'drop the badly covered regions', 'how many cells per fish', 'show me where the neurons are in the brain', or 'set up the region filter'. This is the root of the entire pipeline: it writes Figure1_excluded_regions.npy, which 17 other recipes read, so run it first and treat its thresholds as a global parameter — changing them silently shifts"
triggers:
- "Analyze region neuron census and the whole-pipeline exclusion mask"
- "Generate region neuron census and the whole-pipeline exclusion mask outputs"
- "Apply the ns_pre-zebrafish-cell_coordinate_anatomy-region_census-atlas_contour_map_cell_density recipe"
tags:
- "zebrafish"
- "cell"
- "coordinate"
- "anatomy"
- "region"
version: "1.0"
---

# Region neuron census and the whole-pipeline exclusion mask

Counts neurons per atlas region per larva, applies two exclusion rules, and writes the
`Figure1_excluded_regions.npy` mask that the rest of the study depends on. Also builds the
composite top/side region projection images used as anatomical backgrounds, and renders one
representative larva's somata over them.

## When to use this

Use this recipe to count registered neurons by atlas region, define low-coverage exclusions, and create regional projection and density maps. Do not use it before cell coordinates and region labels have been mapped to the same atlas version.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/**/fish*/data.hdf5` → `region_labels` | (n_neurons, 70) bool |
| in | `$ZEBRAFISH_PATH/**/fish*/data.hdf5` → `centroids_atlas` | (n_neurons, 3) float |
| in | `$ATLAS_PATH` via `MapzebrainAtlas` | region masks + XY/XZ projections |
| out | `$PROCESS_DATA_DIR/Figure1_N_neurons_per_region.npy` | (70, 22) int |
| out | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int — **read by 17 recipes** |
| out | `$PROCESS_DATA_DIR/Figure1_projection_regions_top.npy` | 2-D float, `XYprojection` shape |
| out | `$PROCESS_DATA_DIR/Figure1_projection_regions_side.npy` | 2-D float, `XZprojection` shape |
| out | `$SAVE_DIR/figure.png`, `$SAVE_DIR/statistics.json` | |

Full detail, including the complete list of consuming recipes, in
`references/data_contract.md`.

## Procedure

1. Initialise `atlas = MapzebrainAtlas(ATLAS_PATH)`.
2. Discover larva folders with `get_datasets(ZEBRAFISH_PATH, keywords=['fish'])`. Do not sort
   — the script relies on the returned order for the representative larva, so imposing a sort
   changes which fish is plotted.
3. Allocate a `(70, n_fish)` integer count matrix. 70 is hard-coded as the atlas region count,
   not read from the data; the per-fish loop fills only
   `range(min(70, region_labels.shape[1]))` columns so a differently sized atlas silently
   leaves zeros rather than crashing.
4. For each larva, open `data.hdf5`, read `region_labels` as bool, and sum each column. A
   missing `data.hdf5` prints a warning and leaves that fish's column all-zero — it still
   counts toward `N_fish`, so it drags every region toward exclusion.
5. Save the census as `Figure1_N_neurons_per_region.npy`.
6. Build the exclusion list:
   - Region 10 (retina) unconditionally. It is sensory periphery, not brain, and its inclusion
     would put a non-neural-tissue signal into every connectivity matrix.
   - Any other region with fewer than 25 neurons in at least half the larvae. The point is
     that a region averaged over a handful of cells produces a noisy trace whose correlations
     are dominated by sampling error, not biology.
   - Concretely: exclude region `r` when `sum(counts[r, :] >= 25) < n_fish * 0.5`.
7. Sort, cast to int, save as `Figure1_excluded_regions.npy`. Keeping it sorted matters — the
   downstream recipes use it as a boolean-mask index and as a bilateral offset base.
8. Sum the census over *included* regions only, per fish, and report mean ± SD with
   `np.std(..., ddof=1)`. Sample SD, not population SD; using `ddof=0` would understate the
   spread across 22 larvae.
9. Build the anatomical backgrounds: for every region except 10, take
   `atlas.getRegionMask(r, orientation='vertical')` and accumulate `mask.mean(axis=0)` into the
   top image and `mask.mean(axis=2)` into the side image. Normalise each by its own max so both
   land in [0, 1] and share the `vmin=0, vmax=1` display scale.
10. Save both projections.
11. Visualise: take `datasets[1]`, load its centroids and `region_labels`, collapse labels to a
    single id per neuron with `np.argmax(region_labels, axis=1)`, and drop neurons that are
    unlabelled (`~np.any(region_labels, axis=1)`) or land in an excluded region.
12. Colour by region using 11 hues at saturation 0.65, value 0.90, tiled to cover the region
    range. Scatter over the top view at `(x, y)` and over the side view at `(359 - z, y)`,
    the side background rotated 90° clockwise with `np.rot90(..., k=3)`.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `N_regions` | 70 | Hard-coded atlas size. Data with a different region count is silently truncated or zero-padded. |
| retina region id | 10 | Always excluded, and also skipped when building the projections. |
| `threshold_count` | 25 | Minimum neurons for a region to count as sampled in a larva. Raising it excludes more regions and shifts all 17 downstream analyses. |
| `threshold_fraction` | 0.5 | Fraction of larvae that must clear the count. With 22 fish this means ≥ 11. |
| `ddof` | 1 | Sample SD for the neuron-count report. |
| representative larva | `datasets[1]` | Index 1 in `get_datasets` order — positional, not name-matched. |
| palette | 11 hues, s=0.65, v=0.90 | Colours repeat every 11 regions, so distant regions can share a colour. Display only. |
| `TOP_VIEW` limits | x `[65, 505]`, y `[850, 50]` | y inverted so anterior is up. |
| `SIDE_VIEW` limits | x `[40, 359]`, y `[850, 50]` | 359 is also the z-inversion constant. |
| `figsize` | `(8, 6)`, width ratios `[0.6, 0.4]` | |
| `dpi` | 300 | |

## Expected results

A correct re-run on the same 22 larvae should land at:

- 22 larvae discovered, 70 atlas regions
- **5 regions excluded: `[10, 34, 44, 49, 69]`** — retina plus four that fail the sampling
  threshold. This is the exact array 17 downstream recipes expect; 70 − 5 = 65 is the region
  count that appears throughout the dataset.
- Neurons per fish over included regions: **54 414.6 ± 5 234.2** (mean ± sample SD)
- Range **44 140 to 66 010**, median **55 462.5**
- Representative larva after filtering: **44 027 neurons**

The headline claim: whole-brain imaging maps ≈ 54 000 neurons per larva onto the atlas, with
an SD of roughly 10 % of the mean — consistent labelling across samples.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/reference_implementation.py
```
