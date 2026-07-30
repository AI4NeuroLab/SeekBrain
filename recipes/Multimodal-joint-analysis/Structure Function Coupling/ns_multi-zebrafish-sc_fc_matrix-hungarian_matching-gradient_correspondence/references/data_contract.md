# Data contract — ns_multi-zebrafish-sc_ca-hungarian_matching-gradient_correspondence

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads both gradient arrays; writes both output artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json` |
| `ZEBRAFISH_PATH` | no | Not used — this recipe touches no raw data |
| `ATLAS_PATH` | no | Not used — no atlas geometry is involved |

Both variables are read with `os.getenv(...)` and **not validated**. If either is unset the
value is `None` and `os.path.join(None, ...)` raises `TypeError` — noisy enough to notice, but
unlike `ns_ana-zebrafish-ca-pearson-fc_matrix` there is no explicit guard clause.
`os.makedirs(SAVE_DIR, exist_ok=True)` runs before any work.

## Library dependencies

### Reference implementation (`scripts/reference_implementation.py`)

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
```

This recipe bundles exactly one library module: `scripts/zebrafish_Ca_utils.py`. The `sys.path`
line points at the script's own directory, so the import resolves with no external setup —
nothing has to be supplied. Rewriting that line is the only change made to the script.

The wildcard import is present but **no symbol from it is ever used**. `MapzebrainAtlas` is
not needed; neither `.centroids` nor `.regionCentroids` is touched. It resolves, but at a cost:
importing the module executes its own dependency stack (`h5py`, `numba`, `tqdm`, `tifffile`,
`scikit-image`, `scikit-learn`, `bctpy`, `IPython`) at load time in exchange for nothing. The
import can be removed without changing the result — which is exactly what the figure-oriented implementation
does.

### Figure-oriented implementation (`scripts/refine_implementation.py`)

No `sys.path` line, no custom import. Dependencies reduce to:

```python
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr, spearmanr
from scipy.optimize import linear_sum_assignment
```

This makes the figure-oriented implementation one of the few in the set that is genuinely runnable given only
the two input `.npy` files.

### Helper defined inline — not an external dependency

| Symbol | Where it lives | Signature as used |
|---|---|---|
| `compute_mode_similarity_matrix` | **Defined inline** in both bundled scripts | `compute_mode_similarity_matrix(modes1, modes2, return_mapping=True, method='pearson')` |

Returns `(sorted_corrs, mapping)` when `return_mapping=True`, otherwise just `sorted_corrs`.
`sorted_corrs` is `(N_modes, N_modes)` float with rows indexing `modes1` and columns indexing
`modes2` **after** the assignment permutation. `mapping` is the column index vector returned by
`linear_sum_assignment`, dtype int64, length `N_modes`.

`analytical_report.md` describes this as "a custom function, `compute_mode_similarity_matrix`",
and `pipeline_result.json`'s plan lists it under "Retrieval hints" as though it were a library
lookup. It is not in `zebrafish_Ca_utils`. The function body travels with these scripts.

### Scipy symbols used

| Symbol | Signature as used | Contract |
|---|---|---|
| `pearsonr` | `pearsonr(x, y)[0]` | Pearson r between two length-65 region vectors; only element 0 (the coefficient) is kept, the p-value is discarded |
| `spearmanr` | `spearmanr(x, y)[0]` | Reachable only via `method='spearman'`; unused for the recorded dataset |
| `linear_sum_assignment` | `linear_sum_assignment(cost_matrix)` | Hungarian/Jonker-Volgenant solver. Returns `(row_ind, col_ind)`; the script discards `row_ind` (it is `0..49` for a square cost matrix) and keeps `col_ind` as `mapping` |

## Inputs

### `Figure6_SC_gradients.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_SC_gradients.npy`
- Shape: `(69, 65)` — **modes × regions**, float
- Content: diffusion-map embedding of the structural connectome, transposed so gradients are
  rows. 69 = `min(69, n_regions - 1)` components from the SC matrix.
- Produced by: `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`
- Used as: `sc_gradients[:50, :]` → `(50, 65)`

### `Figure6_FC_gradients.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_FC_gradients.npy`
- Shape: `(64, 65)` — **modes × regions**, float
- Content: diffusion-map embedding of the group-average FC matrix, gradients as rows.
  64 = `min(64, n_regions - 1)` components.
- Produced by: `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`
- Used as: `fc_gradients[:50, :]` → `(50, 65)`

The two arrays have **different numbers of modes** (69 vs 64) but the same 65-region second
axis. Only the shared leading 50 are used, so the mismatch never bites here — but any attempt
to extend past 64 modes will fail on the FC side first.

### Assertions the reference implementation performs

```python
assert sc_modes_50.shape[0] == 50
assert fc_modes_50.shape[0] == 50
assert sc_modes_50.shape[1] == fc_modes_50.shape[1]   # region axes must agree
assert correlations.shape == (50, 50)
assert np.all(np.abs(correlations) <= 1.0)
```

The figure-oriented implementation drops all five. Nothing checks **orientation** — a regions × modes array
with ≥50 rows would pass every assertion and silently correlate region profiles instead of
mode profiles.

## Outputs

### `Figure6_FC_SC_gradients_correlations.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_FC_SC_gradients_correlations.npy`
- Shape: `(50, 50)` float
- Axis semantics: **rows = SC modes 1–50 in natural order; columns = FC modes in the
  Hungarian-assigned order.** Column `j` is FC mode `mapping[j]`, not FC mode `j`.
- Values are **signed** Pearson r. The `np.abs` is applied only at plot time.

Consumed by: nothing else in this 30-recipe set. This is a terminal artifact of the Figure 6
chain — kept so the alignment can be re-examined without re-running the 2 × 2500 `pearsonr`
calls.

### `Figure6_FC_SC_gradients_mapping_indcies.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_FC_SC_gradients_mapping_indcies.npy`
- Shape: `(50,)`, dtype int64
- Content: `col_ind` from `linear_sum_assignment` — a permutation of `0..49`. Element `j` is
  the **0-indexed** FC mode assigned to SC mode `j`.
- **The filename is misspelled — `indcies`, not `indices`.** This is not a typo to correct: it
  is the literal name written by both scripts and documented in external descriptions. A consumer that
  spells it correctly will get `FileNotFoundError`, and the pipeline DAG built from these
  filenames will show a broken edge.

Consumed by: nothing else in this 30-recipe set.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine), 300 dpi,
  `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — the output file contains the figure-oriented implementation's four fields; see
  `method_details.md`

## Indexing conventions

- **Modes are 0-indexed in the arrays, 1-indexed on the figure.** `sc_gradients[0]` is
  gradient 1 on the plot; tick positions `[0, 49]` are labelled `['1', '50']`.
- **`mapping` values are 0-indexed FC mode numbers.** Add 1 before quoting them in prose that
  uses the figure's numbering.
- **Regions are the 65 post-exclusion regions**, inherited unchanged from
  `Figure1_excluded_regions.npy` via the gradient computation. This recipe never sees the
  original 70-region indexing and never needs the exclusion mask itself.
- **Rows vs columns.** In the saved artifact rows are SC. In the *plotted* image (refine
  script) rows are FC, because it plots the transpose. The saved file and the figure have
  opposite orientation — check which one you are reasoning about.
