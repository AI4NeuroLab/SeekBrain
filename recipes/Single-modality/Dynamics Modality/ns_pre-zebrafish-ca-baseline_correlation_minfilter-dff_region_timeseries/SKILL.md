---
name: "ns_pre-zebrafish-ca-baseline_correlation_minfilter-dff_region_timeseries"
description: "Turn raw motion-corrected zebrafish calcium fluorescence into ΔF/F₀ using a Gaussian-smoothed running-minimum baseline, then average per neuron down to one time series per atlas brain region, and render the stacked anterior-to-posterior ridge plot of regional traces with the visual-stimulus window marked. Use this whenever someone asks to compute ΔF/F₀, dF/F, delta F over F, baseline correction, photobleaching or drift removal, F0 estimation, region-averaged activity, regional calcium traces, or 'the raw fluorescence needs preprocessing before I can correlate anything' — and also for the classic stacked-traces figure showing every brain region's activity over time with the stimulus period shaded. This is the preprocessing step that stands between raw data.hdf5 timeseries and every correlation, connectivity, brain-state, and cofluctuation analysis in this dataset, so run it before ns_ana-zebrafish-ca-pearson-fc_matrix or any brain-state clustering."
triggers:
- "Analyze δf/f₀ extraction and regional averaging from raw calcium traces"
- "Generate δf/f₀ extraction and regional averaging from raw calcium traces outputs"
- "Apply the ns_pre-zebrafish-ca-baseline_correlation_minfilter-dff_region_timeseries recipe"
tags:
- "zebrafish"
- "ca"
- "baseline"
- "correlation"
- "minfilter"
version: "1.0"
---

# ΔF/F₀ extraction and regional averaging from raw calcium traces

Computes per-neuron ΔF/F₀ with a minimum-filter baseline, collapses neurons to 70 atlas
regions, saves both levels per larva, and plots the region-stacked traces for one
representative fish.

## When to use this

Use this recipe to estimate a minimum-filter calcium baseline, calculate neuron-level ΔF/F₀, and aggregate traces by atlas region for each larva. Do not use it on already normalized traces or without verifying the region-label alignment.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/**/fish*/data.hdf5` → `timeseries` | (n_neurons, T) float |
| in | `$ZEBRAFISH_PATH/**/fish*/data.hdf5` → `region_labels` | (n_neurons, 70) bool |
| in | `$ZEBRAFISH_PATH/**/fish2/data.hdf5` → `timesteps` | (T,) seconds |
| in | `$ATLAS_PATH/acronyms.txt` | 70 lines |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int — optional |
| out | `$PROCESS_DATA_DIR/Figure1_dff_fish{N}.npy` | (n_neurons, T) float64 |
| out | `$PROCESS_DATA_DIR/Figure1_region_series_dff_fish{N}.npy` | **(70, T)** float64 |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md` — including the fact that these filenames do
**not** match what `ns_ana-zebrafish-ca-pearson-fc_matrix` actually reads. Read that section
before wiring this into a pipeline.

## Procedure

1. Read `acronyms.txt` into a list, stripping newlines.
2. Discover larva folders with `get_datasets(ZEBRAFISH_PATH, keywords=['fish'])`, then
   `sorted()`. The sort is lexicographic, so the order is `fish1, fish10, fish11, …, fish19,
   fish2, fish20, …` — not numeric. It does not affect the output files, which are named by
   fish, but do not assume position 1 is fish2.
3. For each larva, skip if both output files already exist. This makes the script resumable,
   which matters because the per-neuron loop is slow.
4. Load `timeseries` as float64 and `region_labels` as bool.
5. **Fix the first-frame artefact**: `timeseries[:, 0] = timeseries[:, 1]`. The first
   acquisition frame carries a systematic offset; leaving it in would drag the running minimum
   at the start of the record and distort the reference implementationline for the first ~300 frames.
6. Per neuron, estimate the reference implementationline in three passes:
   - `gaussian_filter1d(signal, sigma=3)` — removes shot noise so the minimum filter latches
     onto the true signal floor rather than an isolated noise dip.
   - `minimum_filter1d(..., size=300, mode='nearest')` — a running minimum over a 300-frame
     window. 300 frames is long relative to a calcium transient and short relative to
     photobleaching drift, so the result tracks slow drift while ignoring events.
   - `gaussian_filter1d(..., sigma=60)` — smooths the staircase that a running minimum
     inevitably produces into a continuous F₀.
7. `dff[i] = (signal - baseline) / max(baseline, 1e-10)`. The clamp guards against division by
   a non-positive baseline. Note the numerator uses the unclamped baseline.
8. Assert the result is free of NaN and Inf. This is a real guard, not decoration — a
   non-positive baseline would otherwise propagate silently into every downstream correlation.
9. Average within regions: for each of the 70 columns of `region_labels`, take
   `dff[mask].mean(axis=0)`. A region with no neurons in this larva gets an all-NaN row rather
   than a zero row, so downstream code can tell "unsampled" from "silent". Everything
   downstream uses `nanmean` or `nan_to_num` because of this choice.
10. Save `Figure1_dff_{fish}.npy` (per neuron) and `Figure1_region_series_dff_{fish}.npy`
    (per region, shape `(70, T)`).
11. For the figure, locate the folder whose basename contains `fish2`, load its saved regional
    array and its `timesteps`, drop the excluded regions from both the traces and the acronym
    list, then per region: `gaussian_filter1d(sigma=1)` and min-max scale to `[0, 1]`.
12. Stack with `y_offset = (n_regions - 1 - i) * 0.5` so region 0 (OE, anterior) sits at the
    top and the last region (VSL, posterior) at the bottom. Draw black, `linewidth=0.5`.
13. Annotate: acronyms just right of the trace end, an "Anterior <–––> Posterior" label further
    right, a rotated y-axis caption on the left, a 120-s scale bar at the bottom, and an orange
    `axvspan` over 660–840 s labelled "stimuli".

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| first-frame fix | `ts[:, 0] = ts[:, 1]` | Removes the acquisition transient before baseline estimation. |
| pre-smoothing σ | 3 frames | Stops the running minimum from locking onto noise dips. |
| minimum-filter `size` | 300 frames | Baseline window. Shorter tracks (and cancels) real activity; longer fails to follow bleaching. |
| `mode` | `'nearest'` | Edge handling for the running minimum — no wraparound or zero-padding. |
| post-smoothing σ | 60 frames | Converts the min-filter staircase into a smooth F₀. |
| baseline clamp | `1e-10` | Denominator floor only; the numerator keeps the raw baseline. |
| plot smoothing σ | 1 frame | Display only. Does not touch the saved arrays. |
| normalisation | per-region min-max to [0, 1] | Display only. Destroys amplitude comparison between regions — never read relative activity magnitude off this figure. |
| vertical offset | 0.5 | Stacking spacing. |
| stimulus window | 660–840 s | Hard-coded, not derived from the data. |
| scale bar | 120 s | Drawn in data coordinates starting at x = 50. |
| `MAX_FISH_TO_PROCESS` | 5 (reference implementation) / absent in the full-dataset implementation | The reference implementation caps processing at 5 larvae. See Pitfalls. |
| `figsize` | (5, 6) | |
| `dpi` | 300 | |

## Expected results

From `statistics.json`:

- **22 larvae processed**, 70 atlas regions, 5 excluded, **65 regions plotted**
- Fish 2 regional array shape **(70, 892)** — 70 regions × 892 frames
- Fish 2 time range **0.0 to 903.06 s** (≈ 15 min)
- Stimulus window **[660, 840] s**
- Baseline window 300 frames, σ₁ = 3, σ₂ = 60, plot σ = 1, offset 0.5, scale bar 120 s
- The 65 plotted acronyms in order, starting `OE, OB, VT, DT, DH, Epi, VH, VEN, ETR, POR` and
  ending `… PLLG, InfDMOS2-3, InfDMOS1, VMN, IO, VSL`

The claim these support: the normalised regional ΔF/F₀ traces show distinct spontaneous
transients across 65 regions, heterogeneous along the anterior–posterior axis.

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
