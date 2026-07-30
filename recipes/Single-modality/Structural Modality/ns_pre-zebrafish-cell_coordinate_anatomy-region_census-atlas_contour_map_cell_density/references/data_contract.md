# Data contract — ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes | Root scanned by `get_datasets(..., keywords=['fish'])` for per-larva folders |
| `ATLAS_PATH` | yes | Passed to the `MapzebrainAtlas` constructor |
| `PROCESS_DATA_DIR` | yes | Writes all four `.npy` artifacts; also re-read during the visualisation half |
| `SAVE_DIR` | yes | Writes `figure.png` and `statistics.json` |

None of the four is validated. The script goes straight to
`os.makedirs(PROCESS_DATA_DIR, exist_ok=True)` and `os.makedirs(SAVE_DIR, exist_ok=True)`, so
an unset `PROCESS_DATA_DIR` or `SAVE_DIR` raises `TypeError: ... NoneType` immediately. An
unset `ZEBRAFISH_PATH` or `ATLAS_PATH` fails a little later, inside the library call. There is
no explicit `ValueError` guard of the kind `ns_ana-zebrafish-ca-pearson-fc_matrix` uses.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas, get_datasets
```

The library is bundled, not external: `scripts/zebrafish_Ca_utils.py` is the one module this
recipe carries, and the `sys.path` line above resolves the import to it. The API contract below
is unchanged.

| Symbol | Signature as used | Contract |
|---|---|---|
| `MapzebrainAtlas` | `MapzebrainAtlas(ATLAS_PATH)` | Atlas handle |
| `MapzebrainAtlas.getRegionMask` | `atlas.getRegionMask(r, orientation='vertical')` | `r` is a 0-indexed region id; returns a 3-D boolean/numeric volume whose `mean(axis=0)` matches `XYprojection.shape` and whose `mean(axis=2)` matches `XZprojection.shape` |
| `MapzebrainAtlas.XYprojection` | attribute | 2-D array; used only for its `.shape` to size the accumulator |
| `MapzebrainAtlas.XZprojection` | attribute | 2-D array; used only for its `.shape` |
| `get_datasets` | `get_datasets(ZEBRAFISH_PATH, keywords=['fish'])` | Returns a list of per-larva directory paths, in library-defined order |

**`.centroids` and `.regionCentroids` are not used by this recipe.** Neuron positions come from
the per-larva HDF5 (`centroids_atlas`), not from the atlas. The atlas-side centroid members are
used by `ns_vis-zebrafish-ca_atlas-edge_projection-fc_network_map` and other projection recipes;
do not confuse the two sources.

Standard-library and third-party imports: `os`, `sys`, `json`, `numpy`, `matplotlib.pyplot`,
`h5py`, `pathlib.Path` (imported but unused), `colorsys`.

No helper is defined inline in this script — everything is either an import or straight-line
code.

## Inputs

### `data.hdf5` (one per larva)

- Location: `<larva_folder>/data.hdf5` for each folder returned by `get_datasets`
- Datasets read:
  - `region_labels` — `(n_neurons, 70)`, read as `bool`. Column `r` is `True` where the neuron
    belongs to atlas region `r`. Rows may have more than one `True`, and may have none.
  - `centroids_atlas` — `(n_neurons, 3)`, read as `float`. Columns are `(x, y, z)` in atlas
    voxel coordinates. Only read for the representative larva.
- Produced by: upstream registration, outside this recipe set (see the root `README.md` — the
  `ns_reg` stage is unused because registration happened before this dataset).
- Missing file: a warning is printed and the larva's census column stays all-zero. It is not
  removed from `N_fish`.

### Atlas

- `MapzebrainAtlas(ATLAS_PATH)` supplies the 70 region masks and the two projection templates.
- 70 regions per hemisphere-collapsed atlas. The `getRegionMask` call uses
  `orientation='vertical'`.

## Outputs

### `Figure1_N_neurons_per_region.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_N_neurons_per_region.npy`
- Shape: `(70, 22)` — regions × larvae, dtype `int`
- Content: number of neurons assigned to each atlas region in each larva. Pre-exclusion: all
  70 rows are present, including region 10 and the four sparsely sampled regions.
- Consumed by: **no other recipe in this set.** It is a diagnostic/audit artifact — the input
  to the exclusion decision, kept so the decision can be re-derived without re-reading 22 HDF5
  files. Reach for it if you need to justify or retune the thresholds.

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, dtype `int`, sorted ascending
- Values in this dataset: `[10, 34, 44, 49, 69]`
- Semantics: 0-indexed atlas region ids to drop. Region 10 is the retina (rule-based); 34, 44,
  49 and 69 failed the ≥ 25-neurons-in-≥ 50 %-of-larvae criterion.

This is the pipeline hub. Consumed by **17** recipes:

| Recipe | Source dir |
|---|---|
| `ns_pre-zebrafish-ca-minfilter-dff_region_series` | Done-Figure1D-194527 |
| `ns_ana-zebrafish-ca-pearson-fc_matrix` | Done-Figure1E-201053 |
| `ns_vis-zebrafish-ca_atlas-edge_projection-fc_network_map` | Done-Figure1F-105242 |
| `ns_vis-zebrafish-sc_atlas-edge_projection-sc_network_map` | Done-Figure2B-140842 |
| `ns_multi-zebrafish-sc_ca-triu_pearson-sc_fc_coupling` | Done-Figure2C-140843 |
| `ns_multi-zebrafish-sc_ca-anova-directionality_effect` | Done-Figure2D-170544 |
| `ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map` | Done-Figure2E-173756 |
| `ns_multi-zebrafish-sc_ca-linregress-degree_coupling` | Done-Figure2F-185422 |
| `ns_multi-zebrafish-sc_ca-graph_predictors-fc_variance_explained` | Done-Figure2I-144531 |
| `ns_feat-zebrafish-sc-pca-predictor_dimensionality` | Done-Figure2J-132431 |
| `ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction` | Done-Figure2K-112601 |
| `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` | Done-Figure2L-133331 |
| `ns_seg-zebrafish-sc-consensus_louvain-module_partition` | Done-Figure3A-164917 |
| `ns_vis-zebrafish-sc-module_sorted-sc_block_heatmap` | Done-Figure3B-191157 |
| `ns_vis-zebrafish-sc_atlas-node_projection-module_topography` | Done-Figure3C-191906 |
| `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient` | Done-Figure6A-174548 |
| `ns_vis-zebrafish-st-zscore-gene_region_heatmap` | Done-Figure7B-163709 |

Three consumption patterns appear among those 17, and they are not interchangeable:

1. **Boolean mask on a 70-length axis** — `mask = np.ones(70, bool); mask[excluded] = False`.
   Used by `dff_region_series`, `pearson-fc_matrix` and most matrix filters.
2. **Bilateral offset** — the index `i` and `i + 70` (or `i + n_per_hemisphere`) are excluded
   together, so a 140-region bilateral array becomes 130. Used by the atlas projection recipes,
   including `ns_vis-zebrafish-ca_atlas-edge_projection-fc_network_map`.
3. **Re-application to already-filtered data** — a bug, not a pattern.
   `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` applies this list a second time
   to matrices that are already 65×65, drops index 69 as out of bounds, and ends up with 61
   regions. Apply the mask exactly once, at the 70-region stage.

### `Figure1_projection_regions_top.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_projection_regions_top.npy`
- Shape: same as `atlas.XYprojection`, dtype `float`
- Content: sum over all regions except 10 of `getRegionMask(r).mean(axis=0)`, then divided by
  its own maximum so values lie in `[0, 1]`
- Consumed by: no other recipe. Read back within this same script for the figure background.

### `Figure1_projection_regions_side.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_projection_regions_side.npy`
- Shape: same as `atlas.XZprojection`, dtype `float`
- Content: same construction with `mean(axis=2)`, independently max-normalised
- Consumed by: no other recipe. Read back within this script; rotated with `np.rot90(..., k=3)`
  before display.

The two projections are normalised separately, so their intensities are not comparable.

### Figure and statistics

- `$SAVE_DIR/figure.png`, 300 dpi, `bbox_inches='tight'`.
- `$SAVE_DIR/statistics.json` — see `method_details.md` for its schema and values.

## Indexing conventions

- **Region ids are 0-indexed throughout** — the census matrix rows, the exclusion list, and
  `region_labels` columns all use 0–69. Region 10 is the eleventh row.
- **The exclusion list is pre-exclusion numbering.** `[10, 34, 44, 49, 69]` indexes the
  original 70-region space. After filtering, the 65 survivors are renumbered contiguously
  0–64, and post-exclusion index 34 is *not* atlas region 34. Any recipe that maps a 65-length
  vector back to anatomy has to reconstruct the original ids from this mask.
- **`region_labels` may be multi-hot.** `np.argmax(..., axis=1)` collapses it to the
  lowest-index `True` column. Rows with no `True` are removed by the `has_label` guard; without
  that guard `argmax` would return 0 and manufacture region-0 neurons.
- **Bilateral pairing is not established here.** This recipe works in the 70-region
  hemisphere-collapsed space. The `i` / `i + 70` bilateral convention is introduced downstream
  by the recipes that concatenate `atlas.centroids['left']` and `atlas.centroids['right']`;
  they excluded `i` and `i + 70` together, which is why 140 − 10 = 130 in
  `ns_vis-zebrafish-ca_atlas-edge_projection-fc_network_map`.
- **Larva order is `get_datasets` order, unsorted.** This script does not call `sorted()` on
  the folder list, unlike `ns_pre-zebrafish-ca-minfilter-dff_region_series`, which does. The
  census matrix column order and the identity of `datasets[1]` therefore depend on the
  library's traversal order. Column `j` of `Figure1_N_neurons_per_region.npy` is not
  guaranteed to be `fish{j+1}`.
- **Coordinate columns of `centroids_atlas` are `(x, y, z)`.** Top view plots columns `0, 1`.
  Side view plots `(359 - column 2, column 1)`.
