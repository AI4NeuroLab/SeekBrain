# Data contract — ns_multi-zebrafish-sc_ca-graph_predictors-fc_variance_explained

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads FC and the exclusion mask; writes all four predictor artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json` |
| `ZEBRAFISH_PATH` | **yes, and must be set explicitly** | Root containing `Files/SC_matrix_{directed,undirected}_terminals_expanded.npy` |
| `ATLAS_PATH` | optional | Passed to `MapzebrainAtlas`. **Defaults to `os.path.join(ROOT_DIR, "Atlas")`** |

```python
ROOT_DIR   = os.getenv("ZEBRAFISH_PATH",
                       "<data-root>")
ATLAS_PATH = os.getenv("ATLAS_PATH", os.path.join(ROOT_DIR, "Atlas"))
```

Two things worth flagging:

1. The `ZEBRAFISH_PATH` fallback is under the dead mount. It is a `getenv` default rather than a
   raise, so an unset variable fails late, inside `np.load`, naming a path that never existed on
   this machine.
2. **`ATLAS_PATH` is derived from `ZEBRAFISH_PATH` when unset** — this is the only script in the
   set that chains one env var off another. If `ZEBRAFISH_PATH` is also unset, the atlas path is
   built from the dead default and the error surfaces from `MapzebrainAtlas`, several steps away
   from the actual cause.

Neither `PROCESS_DATA_DIR` nor `SAVE_DIR` is validated. Notably, this script does **not** call
`os.makedirs(SAVE_DIR, exist_ok=True)` — unlike its siblings — so `SAVE_DIR` must already exist
or the final `plt.savefig` fails after the entire (expensive) predictor computation has run.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
from zebrafish_Ca_utils_predictors_xps import Predictors          # reference implementation
from zebrafish_Ca_utils_predictors_xps import *                   # figure-oriented implementation
```

These modules are **bundled**, not external. `scripts/` carries three files:

| Bundled module | Why it is here |
|---|---|
| `zebrafish_Ca_utils.py` | Imported directly, for `MapzebrainAtlas` |
| `zebrafish_Ca_utils_predictors_xps.py` | Imported directly, for `Predictors` |
| `zebrafish_Ca_utils_patch_xps.py` | **Transitive.** `zebrafish_Ca_utils_predictors_xps` begins with `from zebrafish_Ca_utils_patch_xps import *`, so the import fails without it even though no script mentions it by name |

Three modules for two import lines — the count is not readable off the imports alone. The
`sys.path` line resolves all of them against the script's own directory.

This recipe is still the most library-dependent of the Figure-2 structure–function runs: the ~40
predictors exist only inside `Predictors`, so the bundled copy is what makes the numbers below
meaningful.

### `zebrafish_Ca_utils_predictors_xps.Predictors` — API surface

Three recipes depend on this class (`fc_variance_explained`, `predictor_dimensionality`,
`pca_pc1-fc_prediction`). The following is everything exercised across all three runs.

**Constructor**

```python
Predictors(A_dir, A_und, ED, excluded=None, directed=True)
```

| Argument | Type | Meaning |
|---|---|---|
| `A_dir` | (N, N) float | Directed structural adjacency, already pruned to the analysis regions |
| `A_und` | (N, N) float | Undirected (symmetric) structural adjacency, same N |
| `ED` | (N, N) float | Euclidean distance between region centroids, zero diagonal |
| `excluded` | list/array or `None` | Region indices to prune *inside* the class. Pass `None` when the caller has already pruned — passing the list again double-prunes |
| `directed` | bool | Whether the directed matrix should be treated as directed |

Called two ways across the set: with keywords and `excluded=None, directed=True` here, and
positionally as `Predictors(A_dir, A_und, ED)` in `pca_pc1-fc_prediction` and
`predictor_dimensionality`, which shows `excluded` and `directed` both have workable defaults.

**Computation**

```python
model.compute_predictors(directed=True)
```

Populates the object in place; returns nothing that any caller uses. `directed=True` in all
three runs — it enables the in/out/all directed variants, so `directed=False` would change both
the predictor count and the names.

**Attributes, available only after `compute_predictors`**

| Attribute | Type / shape | Notes |
|---|---|---|
| `.predictors_names` | list of 40 `str` | Human-readable labels, e.g. `"Shortest path"`, `"Matching ind. (all)"`, `"Adjacency"`, `"Search information"`, `"Mean first passage time"`, `"Communicability"` |
| `.predictors_list` | list of 40 arrays, each (N, N) | One predictor matrix per name, same order as `.predictors_names` |
| `.predictors` | (N², 40) float | The same 40 predictors, each flattened over the **full** matrix (not the upper triangle) and stacked as columns. Verified at `(4225, 40)` for N=65 in the `predictor_dimensionality` and `pca_pc1` runs |

`.predictors_list` and `.predictors` are two views of the same data: use `.predictors_list` for
per-predictor edgewise correlation (this recipe), `.predictors` for multivariate methods like PCA
(the two downstream recipes). N² = 4225 for N = 65 confirms `.predictors` uses the full matrix,
including the diagonal and both triangles, so it double-counts symmetric predictors — fine for
PCA, wrong for a correlation count.

Predictor matrices may contain non-finite entries (an unreachable pair has infinite shortest
path), which is why every consumer masks with `np.isfinite` before correlating.

### `zebrafish_Ca_utils.MapzebrainAtlas`

| Member | Type / shape | Use |
|---|---|---|
| `MapzebrainAtlas(ATLAS_PATH)` | constructor | |
| `.regionCentroids['left']` | (70, 3) | Left-hemisphere region centroids |
| `.regionCentroids['right']` | (70, 3) | Right-hemisphere region centroids |

**This script uses `.regionCentroids`, not `.centroids`.** Both members exist and both are used
across this dataset in different figures. They are not interchangeable — substituting `.centroids`
changes every inter-regional distance and therefore every distance-derived predictor, with no
error raised. No projection member (`.XYprojection` etc.) is used; this recipe draws no anatomy.

### Helpers defined inline

None. Beyond `Predictors` and `MapzebrainAtlas` everything is `numpy`,
`scipy.stats.pearsonr`, `scipy.spatial.distance.{pdist, squareform}`, and `matplotlib`.

## Inputs

### `Figure1_FC_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy`
- Shape: `(65, 65)` — **already post-exclusion**
- Content: group-average Pearson FC across 22 larvae, unit diagonal (zeroed by this script)
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`

### `SC_matrix_directed_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/SC_matrix_directed_terminals_expanded.npy`
- Shape: `(70, 70)`, asymmetric
- Passed to `Predictors` as `A_dir`. Not raw dataset output of any recipe here.

### `SC_matrix_undirected_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy`
- Shape: `(70, 70)`, symmetric
- Serves **two** roles: `A_und` for the predictor computation, and the reference implementationline against which
  every ΔR² is measured. Both matrices are required; there is no single-file variant of this
  analysis.

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to int; values `[10, 34, 44, 49, 69]`
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- 0-based indices into the original 70-region atlas ordering

### Atlas centroids (not a file path in this script)

Retrieved through `MapzebrainAtlas(ATLAS_PATH)`; see the API table above.

## Outputs

### `Figure2_SC_predictor_names.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_SC_predictor_names.npy`
- Shape: `(40,)`, `dtype=object` — a numpy object array of Python strings
- Requires `allow_pickle=True` to read back, since it is an object array
- The definitive record of what each position in the other three artifacts means

### `Figure2_SC_predictors.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_SC_predictors.npy`
- Shape: `(40,)`, `dtype=object`, each element a `(65, 65)` float array
- Built from `np.array(predictor_matrices, dtype=object)` on `.predictors_list`
- Requires `allow_pickle=True` to read back
- Note this is **not** the `(4225, 40)` `.predictors` matrix — that flattened form is what the
  PCA recipes use, and it is never saved here

### `Figure2_SC_predictor_rsquared_single.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_SC_predictor_rsquared_single.npy`
- Shape: `(40,)`, float
- Squared Pearson r between FC and each predictor over the 2080 upper-triangle edges
- Range for the recorded dataset: `[0.1132, 0.4214]`

### `Figure2_SC_predictor_rsquared_baseline.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_SC_predictor_rsquared_baseline.npy`
- Shape: **scalar** (0-d array) — `np.save` of a Python float
- Value for the recorded dataset: `0.3224725309974822`

None of the four is read by any other recipe in this 30-run set. The predictor family's other two
recipes recompute `Predictors` from scratch rather than loading these files, which means all three
must agree on the exclusion list or their predictor matrices diverge silently.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `figure_refine.png` (refine), 300 dpi, `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — the output file is the **refine** script's two-key dict. The
  reference implementation's version, which included `predictor_names`, `predictor_correlations` and
  `predictor_rsquared`, was overwritten. See `method_details.md`.

## Indexing conventions

- Exclusion indices are 0-based over the original **70** regions.
- **Filtering direction is decided at runtime.** The reference implementation sets
  `fc_already_filtered = (n_regions_fc < n_regions_atlas)`. Because FC is 65 and the atlas is 70,
  it takes the "FC already filtered" branch and applies the keep-mask to `sc_directed`,
  `sc_undirected` and `distance_matrix_full` instead — leaving FC untouched. The `else` branch
  (filter everything, including a bounds check on the exclusion indices) never executes here.
- The figure-oriented implementation restructures this: it always filters SC and distance, then separately
  branches on `n_fc == n_atlas` / `n_fc == sum(keep_mask)` / neither for FC. Same outcome.
- After filtering, the 65 survivors are **renumbered contiguously** 0–64. Index 34 in a predictor
  matrix is not atlas region 34. Recover the original ordering with `np.arange(70)[keep_mask]`.
- **Bilateral centroid averaging**: `centroids_full = 0.5 * (regionCentroids['left'] +
  regionCentroids['right'])`, element by element, giving one (70, 3) array. This assumes
  `left[i]` and `right[i]` are the same anatomical region in the same order — true for this
  atlas, and load-bearing: a mismatch would place each region at the midpoint of two unrelated
  structures. There is no `i` / `i+70` concatenation here, unlike
  `ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map`, which stacks the hemispheres instead of
  averaging them.
- Distance is Euclidean in atlas voxel units, computed on the averaged centroids, with the
  diagonal explicitly zeroed after `squareform`.
- `np.triu_indices(65, k=1)` gives **2080** unique edges. Every R² in this recipe is computed over
  that same edge set, so the 40 predictors and the reference implementationline are directly comparable.
- The finite mask is recomputed per predictor (`np.isfinite(fc) & np.isfinite(pred)`), so a
  predictor with a few infinite entries loses those edges only, not the whole comparison. This
  makes the R² values technically computed on slightly different edge subsets — a caveat worth
  keeping in mind when the differences are small.
