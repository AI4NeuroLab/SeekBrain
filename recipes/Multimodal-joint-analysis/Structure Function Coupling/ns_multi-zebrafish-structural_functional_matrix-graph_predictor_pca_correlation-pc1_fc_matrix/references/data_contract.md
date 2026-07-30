# Data contract — ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Region indexing convention](#region-indexing-convention)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads the FC matrix and the exclusion mask; writes `Figure2_SC_predictor_PC1.npy` |
| `ZEBRAFISH_PATH` | yes | `$ZEBRAFISH_PATH/Files/` holds both SC matrices |
| `ATLAS_PATH` | yes | Passed to `MapzebrainAtlas(ATLAS_PATH)` for region centroids |
| `SAVE_DIR` | yes | Writes the figure and `statistics.json`; `os.makedirs(SAVE_DIR, exist_ok=True)` is called |

All four are read with plain `os.getenv(...)` and none is validated. `SAVE_DIR` is the only one
whose directory is created. An unset variable becomes `None` and fails later inside
`os.path.join`.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
from zebrafish_Ca_utils_predictors_xps import Predictors   # reference implementation
from zebrafish_Ca_utils_predictors_xps import *            # figure-oriented implementation
```

These are **bundled** in `scripts/`, three modules for two import lines:

| Bundled module | Why it is here |
|---|---|
| `zebrafish_Ca_utils.py` | Imported directly, for `MapzebrainAtlas` |
| `zebrafish_Ca_utils_predictors_xps.py` | Imported directly, for `Predictors` |
| `zebrafish_Ca_utils_patch_xps.py` | **Transitive.** `zebrafish_Ca_utils_predictors_xps` begins with `from zebrafish_Ca_utils_patch_xps import *`; the import fails without it even though no script names it |

The `sys.path` line resolves all three against the script's own directory. The API contract
below is unchanged.

| Symbol | Signature as used | Contract |
|---|---|---|
| `MapzebrainAtlas` | `MapzebrainAtlas(ATLAS_PATH)` | Atlas handle |
| `MapzebrainAtlas.regionCentroids` | `atlas.regionCentroids['left']`, `atlas.regionCentroids['right']` | (70, 3) each. **`.regionCentroids`, not `.centroids`** — both members exist across this dataset and are not interchangeable. |
| `Predictors` | `Predictors(SC_directed_filtered, SC_undirected_filtered, distance_matrix_filtered)` — three positional args, each (65, 65) | Constructor. The exclusion list is not passed; matrices are filtered beforehand. |
| `Predictors.compute_predictors` | `model.compute_predictors(directed=True)` | Populates `model.predictors` in place |
| `Predictors.predictors` | attribute | (4225, 40) float — 65² ordered region pairs × 40 features |

Third-party: `sklearn.decomposition.PCA`, `scipy.stats.pearsonr`,
`scipy.spatial.distance.pdist`/`squareform`, `numpy`, `matplotlib`, `json`.

### Defined inline in the script (not external)

| Helper | Where | Note |
|---|---|---|
| `remove_excluded(matrix, excluded_indices)` | both scripts | Boolean keep-mask with a per-index bounds check (`if 0 <= idx < matrix.shape[0]`). The figure-oriented implementation adds a guard that returns the matrix untouched when `matrix.shape[0] <= len(excluded_indices)`. |
| `normalize_matrix(mat)` | both scripts | Min-max scaling of the finite entries to [0, 1], non-finite set to 0. Base and refine implementations differ cosmetically; both return a fresh array. Display use only. |

Neither helper is a library function — they travel with the reference scripts.

## Inputs

### `Figure1_FC_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy`
- Shape: `(65, 65)` float — **already post-exclusion**
- Content: group-average Pearson functional connectivity across 22 larvae
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`
- Not filtered again by this recipe. The reference implementation never touches it; the figure-oriented implementation has a
  conditional (`if FC_matrix.shape[0] != SC_directed_filtered.shape[0]`) that would filter it,
  but the condition is false on this data because both are 65.

### `SC_matrix_directed_terminals_expanded.npy` / `SC_matrix_undirected_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/`
- Shape: `(70, 70)` each, loaded `allow_pickle=True` then `.astype(float)` — **pre-exclusion**
- Content: terminal-expanded structural connectome, directed and symmetrised
- Produced by: upstream of this recipe set (raw dataset files)

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to int
- Values in this dataset: `[10, 34, 44, 49, 69]`
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- Fatal if missing: `np.load` raises. There is no fallback in either script here (unlike
  Figure 2J, which silently defaults).

### Atlas centroids

- `MapzebrainAtlas(ATLAS_PATH).regionCentroids['left' | 'right']`, averaged as
  `0.5 * (left + right)` → (70, 3), then `squareform(pdist(centroids, 'euclidean'))` with
  `np.fill_diagonal(..., 0.0)` → (70, 70), filtered to (65, 65)

## Outputs

### `Figure2_SC_predictor_PC1.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_SC_predictor_PC1.npy`
- Shape: `(65, 65)`, float64
- Content: `pca.fit_transform(model.predictors)[:, 0].reshape(65, 65)`, diagonal zeroed, then
  multiplied by `np.sign(pearson_r)` so it is positively oriented against FC. On this analysis the
  sign was already positive, so the multiplication was a no-op.
- **Not symmetric** — it derives from a directed predictor set. Only the upper triangle was
  validated against FC.
- Written by both the reference implementation and the figure-oriented implementation.

Consumed by:
- `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` (Figure 2L) — the only consumer.
  Note that consumer re-applies the exclusion mask to this already-65×65 matrix and analyses
  61 regions; see its data contract.

### Figure and statistics

- `$SAVE_DIR/figure.png` (reference implementation) / `$SAVE_DIR/figure_refine.png` (figure-oriented implementation), 300 dpi,
  `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — the output file is the figure-oriented implementation's two-field version
  (`pearson_r`, `pearson_p_value`). See `method_details.md` for the reference implementation's fuller dict.

## Region indexing convention

Three different indexing states coexist in this script and confusing them is the standing
hazard:

| Object | Regions | Indexing |
|---|---|---|
| Raw SC matrices, distance matrix, `Figure1_excluded_regions.npy` | 70 | Original 0-indexed atlas regions 0–69 |
| Filtered SC / distance, FC matrix, `Figure2_SC_predictor_PC1.npy` | 65 | Contiguously renumbered 0–64 |
| `model.predictors` rows | 4225 | Flattened 65×65 grid in C order: row `i*65 + j` = ordered pair (i → j), diagonal included |

The exclusion list is 0-indexed over the *original* 70 and is correct only when applied to
70×70 objects. After exclusion, index 34 is not atlas region 34, and index 69 does not exist.

The figure displays 1-indexed labels (`'1'` and `'65'`) on the y-axis while the data are
0-indexed internally.

Bilateral pairing: the centroid averaging step `0.5 * (left + right)` collapses each region's
two hemispheres into one midline point before distances are computed, so there is no `i` /
`i+70` pairing in any matrix here — all 70 entries are already bilateral aggregates.
