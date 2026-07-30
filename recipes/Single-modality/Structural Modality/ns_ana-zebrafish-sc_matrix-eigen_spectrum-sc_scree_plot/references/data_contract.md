# Data contract — ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions that could be misread](#indexing-conventions-that-could-be-misread)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads `Figure6_SC_eigenvalues.npy`. Nothing is written here. |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json` |
| `ZEBRAFISH_PATH` | no | Not used |
| `ATLAS_PATH` | no | Not used |

Neither script validates them. `os.makedirs(SAVE_DIR, exist_ok=True)` raises `TypeError` if
`SAVE_DIR` is unset; an unset `PROCESS_DATA_DIR` fails inside `os.path.join`. No hard-coded
fallback paths are present in either script.

## Library dependencies

### Base script — `scripts/reference_implementation.py`

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *
```

All five modules are **bundled** in `scripts/` alongside the script — `zebrafish_Ca_utils.py`,
`zebrafish_Ca_stats_patch_xps.py`, `zebrafish_Ca_utils_patch_xps.py`,
`zebrafish_Ca_utils_predictors_xps.py`, `zebrafish_Ca_visualization_patch_xps.py`. The
`sys.path` line points at the script's own directory, so they resolve with no external setup.
Rewriting that line is the only change made to the script.

**No symbol from any of these five modules is resolved at a call site.** The imports are
boilerplate inherited from the pipeline template. Resolving them is not the same as them being
free: each module pulls in its own heavy third-party stack (`numba`, `bctpy`, `networkx`,
`hdbscan`, `opencv-python`), which must be installed and is then executed at import time —
before any data is read — in exchange for nothing. The five lines can safely be deleted.

### Refine script — `scripts/refine_implementation.py`

```python
import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
```

The `sys.path` line and all five custom imports are gone. `sys` itself is now unused —
vestigial, harmless. This leaves numpy and matplotlib as the only real dependencies, which
makes the refine script executable as-is given the input array.

Three recipes in the 30-recipe set share this cleanup: this one,
`ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance`, and
`ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot`. They are the lightest-weight scripts in the
set — the base script's imports now resolve too, but only by paying for the five vendored
modules' dependency stack.

No helper functions are defined inline in either script. `MapzebrainAtlas` is not needed —
neither `.centroids` nor `.regionCentroids` is touched, and no atlas projection is loaded.

## Inputs

### `Figure6_SC_eigenvalues.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_SC_eigenvalues.npy`
- Shape: `(69,)`, float
- Content: the eigenvalue spectrum returned by
  `brainspace.gradient.embedding.diffusion_mapping(sc_matrix, n_components=69, alpha=0.5)`
  applied to the 70×70 undirected terminal-expanded structural connectome
- Produced by: `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`
- Ordering: descending — `max_eigenvalue` equals `first_eigenvalue` (0.6387332312244718)
- Range: 0.6387332312244718 down to **−0.186718534616406**. Negative values are expected and
  are a genuine property of the decomposition, not corruption.
- **Not exclusion-filtered.** Eigenvalues belong to components, not to brain regions, so the
  5-region exclusion mask applied upstream never touches them. There are 69 of them because
  `n_components=69`, not because of any region count. Do not try to align them with region
  indices.
- Loaded with `allow_pickle=True` in both scripts. That flag is unnecessary for a plain float
  array and would be a security concern with an untrusted file; it is harmless here but does
  not need to be carried forward.
- Fatal if missing: explicit `FileNotFoundError` naming the resolved path, raised before
  anything else happens.

Loading differs between the two scripts:

| | Base | Refine |
|---|---|---|
| load | `np.load(path, allow_pickle=True).astype(float)` | `np.real(np.squeeze(np.load(path, allow_pickle=True))).astype(float)` |
| shape guard | `assert eigenvalues.ndim == 1` | `if eigenvalues.ndim != 1: raise ValueError(...)` **after** squeeze |
| size guard | `assert eigenvalues.size >= 50` | none |

The refine handling tolerates a `(69, 1)` array and a complex dtype; the base does not
(`astype(float)` on a complex array raises `TypeError`, and the bare assert kills a trivially
squeezable shape).

## Outputs

**This recipe writes no `.npy` artifacts.** Nothing in the 30-recipe registry is downstream of
it. It is a terminal rendering step: the figure is the product.

### Figure

- `$SAVE_DIR/figure.png` (base) or `$SAVE_DIR/figure_refine.png` (refine)
- 300 dpi, `bbox_inches='tight'`, preceded by `plt.tight_layout()`

### `statistics.json`

- `$SAVE_DIR/statistics.json` — written by **both** scripts, to the **same** path, with
  different contents. The base writes 20 fields including the degenerate cumulative-variance
  entries; the refine writes 6. The stored file is the 6-field refine version. Running the base
  script after the refine script overwrites the good file with the bad one.

Field lists and the reason the base fields are invalid are in `method_details.md`.

## Indexing conventions that could be misread

- **The x-axis is 1-based.** `gradient_indices = np.arange(1, n_eigenvalues + 1)`, so the
  leading gradient is plotted at x = 1 and labelled "Gradient #1". The underlying array is
  0-indexed: `eigenvalues[0]` is the value reported as `first_eigenvalue` and drawn at x = 1.
- **The view is cropped, the data is not.** `xlim=[-1, 51]` shows only the first 50 of 69
  points. All 69 are passed to `ax.plot`; 19 of them fall outside the axes. Do not infer the
  spectrum length from the plotted extent, and do not infer it from the `xticks=[1, 50]` either
  — read `n_eigenvalues` from `statistics.json`.
- **The y-axis floor is fixed at −0.05 and does not adapt.** The spectrum's minimum is −0.187,
  so the deepest part of the tail is clipped out of view in both scripts. This is the spec'd
  behaviour, but it means the plot understates how negative the spectrum gets. `min_eigenvalue`
  in `statistics.json` is the honest number.
- The gradient index here corresponds to the **row index** of `Figure6_SC_gradients.npy`, shape
  (69, 65): eigenvalue *k* (0-based) belongs to gradient vector `gradients[k, :]`.
