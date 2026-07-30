# Data contract — ns_multi-zebrafish-sc_ca-anova-directionality_effect

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads the exclusion mask and the per-larva FC stack; writes all four `.npy` artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json` |
| `ZEBRAFISH_PATH` | **no — ignored** | The script does not call `os.getenv("ZEBRAFISH_PATH")` at all |
| `ATLAS_PATH` | no | Not used; this recipe needs no atlas geometry |

No validation is performed on the env vars. `os.makedirs(SAVE_DIR, exist_ok=True)` fails
immediately if `SAVE_DIR` is unset; an unset `PROCESS_DATA_DIR` surfaces later as a
`TypeError` inside `os.path.join`, after the SC matrix has already been loaded.

### Hard-coded data root

```python
DATA_ROOT = "<data-root>"
```

A literal, not a `getenv` with a default. Both the reference implementation and the figure-oriented implementation carry it. This
mount does not exist on the current machine; patch this constant to point at the local copy of
the dataverse `Files/` directory before running.

## Library dependencies

**Bundled, not external.** `scripts/zebrafish_Ca_utils.py` ships inside this recipe and is the
only library module it carries.

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
```

The `sys.path` line points at the script's own directory, so the import resolves with no
external setup; that line is the sole edit to the scripts.

| Symbol | Signature as used | Contract |
|---|---|---|
| *(none)* | — | The wildcard import brings `zebrafish_Ca_utils` into scope but **no symbol from it is referenced anywhere in the script**. No `MapzebrainAtlas`, no `get_datasets`, no `compute_correlation_matrix`. |

Everything the script actually calls comes from `numpy`, `scipy.stats.f_oneway`,
`scipy.ndimage.gaussian_filter1d`, `matplotlib.pyplot`, and (refine only)
`matplotlib.patheffects`. The wildcard import resolves against the bundled module but buys
nothing, while still pulling in that module's own third-party stack (`h5py`, `numba`, `tqdm`,
`tifffile`, `skimage`, `sklearn`, `bct`, `IPython`) at load time — both the `sys.path` line and
the wildcard import can be deleted without changing the result.

### Helper defined inline in the script

| Name | Where | Contract |
|---|---|---|
| `compute_smoothed_density(values, grid, sigma=20)` | defined inside both scripts, just above the density panel | `np.histogram(values, bins=200, density=True)` → bin centres → `np.interp` onto `grid` with `left=0, right=0` → `gaussian_filter1d(sigma=sigma)`. Returns the smoothed density on `grid`. **Not** a library function; it travels with the reference script. |

## Inputs

### `SC_matrix_directed_terminals_expanded.npy`

- Location: `<DATA_ROOT>/Files/SC_matrix_directed_terminals_expanded.npy`
- Shape: `(70, 70)`; loaded with `allow_pickle=True` then `.astype(float)`
- Content: **directed** terminal-expanded structural connectome. Entry `[i, j]` is the traced
  projection strength from region `i` to region `j`; the matrix is not symmetric, and that
  asymmetry is the signal this recipe extracts.
- Not produced by any recipe in this set — it is raw dataset input.
- The undirected sibling `SC_matrix_undirected_terminals_expanded.npy` is **not**
  interchangeable: symmetrizing collapses categories 1 and 2 into one.

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to int
- Values in this dataset: `[10, 34, 44, 49, 69]`
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- Indices are 0-based into the **original 70-region** atlas ordering.

### `Figure1_FC_matrices.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrices.npy`
- Shape: `(22, 65, 65)` — larvae × regions × regions, **already post-exclusion**
- Content: per-larva Pearson FC matrices, raw r (no Fisher z)
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`
- This is the per-larva stack, not the group average `Figure1_FC_matrix.npy`. Substituting the
  average would reduce the sample from ~45 000 to ~2 000 values and change every statistic.

## Outputs

### `Figure2_number_of_connections.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_number_of_connections.npy`
- Shape: `(65, 65)`, dtype int
- Values: 0 = unconnected, 1 = unidirectional, 2 = bidirectional. Symmetric by construction
  (`B + Bᵀ`), diagonal equals `2 * diag(B)`.
- Full-matrix value counts for the recorded dataset: 997 zeros, 1478 ones, 1750 twos (4225 = 65² entries
  including both triangles and the diagonal).
- Consumed by: no other recipe in this 30-run set. It is a terminal artifact, kept for the
  figure and for downstream re-use.

### `Figure2_Directionality_Corr_Unconnect.npy`

- Shape: `(10011,)` float — pooled FC values for category-0 pairs across all 22 larvae

### `Figure2_Directionality_Corr_Unidirection.npy`

- Shape: `(15965,)` float — category-1 pairs

### `Figure2_Directionality_Corr_Bidirection.npy`

- Shape: `(19021,)` float — category-2 pairs

All three are 1-D and **unlabelled**: once flattened there is no way to recover which region
pair or which larva a value came from. If you need that traceability, keep the
(larva, pair) index alongside.

Consumed by: no other recipe in this set.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `figure_refine.png` (refine), 300 dpi, `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — the output file is the **refine** script's trimmed dict; see
  `method_details.md`

## Indexing conventions

- Exclusion indices are 0-based over the **original 70** regions and are applied to the SC
  matrix via a boolean keep-mask, not `np.delete`.
- After exclusion the 65 survivors are **renumbered contiguously** 0–64. Index 34 in the
  category matrix is not atlas region 34. To map back to anatomy, rebuild the original index
  list as `np.arange(70)[keep_mask]`.
- The FC stack arrives already at 65 regions with the same renumbering, so SC and FC are aligned
  index-for-index only because both derive from the same exclusion list. If the exclusion mask
  ever changes, both must be regenerated together.
- The FC re-exclusion guard differs between scripts: base uses `if n_regions_fc != 65`, refine
  uses `if n_regions_fc > 65`. Both no-op on this data. The figure-oriented implementation form is safer — the reference implementation form
  would attempt a 70-length mask on a smaller matrix if FC were ever *under*-sized, and crash.
- `np.triu_indices(65, k=1)` yields 2080 unique pairs. The counts 997 + 1478 + 1750 = 4225 are
  over the **full** matrix, so the per-triangle pair counts are roughly (4225 − diagonal)/2 per
  category; do not compare the two sets of counts directly.
- There is no bilateral `i` / `i+70` pairing in this recipe — the connectome and the FC matrices
  are both already collapsed to 70 (then 65) unilateral regions.
