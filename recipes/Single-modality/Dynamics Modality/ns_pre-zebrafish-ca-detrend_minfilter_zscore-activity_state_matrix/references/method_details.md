# Method details — ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix

## Contents

- [Full parameter list](#full-parameter-list)
- [The exclusion rule in full](#the-exclusion-rule-in-full)
- [The truncation asymmetry](#the-truncation-asymmetry)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusions supported](#scientific-conclusions-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `RETINA_INDEX_UNILATERAL` | `10` | exclusion seed | Seeds the excluded set as `{10, 80}`. Removes light-driven sensory tissue that would otherwise dominate "whole-brain" state analyses with stimulus-locked variance. |
| bilateral offset | `70` | exclusion symmetry, keep-mask | Regions per hemisphere. Fixes the `i` ↔ `i ± 70` pairing. |
| zero-signal criterion | `np.any(raw[r] == 0)` | first pass | Exact equality on the **raw** trace, unioned across all 22 larvae. |
| `SMOOTHING_SIGMA` | `2` | `gaussian_filter1d(row, sigma=...)` | Temporal smoothing width in frames, applied per row. Suppresses high-frequency imaging noise. Raising it inflates the apparent co-fluctuation that `ns_ana-zebrafish-ca-circular_null-cofluctuation_event` measures downstream, so it is not a free display knob. |
| `DFF_WINDOW` | `30` | `compute_dff_using_minfilter(window=...)` | Running-minimum window in frames for the reference implementationline. Too short and the reference implementationline tracks real transients, flattening the events this pipeline exists to find; too long and it fails to follow photobleaching. |
| `DFF_SIGMA1` | `3` | `compute_dff_using_minfilter(sigma1=...)` | Signal smoothing inside the ΔF/F routine. |
| `DFF_SIGMA2` | `30` | `compute_dff_using_minfilter(sigma2=...)` | Baseline smoothing inside the ΔF/F routine. |
| z-score axis | per row (region), per fish, over time | `zscore(rseries_dff[r], nan_policy='omit')` | Standardises each region's trace **within a fish**. Removes cross-larva indicator-expression differences so one colour scale works for all 22 blocks. Consequence: absolute ΔF/F amplitude is no longer recoverable, and every row of every fish has mean 0 and SD 1 by construction. |
| NaN handling | `nan_policy='omit'` then `np.nan_to_num(..., nan=0.0)` | after z-score | A constant row would give SD 0 and an all-NaN z-score; mapping to 0 keeps the concatenation dense. Such a row should already have been caught by the zero-signal exclusion. |
| ragged-length policy | truncate to `min(time_lengths)` | 3-D stack only | Never fires on this dataset (all T = 892). See "The truncation asymmetry" below. |
| `cmap` | `'hot'` | `imshow` | Display only. |
| `vmin`, `vmax` | `-1`, `3` | `imshow` | Display only. Deliberately asymmetric — the data's median is negative and its events are large and positive, so a symmetric scale would waste half the range. |
| `aspect` | `'auto'` | `imshow` | Required: 120 × 19624 at equal aspect is unviewable. |
| `interpolation` | `'nearest'` | `imshow` | |
| `origin` | `'upper'` (figure-oriented implementation sets it explicitly) | `imshow` | Rows 0–59 (left) on top, 60–119 (right) below. |
| midline y | base `n/2` = 60.0; refine `n/2 - 0.5` = 59.5 | `axhline` | `imshow` puts integer coordinates at pixel centres, so the divider between rows 59 and 60 is at 59.5. The reference implementation's line bisects row 60. |
| fish boundary lines | white, solid, `linewidth=1.5` | `axvline` at each cumulative time | Drawn only where `cumulative_time < total_time`, so no line is painted on the right edge. |
| `figsize` | `(21, 3)` | `plt.subplots` | |
| `dpi` | `300` | `savefig` | |
| colorbar | `fraction=0.02`, `pad=0.01`, label rotated 270°, `labelpad=15` | `plt.colorbar` | Narrow, to preserve width for the 19624-frame matrix. |

## The exclusion rule in full

Three criteria, applied in this order. The order matters: symmetry is enforced *last*, over the
union of the first two.

### 1. Anatomical — retina

```python
excluded_regions_bilateral = set([RETINA_INDEX_UNILATERAL, RETINA_INDEX_UNILATERAL + 70])
# -> {10, 80}
```

Unconditional and data-independent. Both hemispheres are seeded at once, so this criterion is
already symmetric before step 3 runs.

### 2. Quality — zero signal in any larva

```python
for folder in fish_folders:
    rseries_bilateral = np.load(bilateral_file)          # RAW, shape (140, T)
    for region_idx in range(rseries_bilateral.shape[0]):
        if np.any(rseries_bilateral[region_idx] == 0):
            excluded_regions_bilateral.add(region_idx)
```

Three properties are load-bearing:

- **Raw, not smoothed.** The scan runs on the array as loaded. `gaussian_filter1d` is applied
  only in the second pass. Smoothing before the scan would convolve an exact 0 with its
  neighbours and produce a small non-zero value, so a genuinely unsampled region would pass the
  test and inject a fabricated flat segment into the state matrix.
- **Exact `== 0`, not `< eps`.** In a ΔF/F trace an exact zero is a sentinel for "no signal in
  this region at this volume", not a measurement of zero activity. A tolerance-based test would
  also catch legitimate near-baseline frames.
- **Union across larvae, not intersection.** A region that fails in a single fish is dropped
  from all 22. This is the strict choice, and it is what makes concatenation legitimate: every
  larva contributes the identical 120 rows, so column `t` of the state matrix always means the
  same anatomical row set. The alternative — per-fish masks — would give ragged row sets that
  cannot be stacked.

### 3. Bilateral symmetry

```python
excluded_list = sorted(excluded_regions_bilateral)     # snapshot
symmetric_excluded = set(excluded_list)
for idx in excluded_list:
    if idx < 70:
        symmetric_excluded.add(idx + 70)
    else:
        symmetric_excluded.add(idx - 70)
excluded_regions_bilateral = sorted(symmetric_excluded)
```

- Runs in **both** directions. Criterion 2 sweeps all 140 indices independently, so it can flag
  a right-hemisphere region (index ≥ 70) whose left partner is fine. Handling only `i → i + 70`
  would leave an unpaired row.
- Iterates a **snapshot** (`excluded_list`) while writing to a **separate set**
  (`symmetric_excluded`), which avoids mutating a collection during iteration.
- One pass is sufficient: the pairing is an involution, so `(i + 70) - 70 = i` adds nothing new.
- The result is the invariant everything downstream leans on — the kept rows split exactly
  60/60, row `k` and row `k + 60` are contralateral partners, and the figure's midline is
  meaningful. Without this step the split would be uneven and "Left"/"Right" labels would be
  wrong.

### Result on this dataset

| | |
|---|---|
| Unilateral regions excluded | `{10, 17, 25, 30, 32, 34, 37, 44, 49, 69}` (10) |
| Bilateral indices excluded | `[10, 17, 25, 30, 32, 34, 37, 44, 49, 69, 80, 87, 95, 100, 102, 104, 107, 114, 119, 139]` (20) |
| Kept | 120 = 60 left + 60 right |

Retina (10) contributes 2 of the 20; the remaining 18 come from the zero-signal criterion and
its symmetrisation.

## The truncation asymmetry

Worth stating plainly because it is a latent bug rather than an active one:

```python
if min_time != max_time:
    processed_fish_data_truncated = [arr[:, :min_time] for arr in processed_fish_data]
    rseries_3d = np.stack(processed_fish_data_truncated, axis=0)
else:
    rseries_3d = np.stack(processed_fish_data, axis=0)
...
state_matrix = np.concatenate(processed_fish_data, axis=1)   # never truncated
```

`Figure4_rseries.npy` is built from the truncated list; `Figure4_state_matrix.npy` is always
built from the full-length list. On ragged data the two artifacts describe different time spans,
and the downstream assertion in
`ns_ana-zebrafish-ca-circular_null-cofluctuation_event`

```python
assert state_matrix.shape[1] == n_fish * n_timepoints_per_fish
```

would fail — which is the good outcome. The bad outcome would be silently wrong fish-boundary
arithmetic if that assertion were ever relaxed. On this dataset every larva has T = 892, the
`else` branch runs, and the two artifacts are exactly consistent.

## Statistical approach

This is a preprocessing recipe; it performs no inference.

- **No significance testing, no null model.** That is
  `ns_ana-zebrafish-ca-circular_null-cofluctuation_event`, immediately downstream.
- **Standardisation is per region and per fish.** Consequently `activity_mean ≈ 0` and
  `activity_std ≈ 1` over the whole state matrix are *guaranteed by construction*, not findings.
  They are useful only as arithmetic checks that the z-scoring ran.
- **The informative statistic is the median.** `activity_median = -0.1918` against a mean of
  ~0 means the distribution is right-skewed: most frames sit below the mean and a minority of
  large positive excursions pull it up. That skew is precisely the "sparse, transient bursts"
  structure the downstream event detection quantifies.
- **`activity_max = 10.759` versus `activity_min = -7.426`** confirms the same asymmetry, and
  justifies the asymmetric `[-1, 3]` display range.
- **The bilateral-symmetry claim is descriptive.** No correlation between row `k` and row
  `k + 60` is computed. The workflow description's "highly symmetric across the horizontal midline" is read
  off the heatmap.

## Recorded statistics (`statistics.json`)

Verbatim, from the reference implementation:

```json
{
  "n_fish": 22,
  "fish_ids": [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22
  ],
  "n_regions_bilateral_original": 140,
  "n_excluded_regions_bilateral": 20,
  "excluded_regions_bilateral": [
    10, 17, 25, 30, 32, 34, 37, 44, 49, 69,
    80, 87, 95, 100, 102, 104, 107, 114, 119, 139
  ],
  "n_regions_kept": 120,
  "time_lengths_per_fish": [
    892, 892, 892, 892, 892, 892, 892, 892, 892, 892, 892,
    892, 892, 892, 892, 892, 892, 892, 892, 892, 892, 892
  ],
  "total_time_concatenated": 19624,
  "state_matrix_shape": [
    120,
    19624
  ],
  "rseries_3d_shape": [
    22,
    120,
    892
  ],
  "activity_mean": 8.418323790472039e-19,
  "activity_std": 0.9999999999999998,
  "activity_min": -7.426430089475797,
  "activity_max": 10.758776333611339,
  "activity_median": -0.1918147734197968
}
```

(The `fish_ids`, `excluded_regions_bilateral` and `time_lengths_per_fish` arrays are one element
per line in the output file; reflowed here for readability. Values are unchanged.)

The reference implementation writes two additional fields, `activity_percentile_25` and
`activity_percentile_75`. **They are absent from the output file**, which confirms the stored
`statistics.json` is the product of the figure-oriented implementation run — consistent with `exec_refine.log` being the
later log.

Checks worth running on a re-run: `total_time_concatenated == n_fish × 892`,
`n_regions_kept == 140 − n_excluded_regions_bilateral`, the excluded list is closed under
`i ↔ i ± 70`, and `activity_mean` and `activity_std` land at 0 and 1 to floating-point
precision.

## Scientific conclusions supported

From `conclusions.json`:

> Across all 22 zebrafish larvae, large-amplitude neural activity (z-scored ΔF/F) exhibits a
> high degree of synchronization across 120 brain regions, manifested as near-simultaneous
> activation bursts that span both the left and right hemispheres.

> The spatiotemporal distribution of neural activity shows strong bilateral symmetry during
> large-amplitude events, with high-intensity activity peaks occurring concurrently in
> corresponding regions of the left and right hemispheres across all individual fish.

Both are visual readings of the heatmap. The first is quantified downstream by
`ns_ana-zebrafish-ca-circular_null-cofluctuation_event` (1758 significant frames, 244 discrete
events). The second is never quantified anywhere in this recipe set.

The analytical report also stresses the methodological point that removing regions failing in
*even a single larva* is what ensures "the final state matrix contains no gaps or interpolation
artifacts" — worth preserving if you adapt the exclusion rule.

## Figure specification

A single wide axis, `figsize=(21, 3)`, 300 dpi, `bbox_inches='tight'`.

**Heatmap.** `imshow(state_matrix, cmap='hot', aspect='auto', vmin=-1, vmax=3,
interpolation='nearest', origin='upper')` — 120 rows × 19624 columns.

**Y-axis (regions).** A white dashed horizontal line (`linewidth=1.5`) at row 59.5 separating
the 60 left rows from the 60 right rows. Ticks only at rows 0 and 119, labelled `1` and `120`
(1-indexed for display). Rotated `Left` and `Right` labels at axes fractions 0.75 and 0.25 in
the left margin. Axis label `Brain Regions`, fontsize 12, `labelpad=30` so it clears the
Left/Right text.

**X-axis (time / fish).** Solid white vertical lines (`linewidth=1.5`) at each fish boundary
(cumulative frame counts, right edge suppressed). `Fish <N>` above each block, centred on the
block's midpoint, fontsize 9, black, placed with a blended transform at axes `y = 1.01`. Ticks
only at the first and last frame, labelled `1` and `19624`. Axis label `Imaging Volumes`,
fontsize 12.

**Colorbar.** Vertical, `fraction=0.02`, `pad=0.01`, labelled `Activity (z-scored)` rotated
270° with `labelpad=15`, fontsize 10.
