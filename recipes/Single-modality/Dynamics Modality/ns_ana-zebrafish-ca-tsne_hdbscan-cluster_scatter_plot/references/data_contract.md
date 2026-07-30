# Data contract — ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter

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

Both variables are validated with an explicit `raise ValueError(...)` naming the variable
before any work happens. Unlike the twin recipe
`ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster`, which passes `None` into
`os.makedirs` and dies with an opaque `TypeError`, this script fails cleanly. Neither script
calls `os.makedirs` here — the directories must already exist.

## Library dependencies

### External packages actually exercised

```python
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
from sklearn.manifold import TSNE
import hdbscan
```

| Symbol | Signature as used | Contract |
|---|---|---|
| `TSNE` | `TSNE(n_components=2, perplexity=30, learning_rate='auto', init='random', random_state=420)` then `.fit_transform(X)` | `X` is (n_events, n_regions); returns (n_events, 2) |
| `hdbscan.HDBSCAN` | `hdbscan.HDBSCAN(min_cluster_size=10)` then `.fit_predict(embedding)` | The standalone `hdbscan` package, **not** `sklearn.cluster.HDBSCAN`. Returns int labels with `-1` for noise |
| `pearsonr` | `pearsonr(noise_event, centroid)` → `(r, p)` | Only `r` is used; the p-value is discarded |

`np.corrcoef` is **not** used by this recipe — the event × event correlation matrix belongs to
the 4C twin.

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
`MapzebrainAtlas` is not used; neither `.centroids` nor `.regionCentroids` is touched. Remove
these six lines and the script depends only on PyPI packages — and it stops paying for the
vendored modules' own heavy third-party imports (`numba`, `bctpy`, `networkx`, `hdbscan`,
`opencv-python`) at load time.

### Helpers defined inline

None. Both scripts are straight-line, with no `def` at all. The noise-reassignment loop, the
size-based relabelling, and the per-cluster statistics loop are inline code that travels with
`scripts/reference_implementation.py`.

## Inputs

### `Figure4_events_high.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_events_high.npy`
- Shape: `(120, 244)` — **bilateral regions × events**, float
- Content: the regional amplitude pattern of each supra-threshold coactivation frame, taken
  from the z-scored bilateral state matrix at frames whose RMS exceeded the circular-shift
  null 95th percentile (threshold 1.3855)
- Produced by: `ns_ana-zebrafish-ca-circular_null-cofluctuation_event`
- Guarded: `raise FileNotFoundError(f"Input file not found: {input_file}")` if absent, and
  `raise ValueError` if `n_events < 10`

The 120 rows are 140 bilateral regions (70 left + 70 right) minus the 20 excluded bilateral
indices produced by `ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix`
(`[10, 17, 25, 30, 32, 34, 37, 44, 49, 69, 80, 87, 95, 100, 102, 104, 107, 114, 119, 139]`).
After exclusion the surviving rows are **renumbered contiguously 0–119**, so row `i` is not
bilateral index `i`, and the pre-exclusion left/right `i` ↔ `i+70` pairing does not survive
into this array. This recipe never maps rows back to anatomy, so the renumbering is harmless
here — but any attempt to name the states anatomically must first reconstruct the original
indices from the exclusion list.

## Outputs

### `Figure4_events_high_clusters.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_events_high_clusters.npy`
- Shape: `(244,)`, dtype int
- Values in this run: `{1: 171, 2: 56, 3: 17}` — **1-based**, 1 = largest cluster
- Index alignment: element `j` labels column `j` of `Figure4_events_high.npy`, in the event
  order the detection step emitted. Nothing reorders the saved vector.

**Label convention warning.** `ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster` writes the
same filename with **0-based** labels `{0: 171, 1: 56, 2: 17}`. Both runs exist in this dataset
and both wrote to the same `PROCESS_DATA_DIR`. Any consumer must inspect `labels.min()` rather
than assume a base. The refine script can additionally emit `-1` for unreassigned noise (it
never does on this data), which a 0-based reader would not expect either.

### `Figure4_events_high_embedding.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_events_high_embedding.npy`
- Shape: `(244, 2)`, float32 (t-SNE output dtype)
- Content: t-SNE coordinates, row `j` ↔ event `j` ↔ label `j`
- Identical to the array written by the 4C twin — same input, same parameters, same seed

### Consumers

Neither artifact is read by any other recipe in the 30-recipe registry. The only other analysis
touching them is `ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster`, which **rewrites
rather than reads** them. Treat these files as terminal outputs of a leaf branch, and treat
4C/4D as alternatives, not a chain.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine), 300 dpi, 6×5 in
- `$SAVE_DIR/statistics.json` — both scripts write to the same path with the same content on
  this data, so the refine run overwrites the base run with numerically identical values. See
  `method_details.md` for the verbatim contents.

Note the stored `statistics.json` here contains **embedding-coordinate** summaries per
cluster. The 4C twin's `statistics.json`, written to a *different* `SAVE_DIR`, contains
correlation-matrix summaries instead. Both are called `statistics.json`; do not conflate them.

## Indexing conventions that could be misread

| Convention | Detail |
|---|---|
| Input orientation | `(n_regions, n_events)` on disk; transposed to `(n_events, n_regions)` before t-SNE. `n_regions, n_events = events_array.shape` — unpacking this in the wrong order clusters regions and still produces a plausible figure |
| Cluster labels | 1-based here, 0-based in the 4C twin, same filename |
| Cluster ordering | By descending member count, largest → 1. Not HDBSCAN's own numbering: HDBSCAN's cluster 2 (147 members pre-reassignment) becomes label 1, its cluster 1 becomes 2, its cluster 0 becomes 3 |
| Statistics keys | `cluster_1` / `cluster_2` / `cluster_3` follow the 1-based labels. The 4C twin's keys `cluster_0` / `cluster_1` / `cluster_2` refer to the same three states under the other base |
| `dim1` / `dim2` | Columns 0 and 1 of the embedding, i.e. the axes drawn as `t-SNE 1` and `t-SNE 2` |
| Region rows | 0–119 contiguous after bilateral exclusion; not the original 0–139 bilateral indices |
