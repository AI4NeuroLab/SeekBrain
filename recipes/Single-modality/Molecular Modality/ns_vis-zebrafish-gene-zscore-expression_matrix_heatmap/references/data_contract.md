# Data contract — ns_vis-zebrafish-st-zscore-gene_region_heatmap

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes | Root of the raw dataset; the script reads `$ZEBRAFISH_PATH/Files/gene_expression.npy` |
| `PROCESS_DATA_DIR` | yes | Reads `Figure1_excluded_regions.npy`. **Nothing is written here.** |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json` |
| `ATLAS_PATH` | no | Not used — no atlas volume, mask or projection is touched |

**None of the three is validated.** Both scripts do a bare
`os.getenv("...")` and go straight to `os.makedirs(SAVE_DIR, exist_ok=True)`. An unset
variable is `None`, which fails as `TypeError` inside `os.path.join` (or inside `makedirs` for
`SAVE_DIR`). This is weaker than sibling recipes such as
`ns_ana-zebrafish-ca-pearson-fc_matrix`, which raise an explicit `ValueError` naming the
missing variable. Set all three before running.

Note also that the task specification says only "load ... from gene_expression.npy" with no
path; the location `$ZEBRAFISH_PATH/Files/gene_expression.npy` comes from the code, and that is
the authoritative one.

## Library dependencies

Both `scripts/reference_implementation.py` and `scripts/refine_implementation.py` contain:

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *
```

All five modules are **bundled** in `scripts/` alongside the two scripts —
`zebrafish_Ca_utils.py`, `zebrafish_Ca_stats_patch_xps.py`, `zebrafish_Ca_utils_patch_xps.py`,
`zebrafish_Ca_utils_predictors_xps.py`, `zebrafish_Ca_visualization_patch_xps.py`. The
`sys.path` line points at the script's own directory, so they resolve with no external setup.
Rewriting that line is the only change made to either script.

**No symbol from any of these five modules is used anywhere in either script.** In particular
`MapzebrainAtlas` is not instantiated, and neither `.centroids` nor `.regionCentroids` is
touched — this recipe never leaves matrix space and needs no anatomy. The imports resolve, but
they are not free: each module executes its own heavy third-party stack (`numba`, `bctpy`,
`networkx`, `hdbscan`, `opencv-python`) at import time, before any data is read, in exchange
for nothing. Delete the six lines and both scripts run unchanged.

### Actual dependencies

| Import | Signature as used | Contract |
|---|---|---|
| `numpy` | `np.load`, `np.ones`, `np.nan_to_num`, `np.nanmean`, `np.nanstd`, `np.nanmedian`, `np.nanmin`, `np.nanmax`, `np.nanpercentile` | The `nanpercentile`/`nanmedian`/`nanmin`/`nanmax` calls exist only in the reference implementation |
| `scipy.stats.zscore` | `zscore(X, axis=0, nan_policy='propagate')` | `X` is (genes, regions); `axis=0` standardises **down the gene axis**, so each region column ends with mean 0 and sd 1. `ddof` is left at the default 0 |
| `matplotlib.pyplot` | `subplots`, `imshow`, `colorbar`, tick/spine configuration, `savefig` | |

No helper function is defined inline; the run is top-level script code.

## Inputs

### `gene_expression.npy`

- Location: `$ZEBRAFISH_PATH/Files/gene_expression.npy`
- Shape: `(290, 70)` — **genes × regions**. Genes are rows, regions are columns. The script
  unpacks `n_genes, n_regions = gene_expression.shape` and relies on this orientation
  throughout; a transposed file would pass the `ndim == 2` assertion and then z-score the
  wrong axis.
- Content: raw spatially resolved expression level per gene per brain region. Values are
  non-negative and span a wide dynamic range — per-gene means over the kept regions run from
  0.3745 to 22.398.
- Produced by: **outside this recipe set.** It ships with the raw dataset; no recipe computes it.
- Assertion: `assert gene_expression.ndim == 2` (reference implementation only; the figure-oriented implementation drops it).

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast with `.astype(int)`
- Values in this dataset: `[10, 34, 44, 49, 69]` — retina (10) plus four regions failing the
  sampling-density threshold
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- **This is the only coupling between the transcriptomic and the calcium pipelines.** It exists
  so the expression matrix ends up on exactly the same 65 regions as every FC/SC matrix in the
  study; without it, a later gene-versus-connectivity comparison would be misaligned by five
  columns.
- Assertion: `assert np.all((excluded_regions >= 0) & (excluded_regions < n_regions))` (base
  script only). This checks the mask is valid for the 70-column expression matrix — the mask
  was derived from calcium sampling density, and the check is what guarantees the two datasets
  share a region ordering.
- Fatal if missing: `np.load` raises `FileNotFoundError`.

### Filtering

```python
keep_mask = np.ones(n_regions, dtype=bool)
keep_mask[excluded_regions] = False
gene_expression_filtered = gene_expression[:, keep_mask]   # (290, 65)
```

Columns only. All 290 genes survive. `analytical_report.md` describes this as `numpy.delete`;
the implementation uses a boolean mask. The result is identical — record the implementation, not the
prose.

## Outputs

### No `.npy` artifacts

Neither script contains an `np.save` call. **`analytical_report.md` is wrong on this point**:
it lists

> Artifact 1: `processed_gene_expression.npy` — ... transposed to shape (65, 290) ...

That file is never created. It is not in `PROCESS_DATA_DIR`, no other recipe in the set reads
it, and the pipeline DAG has no edge out of this recipe. If a downstream analysis needs the
processed matrix, either recompute it from the two inputs (deterministic, cheap — one boolean
index and one `zscore` call) or add an explicit `np.save` and document the filename you chose.

### Figure

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine)
- 300 dpi, `bbox_inches='tight'`, preceded by `plt.tight_layout()`

### `statistics.json`

- `$SAVE_DIR/statistics.json`
- The output file has the figure-oriented implementation's **nine** fields. The reference implementation writes eighteen; its
  extra per-gene median/min/max lists and the normalised median/min/max/percentile scalars were
  overwritten by the figure-oriented implementation run and are not preserved anywhere.
- Full contents in `method_details.md`.

## Indexing conventions

- **Genes and regions are 0-indexed in the arrays, 1-indexed on the figure.** Tick positions
  `[0, n_genes-1]` and `[0, n_regions_kept-1]` are labelled `1`/`290` and `1`/`65`. A
  statistic reported at list position 113 is gene 114 on the panel.
- **Region indices in the exclusion mask are 0-indexed into the original 70.** They index the
  columns of the *raw* expression matrix, before filtering.
- **After exclusion the 65 surviving regions are renumbered contiguously.** Y-axis position 40
  is not atlas region 40. Reconstruct the original index from the exclusion mask before mapping
  a row back to anatomy — the same convention as every other recipe built on this mask.
- **Orientation flips between computation and display.** The matrix is (genes, regions)
  throughout the computation, including the z-score; it is transposed to (regions, genes) only
  at `imshow` time. The saved statistics are computed on the *untransposed* arrays — for
  example `expression_mean_per_gene` is `np.nanmean(filtered, axis=1)`, a mean over the 65
  region columns, giving one value per gene.
- **No bilateral `i` / `i+70` pairing applies here.** That convention belongs to the
  neuron-level calcium recipes; this matrix is already at region level with 70 regions total.
