# Data contract — ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions that could be misread](#indexing-conventions-that-could-be-misread)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads `Figure4_events_high.npy`; writes both cluster artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json` |
| `ZEBRAFISH_PATH` | no | Not used. No raw per-larva data is touched |
| `ATLAS_PATH` | no | Not used. No atlas geometry is touched |

Both scripts read the two variables with a bare `os.getenv(...)` and pass the result directly
into `os.makedirs(...)` with no check. If either is unset the failure is
`TypeError: ... NoneType`, not a message naming the variable. This is worse than the
`ValueError` guard used by most other recipes in this set — add the guard when porting.

## Library dependencies

### External packages actually exercised

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
import hdbscan
from scipy.stats import pearsonr
```

| Symbol | Signature as used | Contract |
|---|---|---|
| `TSNE` | `TSNE(n_components=2, perplexity=30, learning_rate='auto', init='random', random_state=420)` then `.fit_transform(X)` | `X` is (n_events, n_regions); returns (n_events, 2) |
| `hdbscan.HDBSCAN` | `hdbscan.HDBSCAN(min_cluster_size=10)` then `.fit_predict(embedding)` | The standalone `hdbscan` package, **not** `sklearn.cluster.HDBSCAN`. Returns int labels with `-1` for noise |
| `pearsonr` | `pearsonr(event_vec, centroid)` → `(r, p)` | Only `r` is used; the p-value is discarded |
| `np.corrcoef` | `np.corrcoef(events_T)` | Rows are events, so the result is (n_events, n_events) |

### Custom library — bundled, imported, but unused

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *
```

All five modules — `zebrafish_Ca_utils.py`, `zebrafish_Ca_stats_patch_xps.py`,
`zebrafish_Ca_utils_patch_xps.py`, `zebrafish_Ca_utils_predictors_xps.py`,
`zebrafish_Ca_visualization_patch_xps.py` — are **bundled in `scripts/`**, and the `sys.path`
line resolves them from the script's own directory, so the imports work with no external setup.

They are nonetheless all wildcard imports from which **no name is resolved at a call site**.
`MapzebrainAtlas` is not used; neither `.centroids` nor `.regionCentroids` is touched. Delete
these six lines and the script is dependency-complete from PyPI alone — and it also stops paying
for the vendored modules' own heavy third-party imports (`numba`, `bctpy`, `networkx`,
`hdbscan`, `opencv-python`) at load time.

### Helpers defined inline

None. There is no function definition in either script — both are straight-line scripts. The
noise-reassignment loop and the size-based relabelling are inline code, not library calls, and
travel with `scripts/reference_implementation.py`.

## Inputs

### `Figure4_events_high.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_events_high.npy`
- Shape: `(120, 244)` — **bilateral regions × events**, float
- Content: the regional amplitude pattern of each supra-threshold coactivation frame, taken
  from the z-scored bilateral state matrix at frames whose RMS exceeded the circular-shift
  null 95th percentile (threshold 1.3855)
- Produced by: `ns_ana-zebrafish-ca-circular_null-cofluctuation_event`
- Fatal if missing: the refine script of Figure4D raises `FileNotFoundError`; this recipe's
  scripts let `np.load` raise

The 120 rows are 140 bilateral regions (70 left + 70 right) minus the 20 excluded bilateral
indices computed by `ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix`
(`[10, 17, 25, 30, 32, 34, 37, 44, 49, 69, 80, 87, 95, 100, 102, 104, 107, 114, 119, 139]`).
After that exclusion the surviving rows are **renumbered contiguously 0–119**, so row `i` is
not bilateral index `i`, and the left/right `i` ↔ `i+70` pairing of the pre-exclusion layout
does not survive into this array. Nothing in this recipe maps rows back to anatomy, so the
renumbering is harmless here — but it is fatal to any attempt to label the clusters
anatomically without first reconstructing the original indices from the exclusion list.

## Outputs

### `Figure4_events_high_clusters.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_events_high_clusters.npy`
- Shape: `(244,)`, dtype int
- Values in this run: `{0: 171, 1: 56, 2: 17}` — **0-based**, 0 = largest cluster
- Index alignment: element `j` labels column `j` of `Figure4_events_high.npy`, i.e. the same
  event order the detection step emitted. There is no re-sorting of the saved vector; the
  `[::-1]` flip applies only to the plotted matrix.

**Label convention warning.** `ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter`
writes the same filename with **1-based** labels `{1: 171, 2: 56, 3: 17}`. Both runs are in
this dataset and both wrote to the same `PROCESS_DATA_DIR`. Any consumer must inspect
`labels.min()` rather than assume a base.

### `Figure4_events_high_embedding.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_events_high_embedding.npy`
- Shape: `(244, 2)`, float32 (t-SNE output dtype)
- Content: t-SNE coordinates, row `j` ↔ event `j` ↔ label `j`
- Extent: x ∈ [−14.523, 13.179], y ∈ [−15.345, 16.107]

### Consumers

Neither artifact is read by any other recipe in the 30-recipe registry. The only other producer
and the only other analysis operating on them is
`ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter`, which **rewrites rather than
reads** them. Treat these two files as terminal outputs of a leaf branch of the DAG, and treat
4C/4D as alternatives, not a chain.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine), 300 dpi, 8×8 in
- `$SAVE_DIR/statistics.json` — both scripts write the identical dict to the same path, so the
  refine run overwrites the base run with numerically identical content. See
  `method_details.md` for the verbatim contents.

## Indexing conventions that could be misread

| Convention | Detail |
|---|---|
| Input orientation | `(n_regions, n_events)` on disk; transposed to `(n_events, n_regions)` before t-SNE. `n_regions, n_events = events.shape` — unpacking this in the wrong order clusters regions and still "works" |
| Cluster labels | 0-based here, 1-based in the 4D twin, same filename |
| Cluster ordering | By descending member count, largest first. Not by HDBSCAN's own numbering — HDBSCAN's cluster 2 (147 members pre-reassignment) becomes label 0 |
| Y-axis tick labels | Positions `[0, 243]`, labelled `[1, 244]` — the figure is 1-indexed, the array is 0-indexed |
| Matrix sort direction | `[::-1]` reverses the stable argsort, so the plotted top-left block is the *smallest* cluster and the bottom-right is the largest |
| Region rows | 0–119 contiguous after bilateral exclusion; not the original 0–139 bilateral indices |
