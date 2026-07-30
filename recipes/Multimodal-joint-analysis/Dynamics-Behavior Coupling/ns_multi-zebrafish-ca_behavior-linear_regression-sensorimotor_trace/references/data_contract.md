# Data contract — ns_vis-zebrafish-ca_behav-corr_ranking-sensorimotor_trace

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions that could be misread](#indexing-conventions-that-could-be-misread)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes, in practice | Root containing `Subjects/fish*/` and `Files/`. Read with a **hard-coded fallback** to `<data-root>`, a path that no longer exists |
| `SAVE_DIR` | yes, in practice | Figure and `statistics.json`. Defaults to `./` if unset, so output lands in the working directory without warning |
| `PROCESS_DATA_DIR` | no | Not used. This recipe neither reads nor writes the shared artifact bus |
| `ATLAS_PATH` | no | Not used. No atlas geometry is touched |

Neither variable is validated. `os.makedirs(SAVE_DIR, exist_ok=True)` is called on whatever
`SAVE_DIR` resolves to. The dead `ZEBRAFISH_PATH` default is the same failure mode recorded
for `ns_vis-zebrafish-sc_atlas-edge_projection-sc_network_map` and
`ns_multi-zebrafish-sc_ca-linregress-degree_coupling`: the run fails with a
`FileNotFoundError` on a plausible-looking path rather than a clear "variable not set".

## Library dependencies

### External packages actually exercised

```python
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
```

| Symbol | Signature as used | Contract |
|---|---|---|
| `gridspec.GridSpec` | `GridSpec(6, 1, height_ratios=[1, 1, 2, 2, 2, 2], hspace=0)` (refine); `GridSpec(5, 1, height_ratios=[0.5, 0.5, 2, 2, 2], hspace=0)` (base) | Row layout; `hspace=0` butts the panels together into a continuous raster |
| `ax.fill_between` | `fill_between(time_swim, 0, binary_swim, color='black', alpha=0.7)` | Renders the binary swim vector as filled bars |
| `np.argsort` | `argsort(correlations)[-50:]` / `[:50]` | Ascending sort; NaNs are placed **last**, so `[-50:]` returns NaNs if any are present |

### Bundled but unused

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
```

`zebrafish_Ca_utils.py` is **bundled in `scripts/`** — the only library module this recipe carries
— and the `sys.path` line resolves it from the script's own directory, so the import works with
no external setup.

It is nonetheless a single wildcard import from which **no name is resolved at any call site**.
`MapzebrainAtlas` is not used; neither `.centroids` nor `.regionCentroids` is touched.
`get_datasets` is not used either — the fish folders are discovered with a plain
`os.listdir` + `sorted()`, which is why the selection is lexicographic rather than by fish id.

The reference implementation additionally does `from scipy.ndimage import gaussian_filter1d` and never
calls it; no smoothing is applied to any trace. The figure-oriented implementation drops that import. Both
still `import json`, but only the reference implementation uses it.

Removing the `sys.path` line and the `zebrafish_Ca_utils` import leaves both scripts fully
runnable from `numpy` and `matplotlib` alone — this is one of the few recipes in the set with no
real dependency on the custom library. It is worth doing: importing the module for nothing still
costs its own heavy third-party stack (`numba`, `bctpy`, `h5py`, `tqdm`, `tifffile`,
`scikit-image`, `scikit-learn`, `IPython`) at load time.

### Helpers defined inline

None. Both scripts are straight-line with no `def`. The trace-shift, the neuron ranking, and
the statistics assembly are inline and travel with `scripts/reference_implementation.py`.

## Inputs

### Fish folder selection

```python
subjects_dir = os.path.join(ZEBRAFISH_PATH, "Subjects")
fish_folders = sorted([... for folder in os.listdir(subjects_dir)
                       if folder.startswith("fish") and os.path.isdir(...)])
fish_folder = fish_folders[7]     # 8th folder, 0-indexed
```

Resolved in the reference implementation to `fish16` (confirmed in both `exec.log` files and in
`statistics.json`'s `fish_folder` field). The sort is **lexicographic on the folder name**, so
the ordering runs `fish1, fish10, fish11, …` rather than numerically — index 7 is not "the 8th
fish by id" and `fish16` is not the 16th folder. The set of folders on disk fully determines
which animal this is; adding or removing any `fish*` directory silently repoints index 7.

The reference implementation raises `ValueError` if fewer than 8 folders are found. The figure-oriented implementation
instead prints a warning and falls back to `fish_folders[0]`, producing a complete figure for
the wrong animal.

### `dff.npy`

- Location: `<fish_folder>/dff.npy`
- Shape: `(69646, 892)` — **neurons × time frames** for `fish16`
- Content: per-neuron ΔF/F₀ calcium traces
- Produced by: upstream of this recipe set. Not written by any of the 30 recipes — the per-neuron
  ΔF/F₀ is part of the delivered dataset. (`ns_pre-zebrafish-ca-minfilter-dff_region_series`
  produces the *region-averaged* `region_series_dff.npy`, a different and much smaller array.)
- Frame interval: 892 frames over 900.560 s ≈ **1.011 s**, i.e. ≈0.99 Hz volumetric imaging

### `swim_events.npy`

- Location: `<fish_folder>/swim_events.npy`
- Shape: `(360000,)` — the recorded length already equals the target, so no padding fired
- Sampling rate: **399.75 Hz** (hard-coded in the script, not read from any file)
- Content: continuous swim vigour; thresholded at 0.5 to a binary bout indicator
- Produced by: upstream of this recipe set

### `correlations_motor.npy`, `correlations_dark.npy`, `correlations_light.npy`

- Location: `<fish_folder>/correlations_{motor,dark,light}.npy`
- Shape: `(69646,)` each — one value per neuron, index-aligned with `dff.npy` rows
- Content: precomputed Pearson correlation of each neuron's trace with, respectively, the motor
  regressor, the dark-stimulus regressor, and the light-stimulus regressor
- Produced by: **upstream of this recipe set.** No recipe in the 30-recipe registry writes these.
  The method used to build them (regressor construction, any lag, any smoothing) is not
  recorded anywhere for the recorded dataset, so the correlations are taken on trust
- Observed value ranges among the selected neurons: motor top-50 0.608–0.676, motor
  bottom-50 −0.390 to −0.266, dark top-50 0.746–0.876, light top-50 0.315–0.657

### `sequence_stimuli.npy`

- Location: `$ZEBRAFISH_PATH/Files/sequence_stimuli.npy` — note this is under `Files/`, **not**
  inside the fish folder; it is the shared visual protocol common to all larvae
- Shape: 1-D, length not recorded in `statistics.json`
- Content: the light/dark stimulus sequence, plotted with `ylim [-0.2, 1.2]`, consistent with a
  0/1 binary trace
- Time axis: `np.linspace(0, duration, len(sequence_stimuli))` — stretched to the behaviour
  duration regardless of its native length, so its own sampling rate is never used

## Outputs

### No `.npy` artifacts

There is no `np.save` call in either script. This recipe writes nothing to
`PROCESS_DATA_DIR` and has **no downstream consumers** in the DAG. It is a terminal
visualization node.

`analytical_report.md` lists an "Artifact 1: `viz_functional_traces.py`" — a script, not a
data file, and one that is never written to disk by the run. Do not record it as an output.

### Figure

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine)
- 12×5 in, 300 dpi, `bbox_inches='tight'`
- Individual neuron traces rasterized; context panels, mean traces, and text vector

### `statistics.json`

- `$SAVE_DIR/statistics.json` — **written by the reference implementation only.** The figure-oriented implementation drops
  the entire statistics block, so a refine-only re-run leaves no numbers behind. Contents
  verbatim in `method_details.md`.

## Indexing conventions that could be misread

| Convention | Detail |
|---|---|
| Fish index | `fish_folders[7]` is the 8th folder in a **lexicographic** sort, which resolves to `fish16` here. Not the 8th fish by id, and not folder `fish8` |
| `dff` orientation | `(neurons, time)`. `dff.shape[1]` is used as the frame count; transposing would silently plot 892 "neurons" of 69646 points |
| Correlation index space | Values index `dff` rows directly. Neuron indices are 0-based and never renumbered — there is no exclusion mask in this recipe |
| Motor+ vs Motor− | Opposite tails of the **same** `correlations_motor` vector. `[-50:]` ascending → the 50 largest; `[:50]` → the 50 smallest |
| Argsort tail order | `[-50:]` returns the 50 largest in **ascending** order, so `motor_plus_idx[-1]` is the single most correlated neuron. Irrelevant to the figure, relevant if you index into it |
| Swim shift direction | `binary_swim[t] = original[t + 15]` — the behaviour is moved **earlier**, not later |
| Time axes | Behaviour: `arange(360000) / 399.75`, ending at 900.5604 s. Calcium: `linspace(0, duration, 892)`. The two share endpoints only; there is no common sampling grid |
| Duration constant | The reference implementation builds the calcium axis from `len(binary_swim) / camera_fps` = 900.5629 s; the figure-oriented implementation uses `time_swim[-1]` = 900.5604 s. A 2.5 ms discrepancy, well below one calcium frame, and invisible in the figure |
