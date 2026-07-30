---
name: ns_ana-zebrafish-ca-circular_null-cofluctuation_event_trace
description: Detect discrete high-amplitude co-fluctuation events in zebrafish whole-brain calcium data by computing the RMS of pairwise edge co-fluctuations at every frame, building a circular-shift null distribution, and thresholding with Benjamini-Hochberg FDR-corrected empirical p-values. Reach for this whenever someone asks about "co-fluctuation events", "edge time series", "RMS of coactivation", "moments of synchronized brain-wide activity", "high-amplitude events", "brain-wide bursts", "circular permutation null model", "how do I know these synchrony peaks are not chance", or needs the discrete event set that brain-state clustering operates on. It writes Figure4_RMS.npy, Figure4_null_RMS_distribution.npy, Figure4_RMS_threshold.npy and Figure4_events_high.npy — the last being the required input for the t-SNE/HDBSCAN state clustering and the state-cluster scatter.
triggers:
- Run the Circular-null co-fluctuation event detection recipe
- Detect discrete high-amplitude co-fluctuation events in zebrafish whole-brain calcium data by computing the RMS of pairwise edge co-fluctuations at every frame, building a circular-shift null distribution, and thresholding with Benjamini-Hochberg FDR-corrected empirical p-values.
- Generate the outputs described by ns_ana-zebrafish-ca-circular_null-cofluctuation_event_trace
tags:
- zebrafish
- ca
- circular
- 'null'
- cofluctuation
version: '1.0'
---

# Circular-null co-fluctuation event detection

Turns a cross-fish state matrix into a set of discrete, statistically significant brain-wide
synchronization events, with a null model that preserves each region's autocorrelation.

## When to use this

The question is *"when does the whole brain light up together, and is that more than chance?"*
This is the statistical core of the Figure 4 chain: it converts a continuous 120 × 19624
activity matrix into 244 discrete events, each summarised as a 120-vector of mean activity.

Run `ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix` first — both of this recipe's
inputs come from it. The event matrix this recipe writes is the sole input to
`ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster` and
`ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter`.

## Preconditions

- `$PROCESS_DATA_DIR/Figure4_state_matrix.npy` — (120, 19624), z-scored, fish blocks
  concatenated in fish-ID order.
- `$PROCESS_DATA_DIR/Figure4_rseries.npy` — (22, 120, 892). Both are checked with
  `os.path.exists` and raise `FileNotFoundError` if absent, which is the right behaviour: the
  boundary arithmetic depends on both being present and consistent.
- The two must satisfy `state_matrix.shape[1] == n_fish * n_timepoints_per_fish`. The script
  asserts this. It holds only because every larva has the same 892 frames.
- Env vars `PROCESS_DATA_DIR` and `SAVE_DIR`. Read with plain `os.getenv` and not validated.
  `ZEBRAFISH_PATH` and `ATLAS_PATH` are unused.
- `statsmodels` (`stats.multitest.multipletests`) and `numpy`.
- Both scripts wildcard-import five library modules — `zebrafish_Ca_utils.py`,
  `zebrafish_Ca_stats_patch_xps.py`, `zebrafish_Ca_utils_patch_xps.py`,
  `zebrafish_Ca_utils_predictors_xps.py`, `zebrafish_Ca_visualization_patch_xps.py`. All five are
  vendored into `scripts/`, and the `sys.path` line points at the script's own directory, so the
  imports resolve with no external setup. That single line is the only edit to the script;
  everything else is as it ran. But every function the method actually uses is **defined inline in
  the script**, so nothing is resolved from those modules — see Pitfalls. Deleting the imports
  also drops their load-time cost (`numba`, `bctpy`, `networkx`, `hdbscan`, `opencv-python`),
  none of which this method needs.
- Budget the runtime. The null model computes `compute_RMS` on a 120 × 19624 matrix 100 times,
  each frame forming a 120 × 120 outer product in a Python loop — roughly 2 million outer
  products.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure4_state_matrix.npy` | (120, 19624) |
| in | `$PROCESS_DATA_DIR/Figure4_rseries.npy` | (22, 120, 892) |
| out | `$PROCESS_DATA_DIR/Figure4_RMS.npy` | (19624,) |
| out | `$PROCESS_DATA_DIR/Figure4_null_RMS_distribution.npy` | (1962400,) |
| out | `$PROCESS_DATA_DIR/Figure4_RMS_threshold.npy` | (1,) |
| out | `$PROCESS_DATA_DIR/Figure4_events_high.npy` | (120, 244) |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load both artifacts; unpack `n_fish, n_regions, n_timepoints_per_fish = rseries.shape` and
   assert the state matrix's time length equals `n_fish * n_timepoints_per_fish`.
2. **Empirical RMS.** For each frame `t`, take the column `c = state_matrix[:, t]`, form the
   outer product `c cᵀ`, keep the strict upper triangle (`np.triu_indices(R, 1)` — off-diagonal
   only, since a region's co-fluctuation with itself is just its squared amplitude and would
   inflate every frame equally), and take `sqrt(mean(values²))`. This is the edge-time-series
   RMS: one scalar per frame measuring how strongly the whole network is co-fluctuating. Save as
   `Figure4_RMS.npy`.
3. **Circular-shift null.** Seed with `np.random.seed(42)`, then repeat 100 times:
   - For each fish independently, roll **each region's trace by its own random offset**
     drawn from `np.random.randint(0, T)`. Rolling per region is the point: a circular shift
     preserves each region's amplitude distribution and autocorrelation exactly, so the null
     asks only whether regions are aligned *with each other*, not whether they are individually
     bursty. A global shift would preserve alignment and produce a useless null.
   - Permute within a fish, never across fish. Rolling across a concatenated boundary would
     splice one larva's tail onto another's head and manufacture a discontinuity.
   - Concatenate the 22 permuted blocks along time in the same order, then run the same
     `compute_RMS` on the result.
   - Pool all 100 × 19624 = 1,962,400 null RMS values into one flat array. Save as
     `Figure4_null_RMS_distribution.npy`, and assert its length.
4. **Threshold.** Take the 95th percentile of the pooled null. Save as
   `Figure4_RMS_threshold.npy` (a length-1 array). This value is drawn as the red line on the
   figure; it is **not** what selects the significant frames — see step 5 and Pitfalls.
5. **Significance.** For each empirical frame compute the one-sided empirical p-value
   `p = 1 - count(null < rms) / N_null`, i.e. the fraction of the null at or above the observed
   value. Then apply `multipletests(pvalues, alpha=0.05, method='fdr_bh')` — Benjamini-Hochberg
   FDR across all 19624 frames — and take `np.where(reject)[0]` as the significant frames. FDR
   rather than Bonferroni because 19624 dependent tests under Bonferroni would leave almost
   nothing, and controlling the expected proportion of false events is the right error rate for
   an exploratory event catalogue.
6. **Group frames into events, splitting at fish boundaries.** This is the step most easily got
   wrong:
   - Compute `fish_boundaries = np.arange(T_per_fish, T_total, T_per_fish)` — the first frame
     index of fish 2, 3, …, 22. Note it excludes 0 and excludes `T_total`, so it holds 21 values
     for 22 fish.
   - Split the sorted significant indices into contiguous runs wherever
     `np.diff(indices) > 1`.
   - For each run `[start … end]`, find the boundaries it straddles:
     `fish_boundaries[(fish_boundaries > start) & (fish_boundaries <= end)]`. The asymmetric
     comparison is deliberate — a boundary `B` equal to `start` means the run *begins* at a fish
     start and does not straddle anything, whereas `B <= end` catches a run whose last frame is
     the first frame of the next fish.
   - Split the run at each straddled boundary, walking left to right and carrying the remainder
     forward. Frames at or after `B` become a new event; frames before it close the current one.
   - Splitting matters because contiguity in the concatenated index is an artifact of stacking:
     the last frame of fish 7 and the first frame of fish 8 are adjacent columns but are
     separated by a different animal and an unknown amount of real time. Merging them would
     create an event that never happened.
7. **Summarise each event** as the mean over its frames, `state_matrix[:, idx].mean(axis=1)`,
   giving a 120-vector. Column-stack into (120, n_events) and save as `Figure4_events_high.npy`.
   Handle the empty case by writing a `(n_regions, 0)` array rather than crashing.
8. **Verify** that no surviving event spans two fish: `event_indices // n_timepoints_per_fish`
   must have exactly one unique value. Keep this assertion — it is the only check that step 6
   worked.
9. **Plot** at `figsize=(21, 3)` with a 4:1 `GridSpec`: top axis is the empirical RMS on a log y
   scale (`semilogy`, black, `linewidth=0.8`) with a red dashed threshold line; bottom axis is
   an `eventplot` raster of the significant frames with the total count printed beneath.
10. Write `statistics.json`.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `n_permutations` | `100` | Sets the null's resolution. The pooled null has 1,962,400 values, so the empirical p-value grid is fine, but only 100 independent realisations of the *shift pattern* — the pooling makes the distribution smooth, not independent. |
| `np.random.seed(42)` | `42` | Set once before the permutation loop, so the whole 100-iteration sequence is reproducible. Change it and the threshold moves in the third decimal. |
| shift distribution | `np.random.randint(0, T)` per region, per fish, per iteration | Uniform over the full 892-frame length. Includes shift 0, which leaves a region unshifted — a negligible 1/892 chance per region. |
| percentile | `95` | Defines `Figure4_RMS_threshold.npy`. Display and reference only. |
| `alpha` | `0.05` | FDR level passed to `multipletests`. |
| `method` | `'fdr_bh'` | Benjamini-Hochberg. |
| p-value formula | `1 - count(null < rms) / N` | One-sided upper tail, counting ties as significant-side. Can return exactly 0.0 — see Pitfalls. |
| triangle | `np.triu_indices(R, 1)` | `k=1`, strict upper triangle. Excludes the diagonal. |
| `vmin`/`vmax` | none | The RMS trace is plotted on a log scale, unbounded. |
| `figsize`, height ratios | `(21, 3)`, `[4, 1]` | Wide, matching the Figure 4A state-matrix panel width. |

## Expected results

A correct re-run with the same seed and inputs should reproduce:

- 22 fish, 120 regions, 19624 frames; null distribution of exactly **1,962,400** values
- Threshold (95th percentile of null) = **1.3855040181852394**
- Maximum empirical RMS = **39.30870669039748** — roughly 28× the threshold
- **1758** significant frames after BH-FDR (8.96 % of all frames)
- **244** discrete events after contiguity grouping and fish-boundary splitting
- `Figure4_events_high.npy` shape **(120, 244)**

1758 frames over 244 events averages ~7.2 frames per event. The claim these support: the
zebrafish brain shows 244 discrete high-amplitude co-fluctuation events whose RMS reaches 39.31
against a 1.39 null threshold, occurring as sparse transient bursts rather than a sustained
state.

## Pitfalls

- **The saved threshold is not the decision rule.** `Figure4_RMS_threshold.npy` (1.3855) is the
  95th percentile of the null and is drawn as the red line, but frames are selected by
  FDR-corrected empirical p-values instead. The two disagree: 8.96 % of frames pass FDR, which
  is more than the 5 % a naive 95th-percentile cut on the *null* would imply for null-like data
  — because the empirical distribution is far from null. If you reimplement this, do not
  substitute a simple threshold crossing for the FDR test and expect the same 1758 frames.
- **Empirical p-values can be exactly 0.** `1 - count(null < rms)/N` returns 0 when the observed
  RMS exceeds every one of the 1,962,400 null values. A p of 0 is not a real probability — the
  honest statement is `p < 1/N`. Under BH this makes those frames trivially significant, which
  is defensible given the effect size, but the conventional `(count + 1) / (N + 1)` correction
  is absent. Do not quote a p-value of 0 in text.
- **The base script's boundary-splitting loop is wrong for runs crossing two or more boundaries;
  the refine script's is correct.** The base version recomputes `group < boundary` against the
  **full original run** on every iteration instead of against the remaining tail, so a second
  boundary overwrites the middle segment with all frames below it — duplicating the first
  segment's frames and producing an event that spans two fish. The refine script carries
  `current_group = part2` forward and generalises correctly. It cannot bite on this dataset (a
  run would have to span more than 892 contiguous significant frames), and the post-split
  assertion would catch it if it did — but copy the refine version. Full diff in
  `references/method_details.md`.
- **`compute_RMS` and `permute_timeseries` are defined inline, not imported.** Both scripts do
  `from zebrafish_Ca_utils import *` plus four more wildcard imports, and the task specification
  says to "use the function `compute_RMS`" and `permute_timeseries` — but both scripts then
  define functions of those names in the script body, which shadow anything the wildcards
  brought in. The code, not the report, is the truth: this recipe's method is self-contained and
  the five wildcard imports can be deleted. They are vendored alongside the script so they *do*
  import cleanly, but importing them still pulls in their own heavy third-party stack (`numba`,
  `bctpy`, `networkx`, `hdbscan`, `opencv-python`) at load time for no benefit. Dropping them
  also makes the exact RMS definition legible rather than seemingly hidden behind a library call.
- **`gaussian_filter1d` is imported and never used** in either script. Leftover.
- **Prefer the refine script.** The stored `statistics.json` has its seven-field schema, not the
  base script's eighteen-field one, so the stored results come from the refine run. The base
  script's richer diagnostics (`empirical_RMS_mean/std/median`, `null_RMS_mean/std/median`,
  `fraction_significant_frames`, `min`/`max_pvalue_corrected`) were **not** preserved anywhere.
  The refine script also fixes the output filename and renders the threshold label as red text
  clear of the trace instead of a black legend entry.
- **`tight_layout` warns.** Both runs emit `UserWarning: This figure includes Axes that are not
  compatible with tight_layout` — cosmetic, triggered by the `GridSpec` with explicit `hspace`.
  Do not read it as a failure.
- **The state matrix has no internal fish markers.** Boundaries are reconstructed purely from
  `Figure4_rseries.npy`'s third dimension. If the upstream recipe ever produces ragged-length
  fish, `n_timepoints_per_fish` stops being meaningful and every boundary here becomes wrong —
  which is exactly what the `state_matrix.shape[1] == n_fish * n_timepoints_per_fish` assertion
  guards against.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim. Richer statistics; buggy
  multi-boundary split.
- `scripts/refine_implementation.py` — correct event splitting, red threshold text, correct
  output filename; trimmed statistics. **Prefer this one**, and graft the base script's extra
  statistics fields onto it if you need them.
- `references/data_contract.md` — env vars, inline vs imported helpers, artifact shapes and
  consumers, the fish-boundary index convention.
- `references/method_details.md` — every parameter, the null model and its assumptions, full
  statistics, base-vs-refine diff, figure specification, provenance.
