# Data contract — ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes | Root of the raw dataset; the two fingerprinting `.npy` files are read from `$ZEBRAFISH_PATH/Files/` |
| `PROCESS_DATA_DIR` | yes | Written: `Figure1_FC_fingerprinting.npy`. Created with `os.makedirs(exist_ok=True)` |
| `SAVE_DIR` | yes | Written: `figure.png` (base) / `figure_refine.png` (refine), `statistics.json` |
| `ATLAS_PATH` | no | Not used. No atlas object is constructed and no anatomy is touched |

Unlike `ns_ana-zebrafish-ca-pearson-fc_matrix`, this script does **not** validate the
variables. `os.getenv` returns `None` silently and the failure surfaces later as
`TypeError` from `os.path.join` (for `ZEBRAFISH_PATH`) or from `os.makedirs`. Set all three
before running.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
```

**Bundled, not external.** `scripts/zebrafish_Ca_utils.py` ships inside this recipe and is the
only library module it carries. The `sys.path` line points at the script's own directory, so
the import resolves with no external setup; that line is the sole edit to the script.

| Symbol | Signature as used | Contract |
|---|---|---|
| — | — | **No symbol from the wildcard import is resolved at any call site.** |

`MapzebrainAtlas` is not used — neither `.centroids` nor `.regionCentroids`. The two lines
above are vestigial boilerplate copied across runs: the module now resolves, but importing it
still drags in its own third-party stack (`h5py`, `numba`, `tqdm`, `tifffile`, `skimage`,
`sklearn`, `bct`, `IPython`) for no benefit. Removing them leaves a script that needs only
`numpy`, `matplotlib`, and the standard library, which is the practical way to run this
analysis.

### Helpers defined inline in the script (not imported)

These travel with `scripts/reference_implementation.py` and must not be listed as external
dependencies:

| Helper | Definition | Behaviour |
|---|---|---|
| `vectorize_upper_triangle(matrix, k=1)` | inline | `matrix[np.triu_indices(matrix.shape[0], k=k)].astype(float)` — flattens the strict upper triangle to 1-D |
| `safe_corrcoef(vec_a, vec_b)` | inline | Masks to positions finite in both vectors; returns `np.nan` if fewer than 3 survive, else `np.corrcoef(...)[0, 1]` |

## Inputs

### `FC_matrices_fingerprinting_6dpf.npy`

- Location: `$ZEBRAFISH_PATH/Files/FC_matrices_fingerprinting_6dpf.npy`
- Loaded with `np.load(path, allow_pickle=False)`
- Shape: `(7, 116, 116)` — larvae × regions × regions, float
- Content: per-larva functional connectivity at 6 days post-fertilization
- Produced by: shipped with the dataset. **Not** produced by any recipe in this set — in
  particular it is not the output of `ns_ana-zebrafish-ca-pearson-fc_matrix`, which writes
  65×65 matrices for a different 22-larva cohort
- Asserted: `shape[1] == shape[2]`, and `shape[0]` equal to the 7dpf file's

### `FC_matrices_fingerprinting_7dpf.npy`

- Location: `$ZEBRAFISH_PATH/Files/FC_matrices_fingerprinting_7dpf.npy`
- Shape: `(7, 116, 116)` — the same 7 larvae, imaged 24 h later
- Row order is assumed to be the **same larva order** as the 6dpf file. Nothing in the code
  verifies this; the entire identification result depends on it. If the two files were sorted
  differently the accuracy would collapse to chance without any error being raised

## Outputs

### `Figure1_FC_fingerprinting.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_fingerprinting.npy`
- Shape: `(7, 7)`, float, symmetric to within `rtol=1e-5, atol=1e-8` (asserted)
- Content: `0.5 * (S + S.T)` where `S[i, j]` is the Pearson r between larva *i*'s 6dpf FC
  vector and larva *j*'s 7dpf FC vector
- Diagonal = intra-individual similarity; off-diagonal = inter-individual

Consumed by: no downstream recipe reads this file. It is a terminal artifact.

**Written identically by** `ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance`, which
recomputes the same matrix from the same inputs and overwrites this path. The two runs agree
to full precision (the 1H `similarity_matrix` diagonal mean 0.7862941005559134 equals the 1I
`intra_individual.mean`), so the write order does not matter — but be aware that a pipeline
running both will write this file twice.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine), 300 dpi.
  Note: `plt.savefig(figure_path, dpi=300)` without `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — full contents reproduced in `method_details.md`

## Indexing conventions

- **Larva indices are 0-indexed** in every array. The figure tick labels are
  `np.arange(1, N+1)`, i.e. 1-indexed for display only. "Fish 3" on the figure is
  `symmetric_similarity[2, 2]`.
- **Row = 6dpf, column = 7dpf** in the pre-symmetrization matrix `S`. After symmetrization
  that distinction is gone; do not read direction into the saved artifact.
- **The 116 regions here are a different parcellation from the 70/65-region atlas indexing**
  used by the main FC chain. No exclusion mask is applied and
  `Figure1_excluded_regions.npy` is never read. Region indices in these matrices cannot be
  cross-referenced against `Figure1_FC_matrix.npy` region indices.
- `np.triu_indices(n, k=1)` orders pairs row-major: (0,1), (0,2), …, (0,115), (1,2), …
  The vector length is 116·115/2 = 6670. The correlation is over those 6670 edges.
- Off-diagonal extraction in **this** script uses `~np.eye(N, dtype=bool)`, which yields
  N·(N−1) = 42 values — each unordered pair counted twice. The sibling recipe uses
  `np.triu_indices(N, k=1)` and yields 21.
