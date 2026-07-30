# Data contract — ns_ana-zebrafish-ca-triu_pearson-network_stereotypy

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads the FC stack; writes both `.npy` artifacts |
| `SAVE_DIR` | yes | Writes the figure and `statistics.json`; `os.makedirs(..., exist_ok=True)` |
| `ZEBRAFISH_PATH` | no | **Not used.** No raw larva data is opened |
| `ATLAS_PATH` | no | **Not used.** No atlas object is constructed |

Neither required variable is validated. `os.makedirs(SAVE_DIR, exist_ok=True)` raises
`TypeError` on `None`; an unset `PROCESS_DATA_DIR` fails at the first `os.path.join`. Both
scripts behave identically here.

Note that `PROCESS_DATA_DIR` is used for both reading and writing, and in a prior execution it
.../results/processed`) rather than at the per-figure `SAVE_DIR`. Keep the two separate — the
`.npy` files belong on the shared artifact bus, the figure and statistics do not.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
```

The library is bundled, not external: `scripts/zebrafish_Ca_utils.py` is the one module this
recipe carries, and the `sys.path` line above resolves the wildcard import to it (identically in
both the base and refine scripts).

**No symbol from the wildcard import is ever resolved at a call site.** Both scripts were read
end to end to confirm this: every function called is from `numpy`, `scipy.stats.pearsonr`,
`matplotlib.pyplot`, `os` or `json`. The import resolves but buys nothing, and it still costs
the module's own heavy dependencies (`numba`, `h5py`, `tifffile`, `scikit-image`,
`scikit-learn`, `bctpy`, `IPython`) at load time. Deleting the `sys.path` line and the wildcard
import is therefore safe, and leaves the script runnable on a stock scientific Python stack — the same
situation as the `ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance`,
`ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot` and
`ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot` refine scripts, except that here it is true
of the *base* script too.

`MapzebrainAtlas` is not used, and neither `.centroids` nor `.regionCentroids` is touched.

Third-party imports actually exercised: `numpy`, `matplotlib.pyplot`,
`scipy.stats.pearsonr`. Standard library: `os`, `sys`, `json`.

### Helper defined inline

```python
def vectorize_upper_triangle(matrix, k=1):
    """Extract upper triangle of matrix as 1D vector."""
    n = matrix.shape[0]
    iu = np.triu_indices(n, k=k)
    return matrix[iu].astype(float)
```

This is **defined inside the script**, not imported. It travels with
`scripts/reference_implementation.py` and must not be listed as an external dependency. It is
called only with the default `k=1`.

## Inputs

### `Figure1_FC_matrices.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrices.npy`
- Loaded with `np.load(..., allow_pickle=True)`. The `allow_pickle` flag is not needed for a
  plain float array; it is harmless here but means a malformed file would be executed rather
  than rejected.
  `Loaded 22 FC matrices with shape (22, 65, 65)`.
- Content: per-larva Pearson FC matrices, symmetric, with a NaN-or-zero diagonal and NaN rows
  or columns wherever a region was unsampled in that larva.
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`
- **This is the per-larva stack, not the group average.** `Figure1_FC_matrix.npy` (singular) is
  the 65×65 average and is the wrong input — it would produce a 65×65 region-by-region
  "similarity" matrix with no error raised.
- Fatal if missing: plain `np.load`, no guard.
- No exclusion mask is read. The matrices arrive already filtered to 65 regions and are used
  as-is, which is correct — re-applying the mask here would be the 61-region bug that
  `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` has.

## Outputs

### `Figure1_FC_network_similarity_larvaID.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_network_similarity_larvaID.npy`
- Shape: `(22,)`
- **dtype: unicode string**, produced by `np.array(["Fish 3", "Fish 17", …])` — a `<U`-kind
  array, roughly `<U8` given the longest label `"Fish 22"`. It is **not** an integer index
  array.
- Content: the identifiers `"Fish {i+1}"` sorted descending by mean similarity. Position `k`
  in this array names the larva occupying row/column `k` of the ordered similarity matrix.
- Consumed by: **no other recipe in this set.** It exists so the ordered matrix can be mapped
  back to subjects.
- The integer permutation `sorted_indices` is never saved. To recover it, parse the strings:
  `np.array([int(s.split()[1]) - 1 for s in ids])`. Loading this file and using it directly as
  a fancy index into the FC stack raises `IndexError`.

### `Figure1_FC_network_similarity_across_larvae.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_network_similarity_across_larvae.npy`
- Shape: `(22, 22)`, float
- Content: the pairwise Pearson correlation matrix between larvae, permuted by
  `sorted_indices` on both axes. Symmetric, unit diagonal, no NaN in this run.
- Row/column `k` corresponds to entry `k` of the larva ID array above, **not** to larva `k`.
- Consumed by: **no other recipe in this set.** This is a terminal analysis.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine), 300 dpi,
  `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — identical from both scripts; see `method_details.md`

## Indexing conventions

- **Larva indices are 0-based internally and displayed 1-based.** `fish_ids` is built as
  `f"Fish {i+1}"`, and the axis tick labels are `str(sorted_indices[i] + 1)`.
- **Two orderings coexist and are easy to confuse.** `initial_similarity_matrix` is in the
  original stack order; `ordered_similarity_matrix` — the one that is saved and plotted — is in
  descending-mean-similarity order. Only the ordered version is persisted. If you need the
  unordered matrix, recompute it or invert the permutation from the ID strings.
- **The axis tick labels are identities, not positions.** Tick `k` reads as the original 1-based
  fish number, so the labels are a permutation of 1–22, not 1, 2, 3, ….
- **Region indices never appear.** The 65 regions are flattened away by
  `vectorize_upper_triangle` before anything else happens. Each larva becomes a 2080-element
  vector (`65 × 64 / 2`), and the vector positions are the standard `np.triu_indices(65, k=1)`
  row-major ordering. Every larva uses the same ordering, which is what makes the correlation
  meaningful.
- **The stack order is inherited, not established here.** `Figure1_FC_matrices.npy` was built by
  `ns_ana-zebrafish-ca-pearson-fc_matrix` iterating over `get_datasets(ZEBRAFISH_PATH,
  keywords=['fish'])`, and that recipe skips larvae with fewer than 600 time points. So "Fish 7"
  means "the 7th matrix in the stack", which is not guaranteed to be the folder named `fish7`.
  The label is positional. Any claim about a specific animal has to be traced back through the
  upstream recipe's larva ordering.
- **Post-exclusion region numbering is irrelevant here but inherited.** The 65 surviving regions
  were renumbered contiguously 0–64 upstream; this recipe never maps back to anatomy, so the
  renumbering causes no trouble — but neither output can be interpreted regionally.
