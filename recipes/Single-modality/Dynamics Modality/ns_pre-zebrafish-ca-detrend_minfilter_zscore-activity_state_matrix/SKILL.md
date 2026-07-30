---
name: "ns_pre-zebrafish-ca-detrend_minfilter_zscore-activity_state_matrix"
description: "Build the cross-fish bilateral brain state matrix from zebrafish calcium imaging — load each larva''s 140-region left+right regional time series, apply a three-part symmetric exclusion rule (retina, zero-signal quality failures, bilateral pairing), detrend with a min-filter ΔF/F baseline, z-score each region over time, and concatenate all larvae along the time axis into a single (120, 19624) matrix. Reach for this whenever someone asks for a 'state matrix', 'brain state matrix', 'concatenated activity across fish', 'bilateral regional time series', 'z-scored regional activity heatmap', 'large-amplitude activity patterns across larvae', or needs the preprocessed input for co-fluctuation event detection or brain state clustering. This is the required upstream step for the entire Figure 4 chain: it writes Figure4_state_matrix.npy, Figure4_rseries.npy and Figure4_excluded_regions_bilateral.npy, and the co-fluctuation, event-clustering and t-SNE scatter recipes all fail without"
triggers:
- "Analyze bilateral cross-fish brain state matrix"
- "Generate bilateral cross-fish brain state matrix outputs"
- "Apply the ns_pre-zebrafish-ca-detrend_minfilter_zscore-activity_state_matrix recipe"
tags:
- "zebrafish"
- "ca"
- "detrend"
- "minfilter"
- "zscore"
version: "1.0"
---

# Bilateral cross-fish brain state matrix

Preprocesses every larva's bilateral regional calcium traces into one z-scored region × time
matrix spanning the whole cohort, plus the per-fish 3-D stack and the exclusion index used to
build them.

## When to use this

Use this recipe to combine bilateral regional calcium traces across larvae into a detrended, z-scored brain-state matrix after anatomical and quality exclusions. Do not use it when larvae have incompatible region orders or when truncating all recordings to the shortest duration is unacceptable.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/**/fish<N>/region_series_dff_bilateral.npy` | (140, T) per larva, T = 892 |
| out | `$PROCESS_DATA_DIR/Figure4_excluded_regions_bilateral.npy` | (20,) int |
| out | `$PROCESS_DATA_DIR/Figure4_rseries.npy` | (22, 120, 892) |
| out | `$PROCESS_DATA_DIR/Figure4_state_matrix.npy` | (120, 19624) |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Discover larva folders with `get_datasets(ZEBRAFISH_PATH, keywords=['fish'])`, then `sorted()`.
2. **First pass — build the exclusion set.** Iterate every larva, load its raw (140, T)
   bilateral array, and grow a Python `set`:
   - Seed it with `{10, 80}` — the retina. Index 10 is the retina in unilateral numbering;
     `10 + 70 = 80` is its right-hemisphere copy.
   - Add any bilateral index `r` for which `np.any(raw[r] == 0)` in **any** larva. An exact
     zero in a ΔF/F trace means the region had no sampled signal in that volume, not that
     activity was zero; keeping it would inject a fake flat segment into the state matrix and,
     after z-scoring, a spurious deviation. The union across all larvae is deliberate — a
     region must be usable in every fish or it is dropped from everyone, so all larvae
     contribute the same rows and the concatenation is meaningful.
   - Apply this test to the **raw, unsmoothed** trace. Smoothing first would smear an exact
     zero into a small non-zero value and the region would slip through.
3. **Symmetrise.** For every index `i` in the set, add `i + 70` if `i < 70`, else add `i - 70`.
   A region is only interpretable as a bilateral pair, so if one hemisphere's copy fails, both
   go. This runs in both directions because the zero-signal scan sweeps all 140 indices and can
   flag a right-hemisphere region on its own. Sort and save as
   `Figure4_excluded_regions_bilateral.npy`.
4. Parse fish IDs from the folder basenames (`fish12` → `12`), sort numerically, and assert the
   IDs are exactly `1..n`. Sorting the *folder paths* lexicographically would put fish10 before
   fish2 and scramble the block order in the state matrix; the numeric ID sort is what fixes it.
5. **Second pass — process each larva in fish-ID order:**
   - Reload the raw (140, T) array.
   - Smooth each of the 140 rows independently along time with `gaussian_filter1d(sigma=2)`.
     Row-wise, because a 2-D filter would bleed signal between anatomically unrelated regions.
   - Drop the excluded rows with a boolean keep-mask over 140 → (120, T).
   - `compute_dff_using_minfilter(x, window=30, sigma1=3, sigma2=30)` — running-minimum
     baseline over a 30-frame window, smoothed, to remove slow photobleaching drift. Applied
     **after** exclusion so no compute is wasted on rows that will be discarded, and so the
     baseline estimate is unaffected by the dropped rows (it is per-row, so this is safe).
   - Z-score each row over time with `zscore(row, nan_policy='omit')`, then
     `np.nan_to_num(..., nan=0.0)`. Per-region, per-fish standardisation is what makes traces
     from different larvae with different indicator expression comparable in one heatmap; the
     cost is that absolute amplitude is no longer interpretable across regions.
6. **Stack.** If all larvae share a time length, `np.stack` → (22, 120, 892) and save as
   `Figure4_rseries.npy`. If lengths differ, the script truncates every larva to the minimum and
   warns. Note this 3-D array is built from the *truncated* traces while the state matrix below
   is built from the *untruncated* ones — see Pitfalls.
7. **Concatenate.** `np.concatenate(processed, axis=1)` along time → (120, 19624). Save as
   `Figure4_state_matrix.npy`. Fish blocks sit end to end in fish-ID order; there is no marker
   inside the array, so downstream code recovers boundaries arithmetically from
   `n_timepoints_per_fish`.
8. **Plot** the state matrix as a wide heatmap: `figsize=(21, 3)`, `imshow(cmap='hot',
   aspect='auto', vmin=-1, vmax=3, interpolation='nearest')`. Horizontal white dashed line at
   the left/right midline, solid white verticals at each fish boundary, `Fish <N>` labels above
   each block, `Left`/`Right` labels beside the y-axis, x ticks only at the first and last
   frame (1-indexed for display), vertical colorbar labelled `Activity (z-scored)`.
9. Write `statistics.json`.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `RETINA_INDEX_UNILATERAL` | `10` | Seeds the exclusion set as `{10, 80}`. The retina is light-responsive rather than brain-intrinsic; leaving it in contaminates whole-brain state analyses with stimulus artifacts. |
| bilateral offset | `70` | 70 unilateral regions. Region `i` occupies bilateral indices `i` and `i + 70`. |
| zero-signal test | `np.any(trace == 0)` on the **raw** trace, union over all larvae | Exact equality, not a tolerance. Marks unsampled regions. Union, not intersection, so every larva keeps the same rows. |
| `SMOOTHING_SIGMA` | `2` | Gaussian σ in frames, applied per row before exclusion. Larger σ inflates apparent co-fluctuation downstream. |
| `DFF_WINDOW` | `30` | Min-filter window in frames for the reference implementationline. Too short tracks real signal and flattens events; too long fails to follow bleaching. |
| `DFF_SIGMA1` | `3` | Signal smoothing inside `compute_dff_using_minfilter`. |
| `DFF_SIGMA2` | `30` | Baseline smoothing inside `compute_dff_using_minfilter`. |
| z-score | per region, per fish, along time, `nan_policy='omit'` then NaN→0 | Removes cross-fish expression differences. Forces every row's mean to 0 and SD to 1 *within a fish*, which is why the whole matrix has mean ≈ 0 and SD ≈ 1. |
| `vmin`, `vmax` | `-1`, `3` | Display only. Asymmetric, tuned to make positive events pop against a dark baseline. |
| `cmap` | `'hot'` | Display only. |
| `figsize`, `dpi` | `(21, 3)`, `300` | Very wide — 19624 frames across 22 blocks. |

## Expected results

A correct re-run on the same data should reproduce:

- 22 larvae, fish IDs 1–22, each with T = **892** frames
- 140 bilateral regions → **20 excluded** → **120 kept** (60 per hemisphere)
- Excluded bilateral indices, exactly:
  `[10, 17, 25, 30, 32, 34, 37, 44, 49, 69, 80, 87, 95, 100, 102, 104, 107, 114, 119, 139]`
  — ten unilateral regions `{10, 17, 25, 30, 32, 34, 37, 44, 49, 69}` and their `+70` partners
- `Figure4_rseries.npy` shape **(22, 120, 892)**
- `Figure4_state_matrix.npy` shape **(120, 19624)** (= 22 × 892)
- Activity: mean **8.42e-19** (numerically zero, as z-scoring guarantees), SD **1.0000**,
  min **−7.426**, max **10.759**, median **−0.1918**

The negative median against a zero mean is the signature of the data: a long low baseline
punctuated by rare large positive events, exactly what the downstream co-fluctuation analysis
looks for.

Claims supported: across 22 larvae, large-amplitude z-scored activity is highly synchronized
over 120 regions, appearing as near-simultaneous bursts spanning both hemispheres; and those
bursts are bilaterally symmetric, with peaks concurrent in corresponding left and right regions.

## Pitfalls

- **`Figure4_rseries.npy` and `Figure4_state_matrix.npy` can disagree if time lengths differ.**
  The 3-D stack is built from `processed_fish_data_truncated` (all larvae cut to the shortest),
  but the state matrix is always built from the untruncated `processed_fish_data`. On this
  dataset every larva has T = 892 so the branch never fires and the two agree exactly — which
  is why `ns_ana-zebrafish-ca-circular_null-cofluctuation_event` can safely assert
  `state_matrix.shape[1] == n_fish * n_timepoints_per_fish`. On a ragged dataset that assertion
  fails and, worse, the fish-boundary arithmetic downstream becomes wrong. Verify equal lengths
  before trusting anything downstream.
- **The fish boundaries live nowhere but in `n_timepoints_per_fish`.** The state matrix is a
  plain concatenation with no index array recording where each fish starts. Every downstream
  consumer reconstructs boundaries as multiples of `Figure4_rseries.npy`'s third dimension. If
  you ever produce a ragged state matrix, also emit an explicit boundary array.
- **Two different exclusion masks coexist in this dataset.** `Figure1_excluded_regions.npy` has
  5 unilateral indices `[10, 34, 44, 49, 69]` and governs the 70→65 Figure 1–3 chain.
  `Figure4_excluded_regions_bilateral.npy` has 20 bilateral indices and governs the 140→120
  Figure 4 chain. The Figure 4 set is strictly larger and its unilateral projection
  `{10, 17, 25, 30, 32, 34, 37, 44, 49, 69}` is a superset of the Figure 1 set, but they are
  produced by different criteria and are not interchangeable. A 120-row matrix and a 65-row
  matrix cannot be indexed with the same list.
- **The zero-signal scan runs on raw traces; the exclusion is applied to smoothed ones.** This
  is correct — detect on raw so exact zeros survive, apply to smoothed. Reordering these steps
  silently changes which regions are dropped.
- **Both scripts hold every larva's raw array in memory unnecessarily.** The first pass appends
  to `all_bilateral_data` purely to check the list is non-empty, then reloads each file in the
  second pass. That is 22 × 140 × 892 floats retained for no purpose. Harmless at this size,
  worth deleting on a larger cohort.
- **`MapzebrainAtlas` is imported but never used, and `ATLAS_PATH` is read but never used.**
  Do not conclude the recipe needs an atlas — it does not touch anatomy at all.
- **Prefer the figure-oriented implementation.** It fixes three real rendering defects (see below) while
  producing byte-identical artifacts, and it is the run whose statistics field set matches the
  bundled `statistics.json`. The reference implementation additionally records
  `activity_percentile_25`/`_75`, which the output file does not contain — confirming the stored
  numbers came from the figure-oriented implementation.
- **The midline dashed line was off by half a pixel in the reference implementation.** It drew at
  `n_regions / 2` = 60.0; with `imshow` putting integer coordinates at pixel *centres*, the
  divider between rows 59 and 60 is at 59.5. The figure-oriented implementation uses `n_regions / 2 - 0.5`.
- **`Left` / `Right` panel labels were positioned in data coordinates in the reference implementation**
  (`x = -0.01 * total_time`), so they drift with the number of frames. The figure-oriented implementation anchors
  them in axes coordinates. Same for the `Fish <N>` labels, which were nearly invisible at
  `y = -0.02 * n_regions` and are placed with a blended transform at axes `y = 1.01` in the
  figure-oriented implementation.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
