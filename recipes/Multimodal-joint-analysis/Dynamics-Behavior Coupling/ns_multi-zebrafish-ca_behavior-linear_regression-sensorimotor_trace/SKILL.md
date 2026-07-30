---
name: "ns_multi-zebrafish-ca_behavior-linear_regression-sensorimotor_trace"
description: "Build the three-modality sensorimotor raster for a single zebrafish larva — binarized swim behaviour, the light/dark visual stimulus sequence, and single-neuron ΔF/F₀ calcium traces for four functionally defined ensembles (Motor+, Motor−, Dark, Light) selected as the 50 most extreme neurons by precomputed correlation ranking — all drawn on one shared time axis with per-neuron traces at low alpha and the population mean overlaid in black. Reach for this when someone asks to show neural activity aligned to behaviour, plot swim-triggered or stimulus-locked calcium traces, 'which neurons fire when the fish swims', motor-correlated versus visually driven neurons, dark- versus light-responsive cells, a single-fish example trace figure, or any per-neuron time-series panel combining calcium, behaviour, and stimulus. This is a pure figure recipe on one hard-coded larva (fish16) — it writes statistics.json but no .npy artifacts, so nothing downstream consumes it."
triggers:
- "Analyze sensorimotor trace panel for one larva"
- "Generate sensorimotor trace panel for one larva outputs"
- "Apply the ns_multi-zebrafish-ca_behavior-linear_regression-sensorimotor_trace recipe"
tags:
- "zebrafish"
- "ca"
- "behavior"
- "linear"
- "regression"
version: "1.0"
---

# Sensorimotor trace panel for one larva

Calcium, swimming, and visual stimulus on a common time axis, with neurons grouped into four
functional classes by correlation ranking.

## When to use this

Use this recipe to make a single-larva trace panel that aligns swimming, light/dark stimulation, and calcium activity from correlation-ranked Motor+, Motor−, Dark, and Light ensembles. Do not use it for population inference, atlas mapping, or significance testing across animals.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/Subjects/fish16/dff.npy` | (69646 neurons, 892 frames) |
| in | `$ZEBRAFISH_PATH/Subjects/fish16/swim_events.npy` | (360000,) at 399.75 Hz |
| in | `$ZEBRAFISH_PATH/Subjects/fish16/correlations_{motor,dark,light}.npy` | (69646,) each |
| in | `$ZEBRAFISH_PATH/Files/sequence_stimuli.npy` | (n_stim,) shared across larvae |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

**No `.npy` artifacts are written.** There is no `np.save` call anywhere in either script.

Full detail in `references/data_contract.md`.

## Procedure

1. List `$ZEBRAFISH_PATH/Subjects/`, keep directories starting with `fish`, sort with plain
   `sorted()`, and take index **7** — the 8th folder. On this dataset that resolves to
   `fish16`, because the sort is lexicographic, not numeric.
2. Load `dff.npy`, `swim_events.npy`, the three correlation vectors, and
   `Files/sequence_stimuli.npy`.
3. Binarize behaviour: `binary_swim = (swim_events > 0.5).astype(int)`. The swim trace is a
   continuous vigour signal; 0.5 is a fixed absolute threshold, not a percentile or a
   noise-scaled criterion, so it is only meaningful if the signal is already normalised.
4. Shift by 15 samples: drop the first 15 elements and append 15 zeros, keeping the length.
   Then zero-pad (or, in the figure-oriented implementation, truncate) to exactly 360000 samples.
5. Build the behaviour time axis as `np.arange(len(binary_swim)) / 399.75`, giving 900.560 s.
6. Select 50 neurons per class by rank on the precomputed correlations:
   - **Motor+** `argsort(correlations_motor)[-50:]` — most positively motor-correlated
   - **Motor−** `argsort(correlations_motor)[:50]` — most negatively motor-correlated, the
     opposite tail of the *same* vector, not an independent regressor
   - **Dark** `argsort(correlations_dark)[-50:]`
   - **Light** `argsort(correlations_light)[-50:]`
7. Build the calcium time axis with `np.linspace(0, duration, 892)`. Calcium and behaviour are
   sampled ~400× apart (≈0.99 Hz vs 399.75 Hz), so the two modalities are aligned only by
   sharing endpoints — there is no resampling or interpolation onto a common grid.
8. Lay out a `GridSpec`: two thin context rows (Motor, Stim.) over four equal calcium rows,
   `height_ratios=[1, 1, 2, 2, 2, 2]`, `hspace=0`, figsize (12, 5). The 2 : 8 unit split is
   what makes the context band 20% of the height.
9. Context panels: `fill_between` the binary swim trace in black at `alpha=0.7`; line-plot
   `sequence_stimuli` in black at `linewidth=0.5` against its own `linspace(0, duration, len)`.
   Right-hand text labels `Motor` and `Stim.`. Both axes off.
10. Calcium panels, top to bottom Motor+ (green `[0, 0.8, 0.2]`), Motor− (magenta `[1, 0, 1]`),
    Dark (red `[1, 0, 0]`), Light (`'orange'`). For each: plot all 50 traces at `alpha=0.1`,
    `linewidth=0.5`, `rasterized=True`, then overlay the population mean in solid black at
    `alpha=1`, `linewidth=0.5`. `rasterized=True` matters — 200 vector traces of 892 points
    each would make an unopenable PDF.
11. Set every panel's `xlim` to `[0, duration]` and turn all axes off. Save at 300 dpi with
    `bbox_inches='tight'`.
12. Statistics (reference implementation only): per class, the mean/std/median/min/max of the *selected*
    neurons' correlations and the mean/std of their ΔF/F₀; plus the swim active-frame count.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| fish index | `7` (8th sorted folder → `fish16`) | Hard-coded and fragile. The sort is lexicographic, so `fish1, fish10, fish11, …` orders by string; adding or removing any `fish*` folder silently repoints index 7 at a different animal, and every number in `statistics.json` changes with no error. Pin the folder by name if you re-run. |
| swim threshold | `0.5` | Absolute, on the raw `swim_events` values. Raising it drops weak bouts; lowering it admits noise as behaviour. Only 0.74% of frames survive at 0.5, so the binary trace is sparse and this threshold sets how sparse. |
| shift | 15 samples, drop-front + zero-pad-back | 15 / 399.75 Hz = **37.5 ms**. This shift is too small to serve as a general calcium-indicator lag correction. |
| `camera_fps` | `399.75` | Behaviour sampling rate, hard-coded. It sets the total duration and therefore the calcium time axis too, so a wrong value stretches or compresses the whole figure. |
| target length | `360000` | 360000 / 399.75 = 900.563 s of behaviour. Padding shorter records with zeros means missing behaviour reads as quiescence, not as missing. |
| neurons per class | `50` | Fixed count, not a correlation threshold. There is always a top 50, however weak the correlations — selection guarantees an ensemble exists. |
| trace alpha / lw | `0.1` / `0.5` | With 50 overlaid traces, alpha 0.1 makes coincident activity visible as density. |
| mean trace | black, `alpha=1`, `lw=0.5` | Drawn on the same axis with no offset, so it sits inside the cloud. |
| `rasterized` | `True` | Individual traces only; the mean stays vector. |
| `figsize` | `(12, 5)` | Wide, to fit 900 s. |
| `dpi` | `300` | |

## Expected results

From `statistics.json` (written by the reference implementation only):

- `fish_folder` = **fish16**, 69646 neurons, 892 calcium frames, 360000 swim samples,
  recording duration **900.560 s**
- swim: **2671 active frames** of 360000, fraction active **0.00742**
- Motor+ (n=50): mean r **0.6345** (sd 0.0194, range 0.6077–0.6764), mean ΔF/F₀ 1.206
- Motor− (n=50): mean r **−0.3065** (sd 0.0324, range −0.3896 to −0.2658), mean ΔF/F₀ 1.161
- Dark (n=50): mean r **0.7944** (sd 0.0373, range 0.7456–0.8764), mean ΔF/F₀ 0.988
- Light (n=50): mean r **0.3712** (sd 0.0590, range 0.3151–0.6573), mean ΔF/F₀ 0.856

The claims these support: in this larva the top 50 Motor+ neurons are strongly positively
coupled to swim events (r ≈ 0.63) and clearly separated from the Motor− tail (r ≈ −0.31); and
the dark-tuned ensemble is much more strongly correlated with its stimulus (r ≈ 0.79) than the
light-tuned ensemble is with its own (r ≈ 0.37).

Both are single-animal, descriptive observations. There is no test, no across-fish
comparison, and no correction — do not report the dark-versus-light asymmetry as significant.

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
