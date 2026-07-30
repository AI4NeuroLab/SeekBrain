# Method details — ns_ana-zebrafish-ca-circular_null-cofluctuation_event

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Scientific conclusions supported](#scientific-conclusions-supported)
- [Output requirements](#output-requirements)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `n_permutations` | `100` | `for perm_idx in range(100)` | Number of null realisations. Pooled with 19624 frames each → 1,962,400 null values. Raising it refines the tail of the null and moves the 95th percentile slightly; the runtime cost is linear and already the dominant term. |
| random seed | `np.random.seed(42)` | set once, immediately before the permutation loop | Makes the entire 100-iteration sequence reproducible. Because it is set once rather than per iteration, the iterations are not independently reproducible — reproducing iteration 57 alone requires replaying 0–56. |
| shift distribution | `np.random.randint(0, T)` | `permute_timeseries`, per region | Uniform over `[0, 892)`. Drawn independently for every region, every fish, every iteration: 100 × 22 × 120 = 264,000 draws. Shift 0 is possible (p = 1/892 per region) and leaves that region unshifted, which is a legitimate member of the null. |
| triangle selector | `np.triu_indices(R, 1)` | `compute_RMS` | `k=1`: strict upper triangle, 120 × 119 / 2 = 7140 edges. Excluding the diagonal matters — `c_i · c_i = c_i²` is a per-node amplitude, not a co-fluctuation, and including it would add a constant-ish inflation to every frame. |
| RMS formula | `sqrt(mean(edge_values ** 2))` | `compute_RMS` | Root mean square of the *edge* time series at one instant. Because the state matrix is z-scored, `c_i c_j` is an instantaneous unnormalised covariance contribution; squaring makes co-activation and co-deactivation count equally. |
| percentile | `95` | `np.percentile(null_RMS_distribution, 95)` | Yields `Figure4_RMS_threshold.npy`. Reference/display only — not the selection rule. |
| p-value formula | `1.0 - np.sum(null < rms) / len(null)` | per frame | One-sided upper tail. Equals the fraction of null values ≥ the observed. Ties count toward significance's *disfavour* (they are in the ≥ set), so the estimate is conservative with respect to ties but **not** offset-corrected — it can return exactly 0.0. |
| `alpha` | `0.05` | `multipletests(..., alpha=0.05, ...)` | FDR level. |
| `method` | `'fdr_bh'` | `multipletests(..., method='fdr_bh')` | Benjamini-Hochberg step-up. |
| number of tests | 19624 | one per frame | |
| `figsize` | `(21, 3)` | `plt.figure` | Matches the Figure 4A state-matrix panel so the two can be stacked. |
| `GridSpec` | `(2, 1)`, `height_ratios=[4, 1]` | | 80 % / 20 % split as specified. |
| `hspace` | base `0.05`, refine `0.1` | `GridSpec` | |
| RMS trace | `semilogy`, `'k-'`/`color='black'`, `linewidth=0.8` | top axis | Log y is essential: the empirical RMS spans ~1 to ~39 with most mass at the low end. |
| threshold line | red, `linestyle='--'`, `linewidth=1.0` | `axhline` | |
| threshold label | base: legend entry (black); refine: red text at `(0, threshold * 1.15)`, fontsize 10 | | The 1.15 multiplier lifts the text clear of the trace on the log axis. |
| raster | `eventplot`, black, `linewidths=0.5`; refine adds `lineoffsets=0.5`, `linelengths=0.8` | bottom axis | |
| `dpi` | `300` | `savefig` | Neither script passes `bbox_inches='tight'`. |

## Statistical approach

### The measurement: edge-time-series RMS

For each frame `t`, with `c = state_matrix[:, t]` (120 z-scored region values):

```
edges(t)  = { c_i · c_j  :  i < j }          # 7140 values
RMS(t)    = sqrt( mean( edges(t)² ) )
```

This is the standard "edge time series" construction. Because the inputs are z-scored per region
per fish, the time average of `c_i c_j` over one fish is that pair's Pearson correlation — so
`edges(t)` decomposes the functional connectivity of a fish frame by frame, and `RMS(t)` measures
how much of that connectivity is being expressed at instant `t`. Squaring before averaging means
strong anti-coactivation (`c_i` high, `c_j` low) counts as much as strong co-activation; the
measure is about *magnitude of coordination*, not its sign.

### The null model: per-region circular shift within fish

```python
for r in range(R):
    shift = np.random.randint(0, T)
    permuted[r] = np.roll(timeseries[r], shift)
```

**What it preserves.** Each region's marginal amplitude distribution and its full
autocorrelation structure are exactly preserved — a circular shift is a permutation of the time
axis that leaves the periodogram untouched. So the null retains individually bursty, slow,
autocorrelated traces.

**What it destroys.** The temporal *alignment between regions*. Every region gets its own
independent offset, so any tendency for regions to peak together is broken.

**Why this is the right null here.** A shuffle that destroyed autocorrelation (e.g. i.i.d.
resampling of frames) would produce a null with far lower RMS, and essentially every real frame
would be "significant" — the test would only be detecting that calcium signals are
autocorrelated, which is not in question. The circular shift makes the test specifically about
inter-regional synchrony. The analytical report states this correctly: the permutation "ensures
that these detections are not artifacts of signal power spectrums but rather result from
specific temporal coordination among brain regions."

**Why permutation happens per fish, never across the concatenation.** Rolling a trace across a
fish boundary would splice the tail of one animal onto the head of another, creating an artificial
step discontinuity that inflates the null. Permuting each `rseries[fish_idx]` block separately and
then re-concatenating in the same order keeps the null's block structure identical to the
empirical matrix's.

**Assumptions worth stating.**
- Stationarity within a fish. A circular shift assumes the trace's statistics do not drift over
  the recording; the upstream min-filter detrending is what makes this roughly true.
- The wrap point introduces one artificial junction per region per shift. With 892 frames and a
  smooth detrended signal this is negligible, but it is a known small bias of circular nulls.
- Pooling all 100 × 19624 null values into one distribution treats them as exchangeable draws.
  They are not independent — 19624 values from one iteration share the same shift pattern — so
  the pooled distribution is smooth but its effective sample size is well below 1,962,400. This
  matters for the precision of the extreme tail, and it is the reason not to over-interpret a
  p-value of 0 as `< 1/1962400`.

### The decision rule: BH-FDR on empirical p-values

```python
pvalues = np.array([1.0 - (np.sum(null < val) / len(null)) for val in RMS])
reject, pvals_corrected, _, _ = multipletests(pvalues, alpha=0.05, method='fdr_bh')
significant_indices = np.where(reject)[0]
```

**Why FDR and not Bonferroni.** 19624 tests under Bonferroni would demand p < 2.5e-6, which the
empirical p-value grid can barely resolve and which would be needlessly severe for an exploratory
event catalogue. BH controls the expected *proportion* of false events among those declared —
the right error rate when the output is a list to be clustered, not a single confirmatory claim.

**The tests are not independent.** Adjacent frames are highly correlated (the traces were
Gaussian-smoothed with σ = 2 upstream, and events last ~7 frames). BH is valid under positive
regression dependence, which this satisfies, so it is not invalidated — but the effective number
of independent tests is much lower than 19624, making the procedure conservative here.

**The exact-zero p-value problem.** `1 - count(null < val)/N` is 0 whenever the observed RMS
exceeds every null value. Given `max_RMS = 39.31` against a null 95th percentile of 1.39, a large
share of the 1758 significant frames will have p exactly 0. Under BH those are rejected first and
unambiguously. The issue is reporting, not detection: a p of 0 should be written as `p < 1/N`.
The conventional fix, `(count(null >= val) + 1) / (N + 1)`, is not applied by either script.

**The threshold is decorative.** `Figure4_RMS_threshold.npy` = 1.3855 is the 95th percentile of
the null and appears only as the red line. Frames are selected by the FDR test. The two are not
equivalent: 1758/19624 = **8.96 %** of frames pass FDR. That exceeds 5 % because the empirical
distribution is nothing like the null — the correct reading is that far more than 5 % of frames
carry genuine brain-wide synchrony, not that the test is miscalibrated. If you reimplement this
as a simple `RMS > threshold` crossing you will get a different, larger frame set.

### Event construction

Contiguous significant frames form one event, except that a run is split wherever it crosses a
fish boundary. 1758 frames → 244 events, ~7.2 frames per event on average. Each event is reduced
to `state_matrix[:, event_indices].mean(axis=1)`, a 120-vector, which is what
`Figure4_events_high.npy` stores.

No minimum event duration is imposed — single-frame events are kept. No maximum either.

## Recorded statistics (`statistics.json`)

Verbatim, from the original run:

```json
{
  "n_fish": 22,
  "n_regions": 120,
  "n_events": 244,
  "n_significant_frames": 1758,
  "threshold": 1.3855040181852394,
  "max_RMS": 39.30870669039748,
  "null_95th": 1.3855040181852394
}
```

`threshold` and `null_95th` are the same value stored twice — both are
`float(np.percentile(null_RMS_distribution, 95))`. Their equality is a tautology, not a check.

This is the **refine script's** seven-field schema. The base script writes eighteen fields —
`n_timepoints_per_fish`, `n_total_timepoints`, `empirical_RMS_mean/std/median`,
`null_RMS_mean/std/median`, `threshold_95_percentile`, `n_null_permutations`,
`fraction_significant_frames`, `n_discrete_events`, `FDR_alpha`, `events_shape`,
`min_pvalue_corrected`, `max_pvalue_corrected` — **none of which is in the stored file**. The
stored statistics therefore come from the refine run. The base script's extra diagnostics,
including the corrected-p-value range that would confirm the exact-zero issue above, were not
preserved anywhere.

Additional numbers from the execution logs, not in `statistics.json`:

- Null distribution length: **1,962,400** values (= 100 × 19624), confirmed by the base script's
- `Figure4_events_high.npy` shape: **(120, 244)**

## Implementation requirements

Four substantive differences.

### 1. Event splitting across fish boundaries — the important one

**Base script (buggy for ≥ 2 boundaries):**

```python
sub_groups = [group[0:1]]
for boundary in crossed_boundaries:
    mask_before = group < boundary
    mask_after  = group >= boundary
    if np.any(mask_before):
        sub_groups[-1] = group[mask_before]
    if np.any(mask_after):
        sub_groups.append(group[mask_after])
events.extend(sub_groups)
```

Both masks are computed against the **full original `group`** on every iteration. With one
boundary `B₁` the result is correct: `[group < B₁]` and `[group >= B₁]`. With a second boundary
`B₂ > B₁`, the line `sub_groups[-1] = group[mask_before]` overwrites the middle segment
(which should be `B₁ ≤ x < B₂`) with **all** frames `< B₂` — re-including the first segment's
frames. Those frames then appear in two events, and the middle event spans two fish, which the
post-hoc assertion would catch.

**Refine script (correct):**

```python
current_group = group
for b in boundaries_crossed:
    part1 = current_group[current_group < b]
    part2 = current_group[current_group >= b]
    if len(part1) > 0:
        events.append(part1)
    current_group = part2
if len(current_group) > 0:
    events.append(current_group)
```

The remainder is carried forward, so each segment is bounded on both sides. Generalises to any
number of boundaries.

**Does it matter on this data?** No. Crossing two boundaries requires a contiguous significant
run longer than 892 frames; with 1758 significant frames spread over 244 events the longest run
is nowhere near that, and both scripts reported the same 244 events. But the refine version is
the one to copy.

### 2. Threshold labelling

Base adds the threshold as a matplotlib legend entry (`label='95 percentile (null
distribution)'`), rendered in black inside a legend box. The figure critique flagged that the
spec asked for red text, not a legend, and that it must not overlay the trace. Refine draws the
red `axhline` unlabelled and places `ax_top.text(0, threshold * 1.15, "95 percentile (null
distribution)", color='red', fontsize=10, va='bottom')`, keeping a legend for the black trace
only.

### 3. Output filename

Base writes `figure.png`; the spec and the refine script write `figure_refine.png`. This was the
critique's second point.

### 4. Statistics schema

Refine trims eighteen fields to seven, and drops the progress prints and the post-split
verification assertion.

Also, minor: refine adds `lineoffsets=0.5, linelengths=0.8` to the raster `eventplot` and raises
`hspace` from 0.05 to 0.1.

**Use the refine script**, and port back the base script's `n_discrete_events`/`FDR_alpha`/
`empirical_RMS_*` fields and the boundary assertion if you want the fuller record.

### What the figure critique said

1. Threshold labelled via a standard black legend rather than the requested red text placed
   clear of the RMS trace.
2. Output saved as `figure.png` instead of `figure_refine.png`.

It raised no statistical objection — the event-splitting bug was fixed incidentally in the
rewrite, not because the critique noticed it.

## Scientific conclusions supported

From `conclusions.json`:

> Analysis of whole-brain calcium imaging data from 22 zebrafish larvae identifies 244 discrete
> high-amplitude co-fluctuation events where the root mean square (RMS) of pairwise correlations
> reaches a maximum of 39.31, significantly exceeding the 95th percentile null threshold of 1.39
> derived from circular permutations.

> The temporal distribution of 1,758 significant frames (FDR-adjusted p < 0.05) demonstrates
> that synchronized brain-wide activity occurs in sparse, transient bursts rather than as a
> continuous state compared to the lower-amplitude baseline.

Two caveats when citing these. First, "RMS of pairwise correlations" is loose — the quantity is
the RMS of instantaneous edge co-fluctuations `c_i c_j`, which time-averages to a correlation but
is not one frame by frame. Second, "significantly exceeding the 95th percentile null threshold"
conflates the two decision criteria: the 1.39 threshold is the drawn reference line, while
significance was determined by BH-FDR on empirical p-values. Both are true statements about the
data; they are not the same test.

## Output requirements

Figure 21×3 in at 300 dpi (no `bbox_inches='tight'`), two stacked axes from
`GridSpec(2, 1, height_ratios=[4, 1])` — 80 % top, 20 % bottom, matched width.

**Top axis — RMS trace.** `semilogy` of the 19624-point empirical RMS in black,
`linewidth=0.8`. Logarithmic y is necessary given the ~1-to-39 dynamic range. A red dashed
horizontal line at the threshold (1.3855), with the red text `95 percentile (null distribution)`
at `x = 0`, `y = threshold * 1.15`, `va='bottom'`, fontsize 10 — above the line and clear of the
trace. Y-axis labelled `RMS`, fontsize 12. `xlim = [0, len(RMS)]`. X-axis removed: ticks cleared
and the top, right and bottom spines hidden. A small legend at upper right identifying the black
trace as `Empirical RMS`, fontsize 8.

**Bottom axis — significant-frame raster.** `eventplot([significant_indices], colors='black',
linewidths=0.5, lineoffsets=0.5, linelengths=0.8)`, same `xlim` so the raster registers with the
trace above. Axis fully removed (`axis('off')`). Beneath it, centred at axes coordinates
`(0.5, -0.5)`, the text `Total significant frames: 1758`, fontsize 10.

Both runs emit `UserWarning: This figure includes Axes that are not compatible with
tight_layout` — cosmetic, caused by calling `plt.tight_layout()` on a `GridSpec` with explicit
`hspace`.
