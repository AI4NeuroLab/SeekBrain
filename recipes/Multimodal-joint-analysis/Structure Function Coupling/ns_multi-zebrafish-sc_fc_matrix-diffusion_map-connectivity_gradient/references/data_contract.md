# Data contract — ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions that could be misread](#indexing-conventions-that-could-be-misread)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads `Figure1_FC_matrix.npy` and `Figure1_excluded_regions.npy`; writes all four gradient/eigenvalue artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` and `statistics.json` |
| `ATLAS_PATH` | yes | Passed to `MapzebrainAtlas(ATLAS_PATH)` |
| `ZEBRAFISH_PATH` | effectively yes | Root of the SC matrix path. **Has a hard-coded default** — see below |

```python
ZEBRAFISH_PATH = os.getenv(
    "ZEBRAFISH_PATH",
    "<data-root>"
)
```

That default is a dead **data** path (unrelated to the library code, which is now vendored — see
below — and unaffected). Leaving the variable unset does not raise at startup; the
script proceeds until `os.path.exists(sc_path)` fails and reports
`FileNotFoundError: SC matrix not found at <dead path>`. Set it explicitly. Two other recipes
share this defect: `ns_vis-zebrafish-sc_atlas-edge_projection-sc_network_map` and
`ns_multi-zebrafish-sc_ca-linregress-degree_coupling`.

The other three variables are read with a bare `os.getenv` and are not validated;
`os.makedirs(SAVE_DIR, exist_ok=True)` raises `TypeError` if `SAVE_DIR` is unset.

## Library dependencies

Two separate dependency families. Keep them apart when planning an environment.

### External package (installable)

```python
from brainspace.gradient.embedding import diffusion_mapping
```

`brainspace` is a published third-party neuroimaging package (pip `brainspace`). It is **not**
part of the custom zebrafish library and is therefore not vendored into `scripts/` — it must be
pip-installed like the rest of the scientific stack. This is the only recipe in the 30-recipe set
that uses it.

| Symbol | Signature as used | Contract |
|---|---|---|
| `diffusion_mapping` | `diffusion_mapping(matrix, n_components=k, alpha=0.5)` | `matrix` is a square (N, N) affinity/connectivity matrix. Returns `(modes, eigenvalues)`: `modes` is (N, k) — **regions × components**, one column per gradient — and `eigenvalues` is (k,). Internally requests `k + 1` eigenvectors via `scipy.sparse.linalg.eigsh`; if `k + 1 >= N` it warns and falls back to dense `scipy.linalg.eigh`. That fallback fires for the recorded dataset. |

### Custom library (vendored — bundled in `scripts/`)

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
```

This recipe bundles exactly one library module: `scripts/zebrafish_Ca_utils.py`. The `sys.path`
line points at the script's own directory, so the import resolves with no external setup —
nothing has to be supplied. Rewriting that line is the only change made to the script.

| Symbol | Members used | Contract |
|---|---|---|
| `MapzebrainAtlas` | `MapzebrainAtlas(ATLAS_PATH)` | Constructed once |
| | `.centroids['left']`, `.centroids['right']` | (70, 3) float arrays of regional centroid coordinates, columns `(x, y, z)`, one row per atlas region, in atlas index order |
| | `.XYprojection` | 2-D top-view background image |
| | `.XZprojection` | 2-D side-view background image, rotated at plot time |

**This recipe uses `.centroids`, not `.regionCentroids`.** Both members exist and both are used
across this dataset in different figures. They are not interchangeable.

`MapzebrainAtlas` is needed only for the figure. The four `.npy` artifacts can be produced
without it.

### Standard library / scientific stack

`os`, `sys`, `json`, `numpy`, `matplotlib.pyplot`,
`matplotlib.colors.LinearSegmentedColormap`, `scipy.stats.pearsonr`.

### Helpers defined inline in the script

Neither of these is an import. They are three-line local functions in
`scripts/reference_implementation.py` and travel with it:

```python
def double_vector(vec):
    return np.concatenate([vec, vec])

def create_blue_white_cmap():
    color = [72/255, 184/255, 208/255]
    return LinearSegmentedColormap.from_list("blue_white", [[1, 1, 1], color])
```

`double_vector` mirrors a per-region gradient vector onto the bilateral centroid list;
`create_blue_white_cmap` builds the white→cyan-blue colormap used for the two matrix panels.
Do not list either as an external dependency.

## Inputs

### `Figure1_FC_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy`
- Shape: `(65, 65)`, float — group-average Pearson FC over 22 larvae, **already
  exclusion-filtered** to 65 regions
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`
- Cleaned on load: `np.nan_to_num(nan=0.0, posinf=0.0, neginf=0.0)` then
  `np.fill_diagonal(..., 0.0)`

### `SC_matrix_undirected_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy`
- Shape: `(70, 70)`, float — undirected, terminal-expanded structural connectome, **all 70
  regions, unexcluded**
- Not produced by any recipe in this set; it ships with the dataset
- Fatal if missing: explicit `FileNotFoundError` with the resolved path
- Cleaned identically to the FC matrix

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to `int` on load
- Values in this dataset: `[10, 34, 44, 49, 69]` — retina (10) plus four regions failing the
  sampling-density threshold
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`

## Outputs

### `Figure6_SC_gradients.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_SC_gradients.npy`
- Shape: `(69, 65)` — **components × regions**, after row deletion and transpose
- Row 0 is gradient 1, row 1 is gradient 2. Column *j* is the *j*-th surviving region in
  post-exclusion order.

Consumed by:
- `ns_multi-zebrafish-sc_ca-hungarian_matching-gradient_correspondence`

### `Figure6_SC_eigenvalues.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_SC_eigenvalues.npy`
- Shape: `(69,)`, float. **Not** trimmed for excluded regions — eigenvalues belong to
  components, not regions, so the exclusion never touches them.
- Contains negative values (min −0.1867, mean −0.005007)

Consumed by:
- `ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot`

### `Figure6_FC_gradients.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_FC_gradients.npy`
- Shape: `(64, 65)` — components × regions, transposed only (no row deletion; the FC matrix
  was already filtered upstream)

Consumed by:
- `ns_multi-zebrafish-sc_ca-hungarian_matching-gradient_correspondence`

### `Figure6_FC_eigenvalues.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_FC_eigenvalues.npy`
- Shape: `(64,)`, float. Mean −0.012640; contains negative values.

Consumed by:
- `ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot`

### Figure and statistics

- `$SAVE_DIR/figure.png`, 300 dpi, `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — 19 fields, listed verbatim in `method_details.md`

## Indexing conventions that could be misread

- **Gradients are stored components-first.** `Figure6_*_gradients.npy` is (components,
  regions) after the transpose. `diffusion_mapping` returns the opposite orientation
  (regions, components); the transpose is applied before saving. Loading the artifact and
  transposing again is a common way to get 65 "gradients" of length 69.
- **SC exclusion happens after embedding, on rows of the modes matrix.** At that point
  `modes_SC` is still (70 regions, 69 components), so `np.delete(..., excluded_regions,
  axis=0)` removes regions. Applying the same deletion after the transpose would remove
  *components* 10, 34, 44, 49 and 69 instead — a silent, plausible-looking corruption.
- **FC is already excluded.** Re-applying `Figure1_excluded_regions.npy` to the 65×65 matrix
  is the bug that `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` actually commits.
  This script correctly does not.
- **Bilateral centroid pairing is `i` and `i + 70`.** `centroids_bilateral =
  concatenate([left, right])` is (140, 3); left region *i* is row *i*, right region *i* is row
  *i + 70*. The exclusion is therefore doubled:
  `np.concatenate([excluded_regions, excluded_regions + 70])`, 10 rows removed, leaving 130.
- **Gradient values are duplicated, not recomputed, for the two hemispheres.** `double_vector`
  concatenates the 65-vector with itself, so element *j* and element *j + 65* carry the same
  value — matching the left/right centroid layout. The gradients are computed on a unilateral
  region set; the figure is bilateral by mirroring.
- **Coordinate flips are hard-coded constants, not derived from image shape.** `y = 974 - y`
  on the bilateral centroids (applied once, in place, before exclusion) and `z = 359 - z` on
  the side-view copy. Compare with
  `ns_multi-zebrafish-ca_behav-spatial_permutation-functional_atlas_map`, where hard-coding
  `359` was identified as a rendering bug and replaced with the image width. The same risk
  applies here and was never reviewed.
- **Correlation slice `[:min_len]`** where `min_len = min(65, 65) = 65` — a no-op guard in this
  dataset. It would silently truncate rather than raise if the two gradient sets ever covered
  different region counts.
