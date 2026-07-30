---
name: ns_multi-macaque-spike_behavior-classified_firing_rate-psth_trace
description: Generates trial-averaged firing rate curves for 14 PMd neurons, segmented by choice and difficulty, using a 75ms sliding window with SEM error shading.
triggers:
  - Plot PSTHs for the first 14 PMd neurons
  - Generate firing rate curves for population.pkl
  - Compare PMd neuron responses across choice and difficulty
  - Calculate and visualize trial-averaged neural dynamics from the population dataset
  - Display temporal heterogeneity of PMd unit activity
tags:
  - neuroscience
  - electrophysiology
  - PSTH
  - neural dynamics
  - data visualization
version: '1.0'
---

# Visualization of PMd Population Dynamics via Trial-Averaged PSTHs

This recipe provides a systematic approach to visualizing trial-averaged firing rate curves (PSTHs) for a specific subset of PMd neurons. By utilizing spike timing data aligned to stimulus onset, the method allows for the characterization of neural response heterogeneity across different cognitive conditions defined by choice (Left/Right) and stimulus difficulty (Easy/Hard).

Convert sparse spike trains into time-continuous firing-rate estimates with the specified smoothing window, and calculate uncertainty across trials for each condition.

## When to use this

- Plot trial-averaged firing-rate traces for selected PMd neurons by choice and difficulty.
- Compare temporal response profiles from stimulus onset through reaction time with uncertainty shading.
- Do not use this workflow when trial events or reaction times are missing.

## Scientific context

PMd neurons exhibit significant temporal heterogeneity during decision-making tasks. Visualizing these neurons through PSTHs aligned to stimulus onset reveals distinct functional classes, including stimulus-locked responses and choice-selective ramping activity.

## Preconditions

*   `numpy` (array operations)
*   `matplotlib` (visualization)
*   `scipy` (signal processing/convolution)
*   `pickle` (data loading)

## Inputs and outputs

1. `spike_times`: List/array of timestamps per neuron.
2. `trial_info`: DataFrame/Dict containing `stimulus_onset`, `choice`, and `difficulty` labels.
3. `neuron_indices`: Range `0` to `13`.

*   **Format**: A multi-panel figure (PNG/PDF).
*   **Content**: 14 plots, each containing 4 colored traces (lines) with corresponding `fill_between` shading (SEM).

## Procedure

1. **Temporal Alignment**: All spike times are zeroed to the `stimulus_onset` variable for every trial.
2. **Condition Partitioning**: Trials are grouped into a 2x2 factorial design based on Choice and Difficulty.
3. **Smoothing**: Firing rates are computed using a 75 ms window with a 10 ms step, providing high-resolution dynamics.
4. **Uncertainty Estimation**: The reliability of the mean firing rate is estimated using $SEM = \sigma / \sqrt{N}$ for each time bin per condition.

1. **Data Loading**: Parse `population.pkl` to retrieve `spike_times` and `trial_info`.
2. **Filtering**: Select neurons 0–13 from the loaded dataset.
3. **PSTH Computation**: For each condition (4 total) and each selected neuron, apply a sliding boxcar or Gaussian window (75ms/10ms step) to binned spike counts.
4. **Aggregation**: Calculate the mean across trials ($\mu$) and standard error ($SEM$) for every 10ms bin.
5. **Visualization**: Construct a 14-panel `matplotlib` grid, populating each with the 4-condition PSTH traces.

1. **Load Data**: Open `population.pkl` using standard pickle/load methods.
2. **Align Spikes**: Map spikes to the interval relative to `stimulus_onset` (e.g., -0.5s to 1.5s).
3. **Partition Trials**: Use Boolean masks to identify the four condition subsets: (Easy-Left, Easy-Right, Hard-Left, Hard-Right).
4. **Compute PSTH**: Convolve the binned spike counts with a 75ms boxcar window and downsample to a 10ms step.
5. **Calculate Error**: Calculate standard deviation across trials for each condition bin and divide by $\sqrt{N_{trials}}$.
6. **Plot**: Use `matplotlib.pyplot.subplots(2, 7)` to render the 14 neurons.

## Expected results

The output produces a visualization demonstrating that PMd units do not act as a uniform ensemble; individual units exhibit unique, trial-averaged temporal profiles that vary in latency and amplitude based on the condition.

*   Check that the number of traces per panel equals 4.
*   Verify the x-axis starts at stimulus onset and ends at a standard task duration (e.g., 1.5s).
*   Ensure shaded SEM regions disappear/shrink as trial counts for a condition increase.

## Pitfalls

*   **Boundary Conditions**: Ensure the spike train padding handles the pre-stimulus period to avoid artifacts at $t=0$.
*   **Low Trial Count**: Some conditions may be sparsely represented; verify that the logic handles empty trial sets to prevent division-by-zero errors in SEM calculation.
*   **Smoothing Method**: If the result appears noisier than the published figures, ensure the sliding window is implemented as a normalized convolution kernel.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
python examples/2024_the_dynamics_and_geometry/scripts/plot_psth_population.py \
    --data_path examples/2024_the_dynamics_and_geometry/data/population.pkl \
    --neurons 0 13 \
    --window 75 --step 10
```
