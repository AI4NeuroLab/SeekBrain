# Method details — ns_pre-zebrafish-ca-minfilter-dff_region_series

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `MAX_FISH_TO_PROCESS` | `5` (base only) | `fish_folders[:5]` | Caps the processing loop at 5 larvae. **Removed in the figure-oriented implementation.** |
| first-frame fix | `timeseries[:, 0] = timeseries[:, 1]` | Preprocessing | Overwrites the acquisition-artefact frame. Done before any filtering, so it cannot contaminate the running minimum. |
| pre-smoothing `sigma` | `3` frames | `gaussian_filter1d(signal, sigma=3)` | Suppresses shot noise so the minimum filter tracks the signal floor instead of a noise trough. Too large and real fast decays get pulled into the reference implementationline. |
| baseline window `size` | `300` frames | `minimum_filter1d(smooth1, size=300, mode='nearest')` | ≈ 5 min at ≈ 1.01 s/frame. Long relative to a calcium transient, short relative to photobleaching, which is exactly the separation the method needs. Shorten it and sustained activity is absorbed into F₀ (ΔF/F₀ collapses); lengthen it and drift is not removed. |
| `mode` | `'nearest'` | same | Edge replication. Avoids the artificial minima that zero-padding would create at both ends of the record. |
| post-smoothing `sigma` | `60` frames | `gaussian_filter1d(baseline, sigma=60)` | Converts the piecewise-constant staircase output of a running minimum into a smooth F₀. Without it, ΔF/F₀ inherits step discontinuities at every window boundary. |
| baseline clamp | `1e-10` | `baseline_safe = np.maximum(baseline, 1e-10)` | Denominator floor. The numerator `(signal - baseline)` uses the **unclamped** baseline, so for a non-positive baseline the numerator and denominator are inconsistent. In practice fluorescence is positive and the clamp never engages; the NaN/Inf assertions would catch it if it did. |
| NaN/Inf assertions | `assert not np.any(np.isnan(dff))`, `... isinf ...` | Post-ΔF/F₀ | Real guards. A silent Inf here would propagate into every correlation downstream. |
| regional reduction | `np.mean(dff[mask], axis=0)` | Regional averaging | Plain `mean`, valid because `dff` is asserted NaN-free. Empty regions get an explicit `np.nan` row instead. |
| plot smoothing `sigma` | `1` frame | `gaussian_filter1d(trace, sigma=1)` | Cosmetic only; the saved arrays are unsmoothed. |
| normalisation | per-region min-max to `[0, 1]` | `(x - min) / (max - min)` with a `1e-10` guard | Display only. Equalises amplitude across regions, so the figure conveys timing and shape, not magnitude. |
| vertical `offset` | `0.5` | `y_offset = (n - 1 - i) * offset` | Stacking spacing; also sets the y limits. |
| trace colour / width | `'black'`, `0.5` | | |
| acronym `fontsize` | `6` | | Placed at `timesteps[-1] + 20`, `y_offset + 0.25` |
| orientation label x | `text_x + 80` (base) / `text_x + 250` (refine) | | The reference implementation value collides with the acronym column. |
| orientation label rotation | `90` (base) / `270` (refine) | | At 90° the string reads bottom-to-top, putting "Anterior" at the bottom while the anterior regions are at the top — the opposite of the data layout. |
| orientation label alignment | `ha='left'` in the reference implementation) / `ha='center'` in the recommended implementation | | |
| y-caption | `"Regional fluorescence (normalized)"` at `x = -80`, `rotation=90`, fontsize 8 | | |
| `bar_duration` | `120` s | Scale bar | Drawn in data coordinates from `x = 50` to `x = 170`, at `y = -0.75`, `linewidth=2` |
| stimulus window | `660`–`840` s | `ax.axvspan(..., color='orange', alpha=0.3, zorder=0)` | Hard-coded literals for "11th–14th minute". Not derived from `timesteps` or any stimulus channel. |
| stimulus label | `"stimuli"`, fontsize 7, `darkorange`, bold | | Placed at `n * offset + 0.5` |
| `xlim` | `(-100, timesteps[-1] + 200)` (base) / `(-100, far_right_x + 100)` (refine) | | The reference implementation limit clips the orientation label. |
| `ylim` | `(bar_y - 1, n * offset + 1.5)` | | |
| `figsize` | `(5, 6)` | | |
| `dpi` | `300` | `savefig(..., bbox_inches='tight')` | |

## Statistical approach

**Baseline estimation (G3 → Min300 → G60).** The problem is separating slow multiplicative
drift — photobleaching, focus drift — from calcium transients that are, by construction,
positive excursions above a floor. A running minimum estimates that floor without any model of
transient shape, which is why it is preferred here over a percentile or a polynomial fit. The
two Gaussian passes fix the two failure modes of a bare running minimum: it latches onto single
noisy samples (fixed by pre-smoothing) and it produces a staircase (fixed by post-smoothing).

The method assumes each neuron returns to baseline at least once per 300-frame window. A
region tonically active for longer than 5 minutes would have its sustained component absorbed
into F₀ and would appear artificially quiet. This is the main assumption to check when the
recording paradigm changes.

**ΔF/F₀.** `(F − F₀) / F₀`, computed per neuron, no detrending or z-scoring afterwards. The
result is unitless and comparable across neurons only to the extent that F₀ is a valid
per-neuron scale.

**Regional averaging.** An unweighted mean over the neurons assigned to a region. Neurons in
multiple regions contribute to each — `region_labels` is multi-hot and this script uses the
boolean column directly rather than collapsing with `argmax` the way
`ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask` does. So a region's mean can include
neurons that also count toward a neighbouring region. Region means are not independent samples.

Averaging raises the signal-to-noise ratio roughly as √n and reduces the problem from ~54 000
neurons to 70 series. It also discards all within-region spatial structure — that is the
intended trade, but it means any downstream claim about a region is a claim about its mean.

**Unsampled regions become NaN, not zero.** This is a deliberate encoding choice: zero is a
valid ΔF/F₀ value (meaning "at baseline"), so using it for "no data" would be
indistinguishable from a silent region. Every downstream consumer therefore has to make an
explicit decision — `ns_ana-zebrafish-ca-pearson-fc_matrix` uses `np.nanmean` to average across
larvae, `ns_ana-zebrafish-ca-triu_pearson-network_stereotypy` uses `np.nan_to_num(nan=0.0)`.
The two choices are not equivalent and both are documented in their own recipes.

**No significance testing.** This recipe is preprocessing; it produces no p-values and no
statistical claim beyond the descriptive figure.

## Recorded statistics (`statistics.json`)

Verbatim from the reference implementation (`region_acronyms_plotted` shown in full — all 65 entries):

```json
{
  "n_fish_processed": 22,
  "n_regions_total": 70,
  "n_excluded_regions": 5,
  "n_regions_plotted": 65,
  "fish2_timeseries_shape": [70, 892],
  "fish2_time_range_seconds": [0.0, 903.0641399996389],
  "visual_stimulation_period_seconds": [660, 840],
  "baseline_window_frames": 300,
  "gaussian_sigma1": 3,
  "gaussian_sigma2": 60,
  "plot_smoothing_sigma": 1,
  "vertical_offset": 0.5,
  "scale_bar_duration_seconds": 120,
  "region_acronyms_plotted": [
    "OE", "OB", "VT", "DT", "DH", "Epi", "VH", "VEN", "ETR", "POR",
    "VTAP", "TL", "DTP", "PTAP", "SO", "PT", "RH", "SM", "SFGS", "SFGS-SGC",
    "SGC", "SAC-SPV", "SAC", "MTR", "DNIL", "NMLF", "LT", "PVL", "TS", "IHR",
    "ON", "TG", "TMN", "NI", "IPN", "ALLG", "SDMOS1R", "SR", "SDMOS2-3", "LC",
    "Cb", "SVMOR", "SDMOS4", "ADTMN", "SDMOS5", "PVTMN", "OG", "IntDMOS1",
    "IntDMOS2&3", "IntDMOS4", "IntDMOS5", "IntVMOR", "MON", "IR", "FMN", "AMN",
    "InfVMOR", "InfDMOS4", "InfDMOS5", "PLLG", "InfDMOS2-3", "InfDMOS1", "VMN",
    "IO", "VSL"
  ],
  "processing_notes": "First frame artifact corrected by copying second frame. Baseline estimated with Gaussian-filtered minimum filter. Regional traces smoothed and min-max normalized."
}
```

Use one stable statistics schema. The bundled implementations emit
`gaussian_sigma1_prefilter` and `gaussian_sigma2_postfilter`, include `n_fish_total` and
`fish2_name`, and store only the first 10 entries in `region_acronyms_plotted`. Map those fields
explicitly if compatibility with the example JSON above is required.

Processing all 22 larvae requires the uncapped implementation. The reference implementation
limits processing to five larvae, so remove that cap before comparing its summary values with
the 22-larva Expected results.

## Scientific conclusion supported

From `conclusions.json`:

> The normalized regional calcium time series (ΔF/F0) for Fish 2 exhibit distinct temporal
> fluctuations and spontaneous transients across 65 brain regions, characterizing the
> heterogeneous neuronal activity patterns distributed along the anterior-posterior anatomical
> axis.

The workflow description adds that the reference implementationline correction successfully isolated calcium transients from slow
photobleaching drift, and that the 0.5 offset gave enough separation to assess synchrony and
amplitude simultaneously across the anterior–posterior axis.

## Figure specification

Single-panel figure, 5 × 6 in, `ax.axis('off')` — no frame, no ticks, no standard axes.

**Traces.** 65 regions after exclusion, each smoothed with `gaussian_filter1d(sigma=1)`,
min-max scaled to `[0, 1]`, and offset by `(n − 1 − i) × 0.5` so region index 0 (`OE`) is at
the top and index 64 (`VSL`) at the bottom. Plotted against `timesteps` in seconds, colour
`black`, `linewidth=0.5`.

**Acronyms.** One per trace at `x = timesteps[-1] + 20`, `y = y_offset + 0.25`,
`va='center'`, `ha='left'`, fontsize 6, taken from `acronyms.txt` filtered by the same mask.

**Orientation label.** `"Anterior <–––> Posterior"` at `x = text_x + 250`, `y = mid_y`,
`rotation=270`, `va='center'`, `ha='center'`, fontsize 7 (refine values).

**Y caption.** `"Regional fluorescence (normalized)"` at `x = −80`, `rotation=90`,
`ha='right'`, fontsize 8.

**Scale bar.** A black `linewidth=2` segment from `x = 50` to `x = 170` (120 s) at
`y = −0.75`, labelled `"2 min"` beneath it, fontsize 7.

**Stimulus.** `axvspan(660, 840, color='orange', alpha=0.3, zorder=0)` spanning the full
vertical extent, labelled `"stimuli"` above the top trace in bold `darkorange`, fontsize 7.

**Limits.** `xlim = (−100, far_right_x + 100)`, `ylim = (−1.75, n × 0.5 + 1.5)`.
`plt.tight_layout()`, saved at 300 dpi with `bbox_inches='tight'`.
