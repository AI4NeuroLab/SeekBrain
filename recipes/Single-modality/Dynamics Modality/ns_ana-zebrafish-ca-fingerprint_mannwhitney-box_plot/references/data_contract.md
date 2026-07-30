# Data contract — ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance

## Contents

- [Environment variables](#environment-variables)
- [The hard-coded input root](#the-hard-coded-input-root)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Written: `Figure1_FC_fingerprinting.npy`, `Figure1_FC_fingerprinting_SameLarva.npy`, `Figure1_FC_fingerprinting_DiffLarva.npy`. `os.makedirs(exist_ok=True)` |
| `SAVE_DIR` | yes | Written: `figure.png` (base) / `figure_refine.png` (refine), `statistics.json` |
| `ZEBRAFISH_PATH` | **not read** | The script never calls `os.getenv("ZEBRAFISH_PATH")` — see `ROOT_DIR` below |
| `ATLAS_PATH` | no | Not used. No atlas object, no anatomy |

Neither `PROCESS_DATA_DIR` nor `SAVE_DIR` is validated. `os.getenv` returns `None` silently
and the failure surfaces from `os.makedirs`.

## The hard-coded input root

```python
ROOT_DIR = "<data-root>"
```

Present in **both** the base and the refine script. It is a module-level constant, not an env
lookup and not a default with a fallback — there is no way to override it without editing the
source. That mount does not exist here, so the script cannot locate its inputs as written.

Note the asymmetry with the sibling recipe: `ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint`
reads the *same two files* from `os.path.join(os.getenv("ZEBRAFISH_PATH"), "Files", ...)`.
Whatever `ZEBRAFISH_PATH` you set for that recipe is the value `ROOT_DIR` should be edited to.

## Library dependencies

**Bundled, not external.** `scripts/zebrafish_Ca_utils.py` ships inside this recipe and is the
only library module it carries.

Base script:

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
```

The `sys.path` line points at the script's own directory, so the import resolves with no
external setup; that line is the sole edit to the script.

| Symbol | Signature as used | Contract |
|---|---|---|
| — | — | **No symbol from the wildcard import is resolved at any call site.** |

The import therefore buys nothing while still pulling in the module's own third-party stack
(`h5py`, `numba`, `tqdm`, `tifffile`, `skimage`, `sklearn`, `bct`, `IPython`) at load time, and
can be deleted.

The refine script **already deletes both lines**. Its only third-party imports are:

```python
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import mannwhitneyu
```

`MapzebrainAtlas` is not used — neither `.centroids` nor `.regionCentroids`.

### Helpers defined inline in the script (not imported)

| Helper | Definition | Behaviour |
|---|---|---|
| `vectorize_upper_triangle(matrix)` | inline | `matrix[np.triu_indices(matrix.shape[0], k=1)]` — flattens the strict upper triangle to 1-D. Unlike the sibling recipe's version it takes no `k` argument and does **not** cast to float |

The pairwise-correlation NaN handling is written inline in the double loop here rather than
factored into a `safe_corrcoef` helper (which is how the sibling recipe does it). The logic is
identical: mask to jointly finite positions, require ≥3, else NaN.

## Inputs

### `FC_matrices_fingerprinting_6dpf.npy`

- Location: `$ROOT_DIR/Files/FC_matrices_fingerprinting_6dpf.npy`
- Loaded with plain `np.load(path)` (no `allow_pickle` argument)
- Shape: `(7, 116, 116)` — larvae × regions × regions, float
- Content: per-larva functional connectivity at 6 days post-fertilization
- Produced by: shipped with the dataset. Not the output of any recipe in this set — in
  particular not `ns_ana-zebrafish-ca-pearson-fc_matrix`, whose matrices are 65×65 for a
  different 22-larva cohort

### `FC_matrices_fingerprinting_7dpf.npy`

- Location: `$ROOT_DIR/Files/FC_matrices_fingerprinting_7dpf.npy`
- Shape: `(7, 116, 116)` — the same 7 larvae 24 h later
- Asserted: `fc_6dpf.shape == fc_7dpf.shape` (full shape equality, stricter than the sibling
  recipe's per-axis assertions)
- Row order is assumed to be the same larva order as the 6dpf file. Nothing verifies it, and
  the whole result depends on it — a mismatched sort would drive the intra group down to the
  inter distribution with no error raised

## Outputs

### `Figure1_FC_fingerprinting.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_fingerprinting.npy`
- Shape: `(7, 7)`, float, symmetric
- Content: `(S + S.T) / 2` where `S[i, j]` is the Pearson r between larva *i*'s 6dpf FC vector
  and larva *j*'s 7dpf FC vector

Consumed by: no downstream recipe reads it. Terminal artifact.

**Also written by** `ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint` from the same
inputs, to full precision agreement. A pipeline running both writes this path twice; the
content is the same either way.

### `Figure1_FC_fingerprinting_SameLarva.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_fingerprinting_SameLarva.npy`
- Shape: `(7,)`, float — `np.diag(symmetric_similarity)`
- Content: intra-individual similarity, one value per larva, in larva order
- Consumed by: no downstream recipe. Unique to this run

### `Figure1_FC_fingerprinting_DiffLarva.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_fingerprinting_DiffLarva.npy`
- Shape: `(21,)`, float — `symmetric_similarity[np.triu_indices(7, k=1)]`
- Content: inter-individual similarity, one value per unordered larva pair
- Consumed by: no downstream recipe. Unique to this run
- Both vectors are saved **before** the non-finite filter, so they may contain NaN even though
  the statistics are computed on the filtered copies. In this run there were none

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine), 300 dpi,
  `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — the **refine** script's trimmed nine-field version is what is
  stored. Full contents in `method_details.md`

## Indexing conventions

- **Larva indices are 0-indexed.** There is no per-larva axis labelling in this figure (the two
  x positions are groups, not animals), so no 1-indexed display convention applies here — but
  `Figure1_FC_fingerprinting_SameLarva.npy[0]` is the same larva as row 1 on the sibling
  recipe's heatmap.
- **Row = 6dpf, column = 7dpf** before symmetrization; the distinction is erased afterwards.
- **The 116 regions are a different parcellation from the 70/65-region atlas indexing** used by
  the main FC chain. No exclusion mask is applied; `Figure1_excluded_regions.npy` is never
  read. These region indices cannot be cross-referenced against `Figure1_FC_matrix.npy`.
- `np.triu_indices(116, k=1)` yields 6670 edges per larva, ordered row-major:
  (0,1), (0,2), …, (0,115), (1,2), …
- `np.triu_indices(7, k=1)` yields the 21 unordered larva pairs, again row-major:
  (0,1), (0,2), …, (0,6), (1,2), … The sibling recipe instead uses `~np.eye(7)` and gets 42
  values — the same 21 pairs, each duplicated.
