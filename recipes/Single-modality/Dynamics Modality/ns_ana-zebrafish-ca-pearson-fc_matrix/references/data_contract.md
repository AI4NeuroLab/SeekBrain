# Data contract — ns_ana-zebrafish-ca-pearson-fc_matrix

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes | Root scanned by `get_datasets(..., keywords=['fish'])` for per-larva folders |
| `PROCESS_DATA_DIR` | yes | Reads the exclusion mask; writes both FC artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` and `statistics.json` |
| `ATLAS_PATH` | no | Not used by this recipe |

The script raises `ValueError` on any unset variable before doing any work.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import get_datasets, compute_correlation_matrix
```

The library is bundled, not external: `scripts/zebrafish_Ca_utils.py` is the one module this
recipe carries, and the `sys.path` line above resolves the imports to it (identically in both
the base and refine scripts). The API contract below is unchanged.

| Symbol | Signature as used | Contract |
|---|---|---|
| `get_datasets` | `get_datasets(root, keywords=['fish'])` | Returns a list of per-larva directory paths |
| `compute_correlation_matrix` | `compute_correlation_matrix(X, arctanh=False)` | `X` is (regions, time); returns a (regions, regions) Pearson correlation matrix. `arctanh=True` would apply the Fisher z-transform — not used here |

No other custom symbol is imported. `MapzebrainAtlas` is **not** needed by this recipe.

## Inputs

### `region_series_dff.npy` (one per larva)

- Location: `<larva_folder>/region_series_dff.npy` for each folder from `get_datasets`
- Shape: `(70, T)` — regions × time; `T` = 892 in this dataset
- Content: region-averaged ΔF/F₀ traces
- Produced by: `ns_pre-zebrafish-ca-minfilter-dff_region_series`
- Skipped if: not present, not 2-D, or `T < 600`

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, dtype int
- Values in this dataset: `[10, 34, 44, 49, 69]` — retina (10) plus four regions failing the
  sampling-density threshold
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- Fatal if missing: raises `FileNotFoundError`

## Outputs

### `Figure1_FC_matrices.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrices.npy`
- Shape: `(22, 65, 65)` — larvae × regions × regions, post-exclusion
- Per-larva Pearson FC matrices

Consumed by:
- `ns_ana-zebrafish-ca-triu_pearson-network_stereotypy`
- `ns_multi-zebrafish-sc_ca-anova-directionality_effect`

### `Figure1_FC_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy`
- Shape: `(65, 65)`
- Group average via `np.nanmean` over the larva axis

Consumed by:
- `ns_vis-zebrafish-ca_atlas-edge_projection-fc_network_map`
- `ns_multi-zebrafish-sc_ca-triu_pearson-sc_fc_coupling`
- `ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map`
- `ns_multi-zebrafish-sc_ca-linregress-degree_coupling`
- `ns_multi-zebrafish-sc_ca-graph_predictors-fc_variance_explained`
- `ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction`
- `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression`
- `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`

### Figure and statistics

- `$SAVE_DIR/figure.png` (base script) / `figure_refine.png` (refine script), 300 dpi
- `$SAVE_DIR/statistics.json` — see `method_details.md`

## Region indexing convention

Regions are 0-indexed internally (0–69) and displayed 1-indexed (1–65) on the figure axes.
The exclusion list uses 0-indexed values. After exclusion the 65 surviving regions are
**renumbered contiguously** — index 34 in a post-exclusion matrix is not atlas region 34.
Any recipe mapping these back to anatomy must reconstruct the original indices from the
exclusion mask, which is what the atlas-projection recipes do.
