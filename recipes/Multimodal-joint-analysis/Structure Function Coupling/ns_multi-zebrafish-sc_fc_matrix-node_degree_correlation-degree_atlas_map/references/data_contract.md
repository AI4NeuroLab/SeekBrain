# Data contract — ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads the FC matrix and the exclusion mask; writes both degree artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png`, and `statistics.json` (reference implementation only) |
| `ZEBRAFISH_PATH` | yes | Root containing `Files/SC_matrix_undirected_terminals_expanded.npy` |
| `ATLAS_PATH` | yes | Passed to `MapzebrainAtlas(ATLAS_PATH)` |

None of the four is validated. `os.makedirs(SAVE_DIR, exist_ok=True)` fails first if `SAVE_DIR`
is unset; the others surface as `TypeError` inside `os.path.join`. Unlike the sibling
`degree_coupling` recipe, this script has **no** hard-coded dead default for `ZEBRAFISH_PATH` —
it reads the env var straight.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
```

The module is **bundled**, not external: `scripts/zebrafish_Ca_utils.py` sits next to both
implementations, and the `sys.path` line resolves the import against that directory. It is the
only library module this recipe carries — one file, because `MapzebrainAtlas` is the only symbol
either script pulls in.

| Symbol | Signature as used | Contract |
|---|---|---|
| `MapzebrainAtlas` | `MapzebrainAtlas(ATLAS_PATH)` | Constructed from the atlas directory path |

### Atlas members used

| Member | Type / shape | Use |
|---|---|---|
| `.regionCentroids['left']` | (70, 3) array-like, x/y/z voxel coordinates | Left-hemisphere region centroids |
| `.regionCentroids['right']` | (70, 3) | Right-hemisphere region centroids |
| `.XYprojection` | 2-D image array | Dorsal (top-down) atlas background, drawn with `cmap='binary'` |

**This script uses `.regionCentroids`, not `.centroids`.** Both members exist on
`MapzebrainAtlas` and both are used across this dataset in different figures. They are not
interchangeable — substituting `.centroids` produces marker positions that are wrong without
raising anything. If you adapt this script, keep the member name.

`.XZprojection` and `.YZprojection` are not used; this is a single-view figure.

### Helpers defined inline

None. Every computation is plain `numpy` / `scipy.stats.zscore` / `matplotlib`. Nothing beyond
`MapzebrainAtlas` is an external dependency.

The reference implementation imports `scipy.stats.zscore` but never calls it — it z-scores manually with an
explicit `+1e-10` denominator guard. The figure-oriented implementation actually uses `zscore`.

## Inputs

### `SC_matrix_undirected_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy`
- Shape: `(70, 70)`, float; loaded with a plain `np.load` (no `allow_pickle`)
- Content: symmetric terminal-expanded structural connectome, zero diagonal
- Not produced by any recipe in this set — raw dataset input
- The directed sibling `SC_matrix_directed_terminals_expanded.npy` is **not** a valid
  substitute: row sums of a directed matrix are out-degrees, not total degree

### `Figure1_FC_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy`
- Shape: `(65, 65)` — **already post-exclusion**
- Content: group-average Pearson FC across 22 larvae, unit diagonal
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`
- The per-larva stack `Figure1_FC_matrices.npy` is a different file and would not fit the
  2-D assumptions here

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to int
- Values in this dataset: `[10, 34, 44, 49, 69]`
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- 0-based indices into the original 70-region atlas ordering

## Outputs

### `Figure2_Node_degree_SC.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_Node_degree_SC.npy`
- Shape: `(65,)`, float
- Content: weighted structural degree, `np.sum(SC_filtered, axis=1)`, then `nan_to_num`.
  The SC diagonal is **not** explicitly zeroed by this script.
- Range for the recorded dataset: `[4.069, 45.101]`, mean 30.280

### `Figure2_Node_degree_FC.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_Node_degree_FC.npy`
- Shape: `(65,)`, float
- Content: `np.sum(np.abs(FC_with_zero_diagonal), axis=1)`, then `nan_to_num`.
  **Absolute value** — negative correlations contribute positively to the degree.
- Range for the recorded dataset: `[9.162, 36.202]`, mean 26.371

### Filename collision — read this

`ns_multi-zebrafish-sc_ca-linregress-degree_coupling` (source `Done-Figure2F-185422`) writes the
**same two filenames** to the **same directory**, but its FC degree is
`np.sum(np.maximum(FC, 0), axis=1)` — the positive part, not the absolute value. The two
definitions coincide only where FC has no negative edges. Evidence from the recorded outputss:

| Artifact | this recipe (2E) | degree_coupling (2F) |
|---|---|---|
| FC degree min | 9.162 | 8.704 |
| FC degree max | 36.202 | 36.202 |
| SC degree min / max | 4.069 / 45.101 | 4.069 / 45.101 |

The SC vectors agree exactly. The FC vectors do not. Whichever run executed most recently owns
the file on disk. Track source tracking, or redirect one of the two to distinct names.

No recipe in this 30-run set reads either artifact — they are terminal outputs.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `figure_refine.png` (refine), 300 dpi, `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — written by the **reference implementation only**. The figure-oriented implementation omits the
  statistics block entirely, so re-running only the figure-oriented implementation leaves no numeric record.

## Indexing conventions

- Exclusion indices are 0-based over the original **70** regions.
- The SC matrix is filtered with a boolean keep-mask on both axes; the FC matrix is left alone
  because it arrives at 65. After filtering, the 65 survivors are **renumbered contiguously**
  0–64 — index 34 in a degree vector is not atlas region 34. Recover the original ordering with
  `np.arange(70)[keep_mask]`.
- **Bilateral centroid layout.** `left_centroids` and `right_centroids` are concatenated into a
  (140, 3) array where rows 0–69 are the left hemisphere and rows 70–139 are the right, and
  region `i` on the left pairs with row `70 + i` on the right. The exclusion mask is therefore
  applied twice:

  ```python
  keep_mask_bilateral[excluded_regions] = False        # left  copy
  keep_mask_bilateral[70 + excluded_regions] = False   # right copy
  ```

  yielding 130 rows.
- **The post-filter split point is 65, not 70.** `centroids_filtered[:65]` is the left
  hemisphere and `centroids_filtered[65:]` the right. Splitting at 70 would put five right-brain
  regions into the left group with no error raised — the reference implementation asserts
  `centroids_filtered.shape[0] == 130` as a guard against exactly this.
- **Y-coordinate flip.** `centroids_all[:, 1] = 974 - centroids_all[:, 1]` converts the atlas
  y-axis to the image row convention (origin at top) so markers land on the anatomy. The
  constant `974` is a literal, not derived from `xy_projection.shape[0]`; it is silently wrong
  on a differently sized atlas volume.
- The z-coordinate `centroids[:, 2]` is loaded but unused — this is a 2-D dorsal projection.
