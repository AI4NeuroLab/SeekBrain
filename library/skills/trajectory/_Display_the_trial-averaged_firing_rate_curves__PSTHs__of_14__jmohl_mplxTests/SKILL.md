---
name: "PMd Population PSTH Visualization"
description: "Generates trial-averaged firing rate curves for 14 PMd neurons, segmented by choice and difficulty, using a 75ms sliding window with SEM error shading."
triggers:
  - "Plot PSTHs for the first 14 PMd neurons"
  - "Generate firing rate curves for population.pkl"
  - "Compare PMd neuron responses across choice and difficulty"
  - "Calculate and visualize trial-averaged neural dynamics from the population dataset"
  - "Display temporal heterogeneity of PMd unit activity"
tags:
  - "neuroscience"
  - "electrophysiology"
  - "PSTH"
  - "neural dynamics"
  - "data visualization"
version: "1.0"
---

# Skill: Visualization of PMd Population Dynamics via Trial-Averaged PSTHs

## Overview
This skill provides a systematic approach to visualizing trial-averaged firing rate curves (PSTHs) for a specific subset of PMd neurons. By utilizing spike timing data aligned to stimulus onset, the method allows for the characterization of neural response heterogeneity across different cognitive conditions defined by choice (Left/Right) and stimulus difficulty (Easy/Hard).

This implementation leverages the methodology established in the dynamics and geometry research framework to convert sparse spike train data into high-resolution, time-continuous firing rate estimates. It incorporates specific smoothing windows and error estimation to reflect the reliability of the population-level neural response.

## Objective
To generate a 14-panel figure illustrating the trial-averaged firing rates (PSTHs) for neurons 0–13, where each panel displays four conditions (Easy/Hard $\times$ Left/Right) with associated standard error (SEM) shading to quantify trial-to-trial variability.

## Background (from Paper)
### Scientific Context
PMd neurons exhibit significant temporal heterogeneity during decision-making tasks. Visualizing these neurons through PSTHs aligned to stimulus onset reveals distinct functional classes, including stimulus-locked responses and choice-selective ramping activity.

### Methods Description
1. **Temporal Alignment**: All spike times are zeroed to the `stimulus_onset` variable for every trial.
2. **Condition Partitioning**: Trials are grouped into a 2x2 factorial design based on Choice and Difficulty.
3. **Smoothing**: Firing rates are computed using a 75 ms window with a 10 ms step, providing high-resolution dynamics.
4. **Uncertainty Estimation**: The reliability of the mean firing rate is estimated using $SEM = \sigma / \sqrt{N}$ for each time bin per condition.

### Expected Results
The output produces a visualization demonstrating that PMd units do not act as a uniform ensemble; individual units exhibit unique, trial-averaged temporal profiles that vary in latency and amplitude based on the condition.

## Implementation Guidance
### Verified Repository Components
*   `examples/2024_the_dynamics_and_geometry/data/population.pkl`: Data source for spike times and trial metadata.
*   `examples/2024_the_dynamics_and_geometry/scripts/plot_psth_population.py`: Primary script for visualization.
*   `examples/2024_the_dynamics_and_geometry/src/analysis.py`: Target location for sliding window smoothing and SEM logic.
*   `examples/2024_the_dynamics_and_geometry/src/utils.py`: Contains functions for `population.pkl` ingestion and neuron subsetting.

### Conceptual Implementation Plan
1. **Data Loading**: Parse `population.pkl` to retrieve `spike_times` and `trial_info`.
2. **Filtering**: Select neurons 0–13 from the loaded dataset.
3. **PSTH Computation**: For each condition (4 total) and each selected neuron, apply a sliding boxcar or Gaussian window (75ms/10ms step) to binned spike counts.
4. **Aggregation**: Calculate the mean across trials ($\mu$) and standard error ($SEM$) for every 10ms bin.
5. **Visualization**: Construct a 14-panel `matplotlib` grid, populating each with the 4-condition PSTH traces.

### Dependencies
*   `numpy` (array operations)
*   `matplotlib` (visualization)
*   `scipy` (signal processing/convolution)
*   `pickle` (data loading)

## Structured Prompt
### Input Specification
1. `spike_times`: List/array of timestamps per neuron.
2. `trial_info`: DataFrame/Dict containing `stimulus_onset`, `choice`, and `difficulty` labels.
3. `neuron_indices`: Range `0` to `13`.

### Processing Steps
1. **Load Data**: Open `population.pkl` using standard pickle/load methods.
2. **Align Spikes**: Map spikes to the interval relative to `stimulus_onset` (e.g., -0.5s to 1.5s).
3. **Partition Trials**: Use Boolean masks to identify the four condition subsets: (Easy-Left, Easy-Right, Hard-Left, Hard-Right).
4. **Compute PSTH**: Convolve the binned spike counts with a 75ms boxcar window and downsample to a 10ms step.
5. **Calculate Error**: Calculate standard deviation across trials for each condition bin and divide by $\sqrt{N_{trials}}$.
6. **Plot**: Use `matplotlib.pyplot.subplots(2, 7)` to render the 14 neurons.

### Output Specification
*   **Format**: A multi-panel figure (PNG/PDF).
*   **Content**: 14 plots, each containing 4 colored traces (lines) with corresponding `fill_between` shading (SEM).

### Validation Criteria
*   Check that the number of traces per panel equals 4.
*   Verify the x-axis starts at stimulus onset and ends at a standard task duration (e.g., 1.5s).
*   Ensure shaded SEM regions disappear/shrink as trial counts for a condition increase.

## File Structure

```
_Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14__jmohl_mplxTests/
    references/
        matched_files/
        connection_analysis.md
        paper_context.md
        paper_figure_methods.md
        paper_structured_summary.md
        question.md
        repo_context.md
        repo_file_summaries.md
        repo_overview.md
        reproduction_plan.md
    scripts/
        run_analysis.py
        utils.py
```

## Scripts Documentation
*   `plot_psth_population.py`: Orchestrates the neuron iteration, calls the smoothing utility, and handles the `matplotlib` figure layout.

## References Documentation
*   `population.pkl`: Contains the neural recording metadata and spike event history.

## Usage Example
```bash
python examples/2024_the_dynamics_and_geometry/scripts/plot_psth_population.py \
    --data_path examples/2024_the_dynamics_and_geometry/data/population.pkl \
    --neurons 0 13 \
    --window 75 --step 10
```

## Notes & Caveats
*   **Boundary Conditions**: Ensure the spike train padding handles the pre-stimulus period to avoid artifacts at $t=0$.
*   **Low Trial Count**: Some conditions may be sparsely represented; verify that the logic handles empty trial sets to prevent division-by-zero errors in SEM calculation.
*   **Smoothing Method**: If the result appears noisier than the published figures, ensure the sliding window is implemented as a normalized convolution kernel.