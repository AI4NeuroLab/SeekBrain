# Data contract — ns_vis-zebrafish-sc_atlas-node_projection-module_topography

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads the module label vector and the exclusion mask. Nothing is written here. |
| `SAVE_DIR` | yes | Writes `figure.png` (base) / `figure_refine.png` (refine) and `statistics.json` (base only) |
| `ATLAS_PATH` | yes | Passed to `MapzebrainAtlas(ATLAS_PATH)` for centroids and projection images |
| `ZEBRAFISH_PATH` | no | Not used by this recipe — no raw larva data is touched |

All three are fetched with plain `os.getenv(...)` and **not validated**. An unset variable
becomes `None` and surfaces later as a `TypeError` in `os.path.join`, or however
`MapzebrainAtlas` reacts to `None`. Only `SAVE_DIR` is `os.makedirs`-ed.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
```

`zebrafish_Ca_utils.py` is **bundled with this recipe**, sitting in `scripts/` beside the two
implementations, so the import resolves locally with no external setup. It is the only library
module this recipe carries, and the only one it needs. It does pull in a heavy third-party stack
at load time (`h5py`, `numba`, `tqdm`, `tifffile`, `skimage`, `sklearn`, `bct`, `IPython`) —
ordinary PyPI installs, but they must be present for the import to succeed.

| Symbol | Signature as used | Contract |
|---|---|---|
| `MapzebrainAtlas` | `MapzebrainAtlas(ATLAS_PATH)` | Atlas handle constructed from a directory path |

### `MapzebrainAtlas` members used

| Member | Type / shape | Use |
|---|---|---|
| `.centroids['left']` | `(70, 3)` float, columns `(x, y, z)` | Left-hemisphere region centroids |
| `.centroids['right']` | `(70, 3)` float, columns `(x, y, z)` | Right-hemisphere region centroids |
| `.XYprojection` | 2-D image | Top (horizontal / dorsal) view background |
| `.XZprojection` | 2-D image | Side view background (**both** scripts end up using this) |
| `.YZprojection` | 2-D image | Requested by the refine script via `hasattr`; **absent on the original run**, so the fallback to `.XZprojection` fired |

This recipe uses **`.centroids`**. It does **not** use `.regionCentroids`, which other recipes in
this set do use. The two are not interchangeable in general: the vendored source shows
`.centroids` is a property returning `.regionCentroids` with `self.excludedRegions` deleted
along axis 0. Neither script here calls `atlas.excludeRegions(...)`, so `excludedRegions` stays
`[]` and the two coincide at (70, 3) — but that equivalence is incidental to this recipe, not a
property of the class. Keep using `.centroids`.

The same source also confirms the `.YZprojection` note above: the constructor loads only
`XY_H2BGCaMP6s.tif` and `XZ_H2BGCaMP6s.tif`, so `YZprojection` is never set as an attribute at
all and the refine script's `hasattr` guard can only ever take the `.XZprojection` branch.

No other library symbol is imported. Standard imports are `os`, `sys`, `json` (base only),
`numpy`, `matplotlib.pyplot`, `matplotlib.patches.FancyArrowPatch`.

### Helpers defined inline (not external dependencies)

| Name | Where | Note |
|---|---|---|
| `MODULE_COLORS` | both scripts, module level | `{1: '#8A2BE2', 2: '#00CED1', 3: '#F0E68C', 4: '#FF0000'}` |
| `run_visualization()` | `refine_implementation.py` only | Wraps the whole body; called under `if __name__ == "__main__"` |

## Inputs

### `Figure3_coassignment_matrix_SC_4module_ordered.npy`

- Location: `$PROCESS_DATA_DIR/Figure3_coassignment_matrix_SC_4module_ordered.npy`
- Shape: **`(65,)`, integer** — a per-region module label, values `1, 2, 3, 4`
- Produced by: `ns_seg-zebrafish-sc-consensus_louvain-module_partition`, as
  `communities_ordered = reorder_clusters_anteroposterior(fcluster(Z, t=4, criterion='maxclust'))`
- The filename says "matrix" but the content is a label vector. The square co-assignment
  probability matrix is a different file from the same upstream recipe,
  `Figure3_coassignment_matrix_SC.npy`.
- The labels are **already post-exclusion** (65 = 70 − 5) and already renumbered so that module
  1 is most anterior and module 4 most posterior. That renumbering is what makes the fixed
  purple→cyan→yellow→red colour order meaningful.

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to `int` on load
- Values in this dataset: `[10, 34, 44, 49, 69]` — **unilateral** indices, 0-based, in 0–69
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`

### Atlas centroids

- `atlas.centroids['left']` and `atlas.centroids['right']`, each `(70, 3)`
- Columns are `(x, y, z)` in atlas voxel coordinates
- Concatenated **left first, then right** into a `(140, 3)` array

## Outputs

### `.npy` artifacts

**None.** This is an `ns_vis` recipe: it renders a figure and writes descriptive statistics, and
no other recipe in the set reads anything it produces. Its downstream set is empty.

### Figure and statistics

- `$SAVE_DIR/figure.png` — base script, 8×6 in, 300 dpi, `bbox_inches='tight'`
- `$SAVE_DIR/figure_refine.png` — refine script, same geometry
- `$SAVE_DIR/statistics.json` — **base script only**; the refine script dropped `import json`
  and the entire statistics block

## Indexing conventions

This is the fiddliest part of the recipe. Three separate numbering schemes are in play.

### 1. Unilateral atlas index (0–69)

What `Figure1_excluded_regions.npy` contains. 70 regions, one hemisphere.

### 2. Bilateral centroid index (0–139)

After `np.concatenate([left, right], axis=0)`:

```
index   0 ..  69  →  left  hemisphere, atlas region 0 .. 69
index  70 .. 139  →  right hemisphere, atlas region 0 .. 69
```

So **anatomical region `i` occupies bilateral indices `i` and `i + 70`**, and excluding region
`i` means clearing both. The scripts do exactly this:

```python
for region_id in excluded_regions:
    if region_id < N_regions_per_hemisphere:      # N_regions_per_hemisphere == 70
        exclusion_mask[region_id] = False                              # left
        exclusion_mask[region_id + N_regions_per_hemisphere] = False   # right
```

5 unilateral exclusions → 10 bilateral removals → 140 − 10 = **130** surviving centroids.
`statistics.json` records `excluded_regions_count: 10` (the bilateral count), computed as
`len(excluded_regions) * 2` rather than from the mask.

The `if region_id < 70` guard exists because the exclusion list is unilateral by construction;
an index ≥ 70 would be silently ignored rather than pairing to `i - 70`. (Contrast
`ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix`, which symmetrises in both
directions because its exclusion set is discovered on bilateral data.)

### 3. Post-exclusion contiguous index (0–129 / 0–64)

Both the filtered centroid array and the label vector are renumbered contiguously. Position 34
in either is **not** atlas region 34. Nothing in this recipe maps back to anatomy by index, so
the renumbering is only a hazard if you try to join these arrays against anything that uses the
original 0–69 numbering — reconstruct the original indices from the exclusion mask first.

### Label doubling

`bilateral_module_labels = np.concatenate([module_labels, module_labels])` → (130,).

This aligns with the bilateral centroid ordering only because both are left-block-then-right-
block with the same within-block region order. Each anatomical region therefore receives the
same module in both hemispheres **by construction** — the partition was computed once, on a
unilateral 65-region SC matrix. The apparent bilateral symmetry of the figure follows from
this, not from data.

Both scripts branch on the observed lengths:

| Condition | Action |
|---|---|
| `len(labels) == len(filtered_centroids) // 2` (base: `== expected_bilateral_count` test) | duplicate the labels — **the branch that fires** |
| `len(labels) == len(filtered_centroids)` | use as-is (labels already bilateral) |
| otherwise | base: `raise ValueError`; refine: silently duplicates anyway |

The refine script's silent fallback is a mild regression — a genuine mismatch would produce a
crash in the colour lookup or the scatter call rather than a clear error message.

### Coordinate transforms

| Transform | Formula | Reason |
|---|---|---|
| y flip | `y ← 974 - y` | Atlas y counts upward; `imshow` rows count downward. Applied once, to the concatenated array, before exclusion. `974` is the atlas image height, hard-coded. |
| side-view x | `x_plot = 359 - z` | Inverts the dorsoventral axis to match the clockwise-rotated projection. `359` is the rotated image width, hard-coded. |
| side-view y | `y_plot = y` | The already-flipped y, so both panels share the same vertical axis. |
| image rotation | `np.rot90(img, k=3)` | `k=3` is 270° CCW = 90° CW, putting the A-P axis vertical. |

The `centroid_ranges` recorded in `statistics.json` are measured on `filtered_centroids`, i.e.
**after** the y flip and **after** exclusion, but **before** the side-view z inversion.
