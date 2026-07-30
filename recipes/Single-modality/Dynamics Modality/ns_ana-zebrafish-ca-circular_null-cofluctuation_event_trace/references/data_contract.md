# Data contract — ns_ana-zebrafish-ca-circular_null-cofluctuation_event

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Index conventions](#index-conventions)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads both inputs; writes all four `.npy` artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json`. `os.makedirs(..., exist_ok=True)` is called. |
| `ZEBRAFISH_PATH` | no | Not used — no raw larva data is touched |
| `ATLAS_PATH` | no | Not used — no anatomy is touched |

Both used variables are fetched with plain `os.getenv(...)` and **not validated**. Note that
`os.makedirs` is called on `SAVE_DIR` but **not** on `PROCESS_DATA_DIR`, even though four files
are written there — the directory is assumed to exist, which it will, since the upstream recipe
created it.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *
```

All five modules are **bundled in `scripts/`** — `zebrafish_Ca_utils.py`,
`zebrafish_Ca_stats_patch_xps.py`, `zebrafish_Ca_utils_patch_xps.py`,
`zebrafish_Ca_utils_predictors_xps.py`, `zebrafish_Ca_visualization_patch_xps.py` — and the
`sys.path` line resolves them from the script's own directory, so the imports work with no
external setup.

They are nonetheless five wildcard imports from which **no symbol is resolved at a call site**.
Every function the method uses is defined in the script body *after* the imports, so the local
definitions shadow anything the wildcards may have supplied. This recipe is effectively
dependency-free on the custom library; the `sys.path` line and the five `import *` lines can be
deleted without changing behaviour — and doing so avoids paying for those modules' own heavy
third-party dependencies (`numba`, `bctpy`, `networkx`, `hdbscan`, `opencv-python`) at load time.

### Genuine external dependencies

| Symbol | Source | Signature as used |
|---|---|---|
| `multipletests` | `statsmodels.stats.multitest` | `multipletests(pvalues, alpha=0.05, method='fdr_bh')` → `(reject, pvals_corrected, _, _)` |
| `np.triu_indices`, `np.outer`, `np.roll`, `np.percentile`, `np.split`, `np.column_stack` | `numpy` | |
| `gridspec.GridSpec` | `matplotlib.gridspec` | `GridSpec(2, 1, height_ratios=[4, 1], hspace=...)` |

`scipy.ndimage.gaussian_filter1d` is imported by both scripts and **never used**.

### Helpers defined inline (not external dependencies)

| Name | Where | Signature | Contract |
|---|---|---|---|
| `compute_RMS` | both scripts, near top | `compute_RMS(timeseries) -> np.ndarray` | `timeseries` is `(R, T)`. For each frame `t`: outer product of the column with itself, take the strict upper triangle via `np.triu_indices(R, 1)`, return `sqrt(mean(values ** 2))`. Output shape `(T,)`. Pure Python loop over `T`. |
| `permute_timeseries` | both scripts, near top | `permute_timeseries(timeseries) -> np.ndarray` | `timeseries` is `(R, T)` for **one fish**. For each row independently, `np.roll` by `np.random.randint(0, T)`. Returns an array of the same shape. |

the required configuration and the analytical report both name `compute_RMS` and
`permute_timeseries` as if they were library functions. They are not, in these scripts. Where
the report and the code disagree, the code is right — and here it is also more useful, because
the exact RMS definition (strict upper triangle, RMS of the *squared* edge values) is visible
rather than hidden.

The refine script's `compute_RMS` carries extra commented-out vectorisation notes and an unused
`idx_i, idx_j = triu_indices` unpack, but computes exactly the same values as the base version.

## Inputs

### `Figure4_state_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_state_matrix.npy`
- Shape: `(120, 19624)` — kept bilateral regions × concatenated frames
- Content: per-region, per-fish z-scored ΔF/F; fish blocks laid end to end in fish-ID order
- Produced by: `ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix`
- Fatal if missing: explicit `os.path.exists` check → `FileNotFoundError`

### `Figure4_rseries.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_rseries.npy`
- Shape: `(22, 120, 892)` — fish × regions × frames
- Produced by: `ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix`
- Fatal if missing: explicit `os.path.exists` check → `FileNotFoundError`
- Used for two distinct purposes: generating the per-fish circular-shift null, **and** as the
  sole source of `n_fish`, `n_regions` and `n_timepoints_per_fish`. The state matrix alone
  cannot tell you where the fish boundaries are.

### Consistency assertion

```python
assert state_matrix.shape[1] == n_fish * n_timepoints_per_fish
```

19624 == 22 × 892. This holds only because every larva in this dataset has the same 892 frames.
It is the guard against the ragged-length asymmetry documented in the upstream recipe, where
`Figure4_rseries.npy` would be truncated while `Figure4_state_matrix.npy` would not.

## Outputs

### `Figure4_RMS.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_RMS.npy`
- Shape: `(19624,)`, float — one RMS value per frame of the empirical state matrix
- Consumed by: no other recipe in this set. Kept for reanalysis and for the figure.

### `Figure4_null_RMS_distribution.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_null_RMS_distribution.npy`
- Shape: `(1962400,)` = 100 permutations × 19624 frames, flattened by
  `np.concatenate(null_RMS_list)`
- The iteration structure is **not** preserved — it is one flat pool. To recover per-iteration
  values, reshape to `(100, 19624)`; the concatenation order is iteration-major.
- Asserted length: `100 * n_total_timepoints`
- Consumed by: no other recipe. Large (~15 MB float64); regenerate rather than move it if space
  is tight.

### `Figure4_RMS_threshold.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_RMS_threshold.npy`
- Shape: `(1,)` — saved as `np.array([threshold])`, **not** a bare scalar. Index it as `[0]`.
- Value in this dataset: `1.3855040181852394`
- Consumed by: no other recipe. Used here only to draw the red reference line.

### `Figure4_events_high.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_events_high.npy`
- Shape: `(120, 244)` — regions × events. Column `e` is the mean activity vector over the frames
  belonging to event `e`.
- Column order follows the events in **ascending frame order**, which is also ascending fish
  order since the frame index is monotonic across the concatenation.
- Empty-case behaviour: if no events are found, a `(n_regions, 0)` array is written rather than
  raising.
- **This is the artifact that matters downstream.** Consumed by:
  - `ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster` — t-SNE + HDBSCAN over the events,
    writing `Figure4_events_high_clusters.npy` and `Figure4_events_high_embedding.npy`
  - `ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter` — a near-duplicate run writing
    the same two files, differing only in the figure produced

Note what is **not** saved: the frame indices making up each event. The mapping from event
column back to time (and hence back to fish) exists only inside the script's `events` list. If
you need to know which fish an event belongs to, recompute the grouping or add an explicit
`event_fish_id` artifact — nothing downstream can recover it from `Figure4_events_high.npy`.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `figure_refine.png` (refine), 21×3 in, 300 dpi. Note neither
  script passes `bbox_inches='tight'`.
- `$SAVE_DIR/statistics.json` — the stored file matches the refine script's schema

## Index conventions

### Frame index (0-based, 0 … 19623)

Global across the concatenation. Fish `f` (1-based) owns frames
`[(f-1) * 892, f * 892)`. Equivalently, frame `t` belongs to fish
`t // 892 + 1`.

### `fish_boundaries`

```python
fish_boundaries = np.arange(n_timepoints_per_fish, n_total_timepoints, n_timepoints_per_fish)
# -> [892, 1784, 2676, ..., 18732]   (21 values)
```

These are the **first frame index of each fish after the first** — start-of-block markers, not
end-of-block. `np.arange` excludes the stop value, so 19624 is not present, and 0 is not present
either. 21 boundaries for 22 fish is correct.

### Boundary-crossing test

```python
boundaries_crossed = fish_boundaries[(fish_boundaries > start) & (fish_boundaries <= end)]
```

Asymmetric by design, where `start` and `end` are the first and last frame of a contiguous run:

- `> start`: a boundary equal to `start` means the run *begins* at a fish start. Nothing is
  straddled — the run lies entirely within the new fish.
- `<= end`: a boundary equal to `end` means the run's final frame is the first frame of the next
  fish, so the run does straddle and must be split.

Getting either comparison wrong produces either spurious single-frame events (if `>= start`) or
events that silently span two animals (if `< end`).

### Split semantics

Frames `< B` close the current event; frames `>= B` open the next. So a run
`[890, 891, 892, 893]` with `B = 892` becomes `[890, 891]` (fish 1) and `[892, 893]` (fish 2).
The refine script carries the remainder forward (`current_group = part2`) so this generalises
correctly to multiple boundaries; the base script does not — see `method_details.md`.

### Post-split verification

```python
for event_indices in events:
    fish_ids = event_indices // n_timepoints_per_fish
    assert len(np.unique(fish_ids)) == 1
```

Present in the base script only. It is the sole automated check that the splitting logic worked;
worth carrying over if you adopt the refine script wholesale.

### Region index

Rows 0–119 of the state matrix and of `Figure4_events_high.npy` are the post-exclusion
contiguous numbering established upstream. Rows 0–59 are left hemisphere, 60–119 right, and row
`k` pairs with row `k + 60`. Mapping back to atlas regions requires
`Figure4_excluded_regions_bilateral.npy` — see the upstream recipe's data contract. Nothing in
this recipe touches anatomy.
