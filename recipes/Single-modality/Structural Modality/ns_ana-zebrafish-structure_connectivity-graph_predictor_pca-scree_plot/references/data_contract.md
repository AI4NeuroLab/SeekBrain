# Data contract — ns_feat-zebrafish-sc-pca-predictor_dimensionality

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Region indexing convention](#region-indexing-convention)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes | `$ZEBRAFISH_PATH/Files/` holds both SC matrices |
| `ATLAS_PATH` | yes | Passed to `MapzebrainAtlas(ATLAS_PATH)` for region centroids |
| `PROCESS_DATA_DIR` | yes | Reads the exclusion mask; writes the explained-variance artifact |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and (base script only) `statistics.json` |

All four are read with plain `os.getenv(...)` and **not validated**. An unset variable yields
`None` and the script dies later inside `os.path.join` with a `TypeError` that names the wrong
thing. Check them before running.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
from zebrafish_Ca_utils_predictors_xps import Predictors   # base script
from zebrafish_Ca_utils_predictors_xps import *            # refine script
```

Both modules are **bundled** in `scripts/`, and a third rides along:

| Bundled module | Why it is here |
|---|---|
| `zebrafish_Ca_utils.py` | Imported directly, for `MapzebrainAtlas` |
| `zebrafish_Ca_utils_predictors_xps.py` | Imported directly, for `Predictors` |
| `zebrafish_Ca_utils_patch_xps.py` | **Transitive.** `zebrafish_Ca_utils_predictors_xps` opens with `from zebrafish_Ca_utils_patch_xps import *`, so the import fails without it despite no script naming it |

The `sys.path` line resolves all three against the script's own directory. The API contract
below is unchanged — it describes the same code, now sitting locally.

| Symbol | Signature as used | Contract |
|---|---|---|
| `MapzebrainAtlas` | `MapzebrainAtlas(ATLAS_PATH)` | Atlas handle |
| `MapzebrainAtlas.regionCentroids` | `atlas.regionCentroids['left']`, `atlas.regionCentroids['right']` | Each a (70, 3) array of per-region centroid coordinates for that hemisphere. **`.regionCentroids`, not `.centroids`** — both members exist across this dataset and are not interchangeable. |
| `Predictors` | `Predictors(sc_directed, sc_undirected, distance)` — three positional args, all (65, 65) post-exclusion | Constructor. No keyword arguments are used; the excluded-region list is *not* passed to the constructor, the matrices are filtered beforehand. |
| `Predictors.compute_predictors` | `model.compute_predictors(directed=True)` | Populates `model.predictors` in place; returns nothing the script uses |
| `Predictors.predictors` | attribute | (n_regions², n_features) = (4225, 40) float array |

Third-party: `sklearn.decomposition.PCA`, `scipy.spatial.distance.pdist`/`squareform`,
`numpy`, `matplotlib`.

### Defined inline in the script (not external)

| Helper | Where | Note |
|---|---|---|
| `remove_excluded_regions(matrix, excluded_indices)` | both scripts | Boolean keep-mask, applied to rows then columns. Returns the input unchanged when `excluded_indices` is empty. It does **not** bounds-check the indices — safe here only because the SC matrices are still 70×70 when it is called. |

## Inputs

### `SC_matrix_directed_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/SC_matrix_directed_terminals_expanded.npy`
- Shape: `(70, 70)`, loaded `allow_pickle=True` then `.astype(float)`
- Content: terminal-expanded directed structural connectome, **pre-exclusion** (all 70 atlas
  regions present)
- Produced by: upstream of this recipe set (raw dataset file)

### `SC_matrix_undirected_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy`
- Shape: `(70, 70)`, same load path
- Content: symmetrised version of the same connectome

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to int
- Values in this dataset: `[10, 34, 44, 49, 69]`
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- If absent: the base script falls back to `np.array([10])` and the refine script to an empty
  array. Both fallbacks yield a wrong-sized predictor matrix without raising.

### Atlas centroids

- Source: `MapzebrainAtlas(ATLAS_PATH).regionCentroids['left' | 'right']`
- Combined as `centroids = 0.5 * (left + right)` → (70, 3)
- Turned into a (70, 70) Euclidean distance matrix with zeroed diagonal

## Outputs

### `Figure2_SC_predictor_PCA_expvar.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_SC_predictor_PCA_expvar.npy`
- Shape: `(10,)`, float64
- Content: `pca.explained_variance_ratio_` for PCs 1–10 — the **per-component** ratios, not the
  cumulative sum. A consumer wanting cumulative values must call `np.cumsum` itself.
- Written by both the base and the refine script, identically.

Consumed by: no other recipe in this set reads this file. It is the terminal artifact of the
Figure 2J panel. The 2J→2K→2L chain is joined by *recomputation*, not by this file — 2K
rebuilds the same predictor matrix and PCA from scratch and writes
`Figure2_SC_predictor_PC1.npy`.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base script), `$SAVE_DIR/figure_refine.png` (refine script), 300 dpi,
  `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — **base script only**. The refine script does not import `json`
  and writes no statistics.

## Region indexing convention

The SC matrices and the atlas centroids are both 0-indexed over the original 70 atlas regions,
so `Figure1_excluded_regions.npy` (0-indexed, values 0–69) applies to them directly. This is
the correct stage at which to apply the exclusion.

After exclusion the surviving 65 regions are **renumbered contiguously** 0–64. Index 34 in the
filtered matrix is not atlas region 34. Any attempt to re-apply the same exclusion list to a
post-exclusion matrix is a bug — index 69 no longer exists, and indices 10/34/44/49 now point
at different anatomy. `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` does exactly
this; see its Pitfalls.

The predictor matrix rows are the flattened 65×65 grid in C order, i.e. row `i*65 + j`
describes the ordered pair (region i → region j), diagonal included. `PC1.reshape(65, 65)`
downstream depends on that ordering.
