# Data contract — ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Region indexing convention — the hazard in this recipe](#region-indexing-convention--the-hazard-in-this-recipe)
- [Edge extraction convention](#edge-extraction-convention)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads all three input `.npy` files |
| `SAVE_DIR` | yes | Writes the figure and `statistics.json`; created with `os.makedirs(..., exist_ok=True)` |
| `ZEBRAFISH_PATH` | no | **Not used.** Never referenced. |
| `ATLAS_PATH` | no | **Not used.** No atlas is loaded by this recipe. |

Both used variables are read with plain `os.getenv(...)` and neither is validated; an unset one
becomes `None` and fails later inside `os.path.join`.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
```

**No symbol is imported from the custom library, and no library module is bundled with this
recipe — `scripts/` holds only the two implementations.** The `sys.path` line is vestigial: copied
from the template but never followed by an import, so it resolves nothing either way. This is the
only recipe in the 2J/2K/2L chain with no library dependency at all. It is still not runnable here,
because its input `.npy` artifacts are produced by upstream recipes and are absent locally.

Third-party only: `numpy`, `scipy.stats.pearsonr`, `matplotlib.pyplot`, `json`, `os`, `sys`.

`MapzebrainAtlas` is **not** used. Neither `.centroids` nor `.regionCentroids` is touched.

### Defined inline in the script

None. Both scripts are straight-line code with no helper functions.

## Inputs

### `Figure1_FC_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy`
- Shape: `(65, 65)` float — **already post-exclusion**
- Content: group-average Pearson functional connectivity across 22 larvae
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`
- Loaded with plain `np.load(...).astype(float)` (no `allow_pickle`)

### `Figure2_SC_predictor_PC1.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_SC_predictor_PC1.npy`
- Shape: `(65, 65)` float — **already post-exclusion**
- Content: the first PCA score component of the structural predictor matrix, reshaped to
  65×65, diagonal zeroed, sign-aligned so its correlation with FC is positive
- Produced by: `ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction`
- Not symmetric — it derives from a directed predictor set. Only the upper triangle is used
  here, matching how it was validated upstream.
- Hard dependency: this recipe cannot run before that one.

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to int
- Values in this dataset: `[10, 34, 44, 49, 69]` — **0-indexed over the original 70 atlas
  regions**
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- **Should not be used by this recipe at all.** Both other inputs already have these regions
  removed. See "Region indexing convention" below.

## Outputs

### Figure

- `$SAVE_DIR/figure.png` (reference implementation) / `$SAVE_DIR/figure_refine.png` (figure-oriented implementation)
- 300 dpi, `bbox_inches='tight'`

### `statistics.json`

- `$SAVE_DIR/statistics.json` — the output file is the **refine** script's trimmed version
  (`sample_sizes`, `correlation_analysis`, `linear_regression`). The reference implementation additionally
  writes `descriptive_statistics` (mean/std/median/min/max/p25/p75 for both `fc` and `pc1`) and
  an `interpretation` block; those are not preserved on disk.

### No `.npy` artifact

This recipe writes nothing to `PROCESS_DATA_DIR`. It is a terminal node in the pipeline DAG and
has no downstream consumers.

## Region indexing convention — the hazard in this recipe

| Object | Regions | Indexing |
|---|---|---|
| `Figure1_excluded_regions.npy` | — | 0-indexed over the **original 70** atlas regions, values 0–69 |
| `Figure1_FC_matrix.npy`, `Figure2_SC_predictor_PC1.npy` | 65 | Contiguously renumbered 0–64, exclusions **already applied** |
| What this script actually analyses | 61 | The 65-region matrices with four more, misidentified, regions removed |

The exclusion list is only valid against a 70×70 object. Applying it to a 65×65 matrix does two
wrong things at once:

1. Index 69 does not exist. Both scripts bounds-filter it away with a printed warning
   (`Warning: Excluded region indices [69] are out of bounds for matrix size 65`), so it is
   dropped silently as far as the result is concerned.
2. Indices 10, 34, 44 and 49 are still in range but no longer mean what they meant. After the
   first exclusion the surviving regions were renumbered contiguously, so post-exclusion index
   34 is not atlas region 34. Four arbitrary, wrongly-identified regions are removed.

The result is a 61×61 analysis on a region set that corresponds to no meaningful anatomical
grouping. Edge count falls from 2080 (n=65) to 1830 (n=61).

To reproduce the stored `statistics.json`, keep the filtering block. To compute the correct
values, delete it and run on all 65 regions — which is what
`ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction` already reports (r = 0.6821, 2080 edges).

The same lesson is recorded from the producer side in
`ns_ana-zebrafish-ca-pearson-fc_matrix`: apply the exclusion once, at the 70-region stage, and
treat every downstream matrix as already filtered.

## Edge extraction convention

`np.triu_indices(n, k=1)` — strictly above the diagonal, so each unordered pair {i, j}
contributes exactly one observation, taken from the i→j direction of the (non-symmetric) PC1
matrix. The reference implementation additionally zeroes both diagonals before extraction, which has no
effect given `k=1`; the figure-oriented implementation omits that step.
