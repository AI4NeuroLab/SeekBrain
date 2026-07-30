# Data contract — ns_vis-zebrafish-ca_atlas-edge_projection-fc_network_map

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads `Figure1_FC_matrix.npy` and `Figure1_excluded_regions.npy`. Nothing is written here |
| `SAVE_DIR` | yes | Writes `figure.png` and `statistics.json`; `os.makedirs(..., exist_ok=True)` on it |
| `ATLAS_PATH` | yes | Passed to the `MapzebrainAtlas` constructor |
| `ZEBRAFISH_PATH` | no | **Not used.** No raw larva data is opened |

No variable is validated. `os.makedirs(SAVE_DIR, exist_ok=True)` raises `TypeError` if
`SAVE_DIR` is unset; `PROCESS_DATA_DIR` and `ATLAS_PATH` fail slightly later in `os.path.join`
and in the atlas constructor. There is no explicit `ValueError` guard.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
```

The library is bundled, not external: `scripts/zebrafish_Ca_utils.py` is the one module this
recipe carries, and the `sys.path` line above resolves the import to it. The API contract below
is unchanged.

| Symbol | Signature as used | Contract |
|---|---|---|
| `MapzebrainAtlas` | `MapzebrainAtlas(ATLAS_PATH)` | Atlas handle |
| `MapzebrainAtlas.centroids` | `atlas.centroids['left']`, `atlas.centroids['right']` | Each `(70, 3)` float, columns `(x, y, z)` in atlas voxel coordinates; concatenation produces `(140, 3)`. |
| `MapzebrainAtlas.XYprojection` | `imshow(atlas.XYprojection, ...)` | 2-D top-view anatomical background |
| `MapzebrainAtlas.XZprojection` | `imshow(np.rot90(atlas.XZprojection, k=3), ...)` | 2-D sagittal background, rotated 90° clockwise before display |

**This recipe uses `.centroids`, not `.regionCentroids`.** Both members exist on the class and
both are used across this dataset in different figures. They are not interchangeable — swapping
them here would move every node. If you adapt this script, check which one the source figure
used rather than assuming.

`getRegionMask` is **not** used — the backgrounds come from the precomputed projection
attributes, not from per-region masks. (The composite region projections written by
`ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`,
`Figure1_projection_regions_top/side.npy`, are a *different* pair of images and are not read
here.)

Third-party imports: `numpy`, `matplotlib.pyplot`, `matplotlib.collections.LineCollection`.
Standard library: `os`, `sys`, `json`.

No helper function is defined inline; the script is straight-line code.

## Inputs

### `Figure1_FC_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy`
- Shape: `(65, 65)`, float.
- Content: group-averaged Pearson FC over the 65 surviving regions, `np.nanmean` across 22
  larvae
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`
- **Must already be exclusion-filtered.** The script does not reduce it. The 130-vs-130 assert
  is the only thing that would catch a 70×70 input, and only because tiling would give 140.
- **Its diagonal is NaN or exactly 0.** Not stated anywhere in the source, but provable from the
  edge counts: 130 nodes give `130 × 129 / 2 = 8385` upper-triangle pairs and the run kept
  8320, exactly 65 fewer. Those 65 are precisely the `(i, i + 65)` pairs whose tiled weight is
  `fc_matrix[i, i]`, and they were removed by the `not np.isnan(weight) and weight != 0`
  filter. Any consumer relying on a unit diagonal will be wrong.

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, loaded with `.astype(int)`; values `[10, 34, 44, 49, 69]`
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- Fatal if missing — plain `np.load`, no `os.path.exists` guard
- Applied **only to the centroids**, never to the FC matrix

## Outputs

### `$SAVE_DIR/figure.png`

Write the atlas overlay to `figure.png` at 300 dpi with `bbox_inches='tight'`.

### `$SAVE_DIR/statistics.json`

Descriptive metadata about the rendering, not new measurements. See `method_details.md` for
the schema and recorded values.

### `.npy` artifacts

**None.** This is a pure `ns_vis` recipe — it consumes artifacts and produces only a figure.
No downstream recipe depends on it, so it is safe to re-run, re-style, or skip entirely when
only numbers are needed.

## Indexing conventions

This is the recipe where the bilateral index convention is easiest to get wrong. Four distinct
index spaces appear:

1. **Atlas region space, 0–69.** `Figure1_excluded_regions.npy` lives here. So do the rows of
   `atlas.centroids['left']` and `atlas.centroids['right']`, independently — row `i` of each is
   the same anatomical region in the opposite hemisphere.
2. **Bilateral pre-exclusion space, 0–139.** `np.concatenate([left, right], axis=0)` makes
   index `i` the left copy and index `i + 70` the right copy of region `i`. **The offset is 70,
   the per-hemisphere atlas size — not 65.** The script computes it as
   `num_regions_per_hemisphere = centroids_left.shape[0]`, which is the robust way to write it.
3. **FC space, 0–64.** `Figure1_FC_matrix.npy` rows are the 65 survivors, renumbered
   contiguously. Row 34 here is *not* atlas region 34.
4. **Bilateral post-exclusion space, 0–129.** After
   `keep_mask[excluded_indices_bilateral] = False`, the surviving centroids are the 65 left
   survivors followed by the 65 right survivors, in original order. **Here the offset is 65.**

The correspondence that makes the figure work: after step 4, node `k` (for `k < 65`) is the
left copy of FC row `k`, and node `k + 65` is the right copy of the same FC row. `np.tile(fc,
(2, 2))` produces exactly that mapping, since `fc_bilateral[a, b] = fc_matrix[a % 65, b % 65]`.
The two offsets — 70 before exclusion, 65 after — are the trap. Mixing them puts nodes in the
wrong hemisphere without any error.

The bounds check matters for the same reason:

```python
excluded_indices_left  = excluded_regions[excluded_regions < num_regions_per_hemisphere]
excluded_indices_right = excluded_regions[excluded_regions < num_regions_per_hemisphere] + num_regions_per_hemisphere
```

Without the `< 70` filter, an out-of-range index would be offset into the right hemisphere's
index range and quietly delete the wrong node instead of raising.

### Coordinate conventions

- `centroids[:, 0]` = x, `[:, 1]` = y, `[:, 2]` = z, in atlas voxels.
- **y is flipped once, in place, on the concatenated array**: `centroids_full[:, 1] = 974 -
  centroids_full[:, 1]`. Everything after this point — top view, side view, and the
  `centroid_statistics.y_mean` of 463.68 in `statistics.json` — uses the flipped value. The
  flip happens *before* exclusion filtering, so it applies to all 140 rows.
- **z is inverted per view, not in place**: the side panel uses `359 - z` on a `.copy()`. The
  stored `centroid_statistics.z_mean` of 149.18 is the *un*-inverted z.
- The side background is rotated with `np.rot90(..., k=3)` — `k=3` is 90° clockwise. The z
  inversion is what makes the nodes line up with that rotation; changing one without the other
  mirrors the network against the anatomy.
- Both panels set `ylim = [850, 50]`, i.e. inverted, so anterior is at the top. Note that
  `statistics.json` records `top_view_y_range: [50, 850]` — ascending — while the code sets the
  axis descending. Same extent, opposite convention in the record.
