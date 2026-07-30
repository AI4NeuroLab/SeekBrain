# Method details — ns_vis-zebrafish-ca_behav-corr_ranking-sensorimotor_trace

## Contents

- [Full parameter list](#full-parameter-list)
- [The 15-sample shift](#the-15-sample-shift)
- [Statistical approach and assumptions](#statistical-approach-and-assumptions)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| fish index | `7` | `fish_folders[7]` | Selects the 8th lexicographically sorted `fish*` folder → `fish16`. Determines every number in `statistics.json` |
| `camera_fps` | `399.75` | inline constant | Behaviour sampling rate. Sets `duration`, which in turn sets the calcium time axis, so an incorrect value rescales the entire figure |
| swim threshold | `0.5` | `(swim_events > 0.5)` | Absolute threshold, strict `>`. Yields 2671 active frames of 360000 (0.742%) |
| shift | `15` samples | `binary_swim[15:]` + `np.zeros(15)` | 37.5 ms advance. See "The 15-sample shift" below |
| target length | `360000` | zero-pad (base) / pad-or-truncate (refine) | 900.563 s at 399.75 Hz. The input is already 360000 long, so neither branch fires for the recorded dataset |
| neurons per class | `50` | `[-50:]` / `[:50]` | Fixed count, not a correlation cut-off |
| Motor+ selector | `argsort(correlations_motor)[-50:]` | | 50 largest motor correlations |
| Motor− selector | `argsort(correlations_motor)[:50]` | | 50 smallest (most negative) — opposite tail of the same vector |
| Dark selector | `argsort(correlations_dark)[-50:]` | | |
| Light selector | `argsort(correlations_light)[-50:]` | | |
| calcium time axis | `np.linspace(0, duration, 892)` | | 892 points stretched across the behaviour duration; no per-frame timestamps |
| `height_ratios` | `[1, 1, 2, 2, 2, 2]` (refine) | `GridSpec(6, 1)` | 2 units of context over 8 units of calcium = the specified 20% / 80% split |
| `height_ratios` | `[0.5, 0.5, 2, 2, 2]` (base) | `GridSpec(5, 1)` | Only 3 calcium panels — the layout bug the figure-oriented implementation pass fixes |
| `hspace` | `0` | `GridSpec` | Panels butt together into one continuous raster |
| `figsize` | `(12, 5)` | `plt.figure` | |
| swim fill | `color='black'`, `alpha=0.7` | `fill_between` | |
| swim `ylim` | `[0, 1.2]` | | Headroom above the binary 1 |
| stim line | `color='black'`, `linewidth=0.5` | `plot` | |
| stim `ylim` | `[-0.2, 1.2]` | | Consistent with a 0/1 stimulus trace |
| context labels | `"Motor"`, `"Stim."` at `fontsize=10`, `va='center'` | `ax.text` | Placed to the right of the axes: `time_swim[-1] + 5` (base, a fixed 5 s) vs `duration + duration*0.01` (refine, ≈9 s and duration-relative) |
| Motor+ colour | `[0, 0.8, 0.2]` green | | |
| Motor− colour | `[1, 0, 1]` magenta | | |
| Dark colour | `[1, 0, 0]` red | | |
| Light colour | `'orange'` | | |
| trace `alpha` | `0.1` | individual neurons | With 50 overlaid traces, opacity encodes coincidence density |
| trace `linewidth` | `0.5` | individual neurons | |
| `rasterized` | `True` | individual neurons only | 200 traces × 892 points as vectors would produce an unusable file; the mean trace stays vector |
| mean trace | `color=[0, 0, 0]`, `alpha=1`, `linewidth=0.5` | | Drawn on the same axis with no vertical offset |
| Dark offset | `+1.5` | reference implementation only | Separates Dark from Light inside the shared third panel — an artefact of the reference implementation layout bug, absent from the figure-oriented implementation |
| axes | `ax.axis('off')` on every panel | | No spines, ticks, or labels anywhere |
| `dpi` | `300` | `savefig` | |
| `bbox_inches` | `'tight'` | `savefig` | |

## The 15-sample shift

The behaviour trace is advanced by dropping its first 15 samples and appending 15 zeros:

```python
binary_swim = binary_swim[15:]
binary_swim = np.concatenate([binary_swim, np.zeros(15, dtype=int)])
```

so `binary_swim[t] = original[t + 15]`. Three facts about this operation, none of which is
stated in the run:

1. **Magnitude.** 15 / 399.75 Hz = **37.5 ms**. The calcium frame interval is
   900.560 / 891 ≈ **1.011 s**, so the shift is 3.7% of one calcium frame and 0.004% of the
   900 s record. It cannot change anything visible in this figure.
2. **Direction.** It moves behaviour *earlier*. Calcium fluorescence lags the underlying
   spiking; aligning a lagging calcium signal to behaviour means delaying the behaviour trace,
   not advancing it. This shift goes the other way.
3. **Stated rationale.** `analytical_report.md` says "To align with calcium imaging delays,
   the trace was temporally shifted". GCaMP rise and decay operate on hundreds of
   milliseconds. 37.5 ms is the wrong order of magnitude for that correction and, per (2), the
   wrong sign.

The most likely reading is a fixed DAQ/trigger offset between the behaviour camera and the
imaging clock, which would be a plausible thing to correct and would plausibly be tens of
milliseconds. Reproduce the step for byte-fidelity with the reference implementation; do not carry the
"calcium indicator lag" justification forward, and do not reuse this as a lag correction in
any analysis where the alignment actually affects the result.

## Statistical approach and assumptions

**There is no statistical test in this recipe.** No null model, no p-value, no correction, no
across-animal comparison. `statistics.json` contains descriptive summaries of the selected
neurons and of the behaviour trace, nothing inferential.

**Selection by rank, not by threshold.** Taking the top 50 by correlation guarantees an
"ensemble" exists regardless of whether any neuron is meaningfully tuned. The observed
correlations here are high enough (Motor+ r ≥ 0.61, Dark r ≥ 0.75) that the selected cells are
clearly real responders, but the procedure itself provides no evidence of that — a shuffled
dataset would still yield a top 50.

**Selection-induced bias.** Because the neurons are chosen *by* their correlation and then
those same correlations are summarised, the stated requiremented means (0.63, −0.31, 0.79, 0.37) are
extreme-order statistics of 69646 values, not estimates of any population parameter. They
describe which neurons ended up in the figure. Quoting them as "motor neurons correlate at
r = 0.63" would be circular.

**Dark versus light asymmetry.** The headline observation — dark-tuned neurons correlate more
strongly with their stimulus (0.79) than light-tuned neurons with theirs (0.37) — is a
comparison between the tails of two different distributions in one animal, with no test and
no second larva. It is a legitimate observation about this figure and not a finding about
zebrafish visual processing.

**Motor+ and Motor− are not independent populations.** Both come from
`correlations_motor`; Motor− is that vector's negative tail. The separation between their means
is a property of the distribution's spread, guaranteed by construction to be non-zero.

**Cross-modality alignment.** Calcium (892 points) and behaviour (360000 points) are placed on
one axis by stretching a `linspace` across the same duration. No resampling, no interpolation,
no per-frame timestamps. Any acquisition jitter or trigger offset beyond the fixed 15-sample
shift is invisible and uncorrected. This is adequate for a qualitative overview panel and not
adequate for any timing-sensitive quantification.

## Recorded statistics (`statistics.json`)

Verbatim from the reference implementation — written by the **base** script; the figure-oriented implementation writes no
statistics at all:

```json
{
  "fish_folder": "fish16",
  "total_neurons": 69646,
  "total_timepoints": 892,
  "total_swim_samples": 360000,
  "recording_duration_seconds": 900.5603502188868,
  "motor_plus": {
    "n_neurons": 50,
    "mean_correlation": 0.6344915552633252,
    "std_correlation": 0.019371207588801953,
    "median_correlation": 0.6280999167458312,
    "min_correlation": 0.607678410787745,
    "max_correlation": 0.6764381796836175,
    "mean_activity": 1.2059749588635558,
    "std_activity": 1.8169578429512296
  },
  "motor_minus": {
    "n_neurons": 50,
    "mean_correlation": -0.3064765332847331,
    "std_correlation": 0.03239955516018831,
    "median_correlation": -0.30165298604628976,
    "min_correlation": -0.38955158077767005,
    "max_correlation": -0.26576860788311707,
    "mean_activity": 1.1607195890306687,
    "std_activity": 1.085659224229094
  },
  "dark": {
    "n_neurons": 50,
    "mean_correlation": 0.7943579491868724,
    "std_correlation": 0.03725011531979113,
    "median_correlation": 0.7869310559352083,
    "min_correlation": 0.7455613931872961,
    "max_correlation": 0.8764381360025969,
    "mean_activity": 0.9881686665178631,
    "std_activity": 1.321770696421433
  },
  "light": {
    "n_neurons": 50,
    "mean_correlation": 0.3712443850911625,
    "std_correlation": 0.05898666933808429,
    "median_correlation": 0.3566810161690457,
    "min_correlation": 0.31512200166519644,
    "max_correlation": 0.6573295018657861,
    "mean_activity": 0.8563324098896234,
    "std_activity": 1.014036054837571
  },
  "swim_events": {
    "total_frames": 360000,
    "active_frames": 2671,
    "fraction_active": 0.007419444444444445
  }
}
```

Notes on reading these:

- `recording_duration_seconds` is `time_swim[-1]` = 359999 / 399.75, **not** 360000 / 399.75
  (= 900.5629). The reference implementation's calcium axis uses the latter; the 2.5 ms difference is far
  below one calcium frame.
- `mean_activity` / `std_activity` are over the whole selected ΔF/F₀ block (50 neurons ×
  892 frames), pooling neurons and time. They are not per-neuron and carry no timing
  information.
- The `light` group's `max_correlation` (0.657) sits well above its 75th-percentile
  neighbourhood (median 0.357, min 0.315), so the light-tuned distribution has a short heavy
  tail — a handful of well-tuned cells above a much flatter bulk. That is consistent with the
  lower group mean and is the clearest structural difference from the dark group.

## Scientific conclusion supported

From `conclusions.json`:

> In the analyzed zebrafish larva (fish16), the top 50 neurons identified as Motor+ exhibit a
> strong positive correlation (mean r ≈ 0.63) with discrete swimming events, clearly
> differentiating their transient spiking activity from the reference implementationline activity of Motor−
> neurons (mean r ≈ −0.31).

> The visual processing circuits in this subject display an asymmetry in response strength,
> where the top 50 neurons correlated with dark stimuli show a significantly higher mean
> correlation coefficient (r ≈ 0.79) compared to the top 50 neurons correlated with light
> stimuli (r ≈ 0.37).

Both are explicitly scoped to one larva, which is appropriate. The word "significantly" in the
second is not backed by any test — no comparison was performed against a null, and n = 1
animal. Read it as "larger", not as a statistical claim.

## Figure specification

Figure 12×5 in, 300 dpi, saved with `bbox_inches='tight'`. `GridSpec(6, 1,
height_ratios=[1, 1, 2, 2, 2, 2], hspace=0)` — a context band occupying the top 20% of the
height over four equal-height calcium panels occupying the bottom 80%. Every panel has
`axis('off')` and `xlim = [0, duration]`, so the six rows read as one continuous raster with a
shared but invisible time axis.

Row 1 — behaviour. `fill_between(time_swim, 0, binary_swim)` in black at `alpha=0.7`,
`ylim [0, 1.2]`, with the text `Motor` placed just past the right edge at `fontsize=10`,
vertically centred.

Row 2 — stimulus. `sequence_stimuli` line-plotted in black at `linewidth=0.5` against
`linspace(0, duration, len(sequence_stimuli))`, `ylim [-0.2, 1.2]`, text label `Stim.` in the
same right-margin position.

Rows 3–6 — calcium, top to bottom Motor+, Motor−, Dark, Light. Each panel overlays all 50
selected neurons' ΔF/F₀ in the group colour at `alpha=0.1`, `linewidth=0.5`,
`rasterized=True` — green `[0, 0.8, 0.2]`, magenta `[1, 0, 1]`, red `[1, 0, 0]`, `'orange'`
respectively — with the population mean superimposed in solid black, `alpha=1`,
`linewidth=0.5`, on the same axis with no vertical offset.

No spines, no ticks, no axis labels, no legend, no scale bar anywhere in the figure.

The known rendering failure was the reference implementation's three-panel layout with Dark and Light
merged; see Pitfalls in `RECIPE.md`.
