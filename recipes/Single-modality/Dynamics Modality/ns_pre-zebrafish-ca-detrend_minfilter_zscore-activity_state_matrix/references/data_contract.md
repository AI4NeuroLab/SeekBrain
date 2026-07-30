# Data contract — ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes | Root scanned by `get_datasets(..., keywords=['fish'])` for per-larva folders |
| `PROCESS_DATA_DIR` | yes | Writes all three `.npy` artifacts. `os.makedirs(..., exist_ok=True)` is called. |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json`. `os.makedirs(..., exist_ok=True)` is called. |
| `ATLAS_PATH` | no | **Read into a variable and never used.** No atlas member is touched anywhere in either script. |

All four are fetched with plain `os.getenv(...)` and **none is validated**. An unset
`ZEBRAFISH_PATH` becomes `None` and fails inside `get_datasets`; an unset `PROCESS_DATA_DIR` or
`SAVE_DIR` fails inside `os.makedirs(None)`. Unlike
`ns_ana-zebrafish-ca-pearson-fc_matrix`, this recipe does not raise a clear `ValueError` first —
check the variables yourself.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import (
    MapzebrainAtlas,
    get_datasets,
    compute_dff_using_minfilter
)
```

`zebrafish_Ca_utils.py` is **bundled with this recipe**, sitting in `scripts/` beside the two
implementations, so the import resolves locally with no external setup. It is the only library
module this recipe carries, and the only one it needs. It does pull in a heavy third-party stack
at load time (`h5py`, `numba`, `tqdm`, `tifffile`, `skimage`, `sklearn`, `bct`, `IPython`) —
ordinary PyPI installs, but all must be present for the import to succeed.

| Symbol | Signature as used | Contract |
|---|---|---|
| `get_datasets` | `get_datasets(root, keywords=['fish'])` | Returns a list of per-larva directory paths |
| `compute_dff_using_minfilter` | `compute_dff_using_minfilter(X, window=30, sigma1=3, sigma2=30)` | `X` is (regions, time). Estimates a running-minimum baseline over `window` frames, smooths the signal with `sigma1` and the reference implementationline with `sigma2`, and returns a detrended ΔF/F array of the same shape. Operates row-wise, so removing rows beforehand does not perturb the surviving rows' baselines. |
| `MapzebrainAtlas` | — | **Imported and never called.** Not a real dependency of the method; it is import-time dead weight. If you are porting this recipe, dropping the name costs nothing — though it saves nothing either, since `zebrafish_Ca_utils` (and its whole third-party stack) is loaded anyway for the other two symbols. |

Standard imports: `os`, `sys`, `json`, `numpy`, `matplotlib.pyplot`,
`scipy.ndimage.gaussian_filter1d`, `scipy.stats.zscore`. The figure-oriented implementation adds
`matplotlib.transforms`.

### Helpers defined inline

None. Both scripts are straight-line code with no local function definitions.

## Inputs

### `region_series_dff_bilateral.npy` (one per larva)

- Location: `<larva_folder>/region_series_dff_bilateral.npy`, where `<larva_folder>` comes from
  `get_datasets` and its basename must match `fish<N>`
- Shape: `(140, T)` — 70 left regions stacked on 70 right regions × time; `T` = 892 for every
  larva in this dataset
- Content: region-averaged bilateral traces. The file name says `dff`, and the pipeline applies
  `compute_dff_using_minfilter` to it *again* — the on-disk product is treated as the raw input
  to a second, stricter detrending pass rather than as a finished ΔF/F.
- Produced by: upstream of this recipe set (shipped with the dataset). Note this is **not** the
  same file as `region_series_dff.npy`, the 70-region unilateral series consumed by
  `ns_ana-zebrafish-ca-pearson-fc_matrix`.
- Skipped with a printed warning if absent; a larva missing the file contributes nothing and
  will break the `fish_ids == [1..n]` assertion if it leaves a gap

### Larva folder naming

`os.path.basename(folder.rstrip('/'))` must start with `fish` and the remainder must parse as an
`int`. The parsed IDs are sorted numerically and asserted equal to `list(range(1, n + 1))`.
A missing or non-sequential ID aborts the run.

Sorting the folder *paths* (`sorted(fish_folders)`) is lexicographic and would order
fish1, fish10, fish11, …, fish2 — the numeric ID sort in the second pass is what puts the state
matrix blocks in true fish order. The lexicographic sort of the folder list only affects the
order in which the exclusion scan visits files, which is irrelevant because the scan builds a set.

## Outputs

### `Figure4_excluded_regions_bilateral.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_excluded_regions_bilateral.npy`
- Shape: `(20,)`, `dtype=int`, sorted ascending
- Values in this dataset:
  `[10, 17, 25, 30, 32, 34, 37, 44, 49, 69, 80, 87, 95, 100, 102, 104, 107, 114, 119, 139]`
- Bilateral indices (0–139), not unilateral
- Consumed by: no other recipe reads this file. It is written for source tracking and reproducibility
  — it is the only record of which anatomical rows the 120-row matrices correspond to.

### `Figure4_rseries.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_rseries.npy`
- Shape: `(22, 120, 892)` — fish × kept bilateral regions × time
- Fish axis is ordered by numeric fish ID 1..22
- Consumed by: `ns_ana-zebrafish-ca-circular_null-cofluctuation_event`, which unpacks it as
  `n_fish, n_regions, n_timepoints_per_fish = rseries.shape` and uses it both to generate the
  circular-shift null (permuting each fish independently) and to derive the fish-boundary
  positions in the state matrix.

### `Figure4_state_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure4_state_matrix.npy`
- Shape: `(120, 19624)` — kept bilateral regions × concatenated time, 19624 = 22 × 892
- Fish blocks lie end to end in fish-ID order; **no boundary marker is stored inside the array**
- Consumed by: `ns_ana-zebrafish-ca-circular_null-cofluctuation_event`

Indirectly, via that recipe's `Figure4_events_high.npy`, this matrix is the ancestor of
`ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster` and
`ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter`.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `figure_refine.png` (refine), 21×3 in, 300 dpi,
  `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — written by both scripts, with slightly different field sets;
  the output file matches the figure-oriented implementation's set

## Indexing conventions

### Bilateral index (0–139)

```
index   0 ..  69  →  LEFT  hemisphere, unilateral region 0 .. 69
index  70 .. 139  →  RIGHT hemisphere, unilateral region 0 .. 69
```

Anatomical region `i` therefore occupies **bilateral indices `i` and `i + 70`**. This is the
same layout `ns_vis-zebrafish-sc_atlas-node_projection-module_topography` uses for atlas
centroids, and it is what makes the symmetry rule expressible as `i ↔ i ± 70`.

### The three-part exclusion rule, in order

1. **Anatomical.** Seed the set with `{RETINA_INDEX_UNILATERAL, RETINA_INDEX_UNILATERAL + 70}`
   = `{10, 80}`. Unilateral region 10 is the retina; it is excluded a priori because it is
   light-driven sensory tissue rather than brain-intrinsic activity.

2. **Quality — zero signal.** For every larva and every bilateral index `r` in 0..139, add `r`
   to the set if `np.any(raw[r] == 0)`. Three properties matter:
   - The test is on the **raw** array, before Gaussian smoothing. Smoothing first would convert
     an exact 0 into a small non-zero value and the region would escape detection.
   - The test is **exact equality**, not a tolerance. An exact zero in a ΔF/F trace flags an
     unsampled region, not a genuinely silent one.
   - The set is a **union across all larvae** — a region excluded because it failed in one fish
     is dropped from all 22. That is what guarantees every larva contributes the identical 120
     rows, which is the precondition for concatenating them into one matrix.

3. **Bilateral symmetry.** After (1) and (2), for each index `i` currently in the set, add
   `i + 70` if `i < 70`, otherwise add `i - 70`:

   ```python
   for idx in excluded_list:
       if idx < 70:
           symmetric_excluded.add(idx + 70)
       else:
           symmetric_excluded.add(idx - 70)
   ```

   Both directions are needed: the zero-signal scan sweeps all 140 indices and can flag a
   right-hemisphere region on its own, in which case its left partner must also go. Iterating
   over a snapshot (`excluded_list = sorted(...)`) while adding to a separate set
   (`symmetric_excluded`) is what keeps this from mutating a set during iteration; one pass
   suffices because the pairing is an involution.

In this dataset the rule produces 10 unilateral regions
`{10, 17, 25, 30, 32, 34, 37, 44, 49, 69}` and their `+70` partners, 20 bilateral indices in
total, leaving **120 rows: 60 left, then 60 right**.

### Post-exclusion index (0–119)

The 120 surviving rows are **renumbered contiguously**. Row 34 of the state matrix is not
bilateral index 34 and not unilateral region 34. To map a state-matrix row back to anatomy,
reconstruct from `Figure4_excluded_regions_bilateral.npy`:

```python
kept = np.setdiff1d(np.arange(140), np.load("Figure4_excluded_regions_bilateral.npy"))
bilateral_index = kept[row]
unilateral_region = bilateral_index % 70
hemisphere = 'left' if bilateral_index < 70 else 'right'
```

Because the exclusion is symmetric, the split is exactly even — rows 0–59 are left, rows 60–119
are right, and row `k` and row `k + 60` are contralateral partners. That is the invariant the
figure's midline dashed line depends on, and it holds *only* because of exclusion step 3.

### Time index

Frames are 0-indexed internally and displayed 1-indexed on the figure axes (`set_xticklabels([1,
total_time])`). Fish `f` (1-based) occupies state-matrix columns
`[(f-1) * 892, f * 892)` — but only because all larvae share T = 892. See the ragged-data
caveat in `RECIPE.md`.

### Relationship to `Figure1_excluded_regions.npy`

Two distinct masks live in `PROCESS_DATA_DIR` and must not be swapped:

| File | Length | Space | Values | Governs |
|---|---|---|---|---|
| `Figure1_excluded_regions.npy` | 5 | unilateral 0–69 | `[10, 34, 44, 49, 69]` | the 70 → 65 Figure 1–3 chain |
| `Figure4_excluded_regions_bilateral.npy` | 20 | bilateral 0–139 | see above | the 140 → 120 Figure 4 chain |

The Figure 4 unilateral projection `{10, 17, 25, 30, 32, 34, 37, 44, 49, 69}` happens to be a
superset of the Figure 1 set, but the two are produced by different criteria — Figure 1 uses a
sampling-density census, Figure 4 uses the zero-signal test — and neither can be applied to the
other's matrices.
