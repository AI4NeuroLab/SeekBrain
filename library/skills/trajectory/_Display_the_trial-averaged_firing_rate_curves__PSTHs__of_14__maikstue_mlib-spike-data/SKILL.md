---
name: "PMd Population PSTH Visualization and Analysis"
description: "Generates trial-averaged firing rate curves for 14 PMd neurons, segmented by choice direction and stimulus difficulty, including SEM shading and multi-panel visualization."
triggers:
  - "Plot PSTHs for the 14 neurons in the PMd dataset"
  - "Generate trial-averaged firing rates for population.pkl"
  - "Show stimulus-aligned neural dynamics for different task conditions"
  - "Display firing rate curves categorized by choice and difficulty"
  - "Visualize heterogeneous temporal responses for PMd example neurons"
tags:
  - "electrophysiology"
  - "PSTH"
  - "PMd"
  - "neural dynamics"
  - "trial-averaging"
version: "1.0"
---

# Skill: Trial-Averaged PSTH Visualization for Heterogeneous PMd Populations

## Overview
This skill provides a systematic approach to visualizing neural activity in the dorsal premotor cortex (PMd), specifically focusing on temporal response heterogeneity across a sample population of 14 neurons. By aligning electrophysiological data to stimulus onset and partitioning trials by task-relevant variables (choice direction and stimulus difficulty), we can characterize the distinct firing dynamics—such as ramping, onset bursts, or inhibitory modulation—that underlie decision-making in the PMd.

The procedure requires transforming raw spike timestamps into smoothed firing rate estimates using a sliding window approach, then aggregating these rates across trial conditions. The resulting visualizations are essential for observing population-level coding, where different neurons within the same circuit exhibit specialized temporal profiles.

## Objective
To generate a $2 \times 7$ grid of subplots visualizing the trial-averaged firing rate curves (PSTHs) for 14 PMd neurons (indexed 0-13), aligned to stimulus onset, across four task conditions (Left-Easy, Left-Hard, Right-Easy, Right-Hard), with standard error shading.

## Background (from Paper)
### Scientific Context
The PMd is critical for sensorimotor integration and movement preparation. The "dynamics and geometry" approach posits that individual PMd neurons exhibit heterogeneous temporal responses that, when viewed as a population, form specific geometric structures in state space.

### Methods Description
1. **Trial Segmentation:** Identify trial intervals using `stim_onset` as the reference point ($t=0$).
2. **Spike Binning:** Generate binned spike counts with a 10 ms step size.
3. **Smoothing:** Apply a 75 ms sliding window (boxcar or Gaussian kernel) to derive continuous firing rate estimates.
4. **Conditioning:** Filter trial data based on `Choice` (Left/Right) and `Difficulty` (Easy/Hard).
5. **Statistical Aggregation:** Calculate the Mean PSTH and Standard Error of the Mean (SEM) for each neuron-condition pair.

### Expected Results
The output will display 14 unique neural signatures. Users should expect to see diverse dynamic patterns, such as neurons that reach peak firing rates at different times relative to stimulus onset or neurons that discriminate stimulus difficulty through varying slopes of activity.

## Implementation Guidance
### Verified Repository Components
*   `src/analysis/compute_psth.m`: Core function for calculating firing density.
*   `src/viz/plot_population_dynamics.m`: Visualization framework for tiled subplots.
*   `src/utils/load_population_data.m`: Utility for ingesting `population.pkl`.
*   `examples/2024_the_dynamics_and_geometry/data/population.pkl`: Source dataset.

### Conceptual Implementation Plan
The plan relies on importing the Python pickle data into the analysis environment. Since the repo is MATLAB-oriented, `pyrun` or `py.pickle` will be necessary to load the `.pkl` file. We will loop through neurons 0-13, apply a 10ms binning grid, and convolve with a 75ms boxcar window before aggregating. The visualization will utilize a `tiledlayout` to map the 14 neurons into the specified grid.

### Dependencies
*   Python/MATLAB Interoperability interface.
*   `numpy`/`pandas` (for data manipulation).
*   `matplotlib` or `MATLAB Graphics` (for visualization).

## Structured Prompt
### Input Specification
1. `population.pkl`: Contains `spike_times` (array of arrays) and `trial_info` (Table/DataFrame).
2. Metadata columns: `trial_id`, `stim_onset`, `choice`, `difficulty`.

### Processing Steps
1. **Load Data:** Use `load_population_data.m` to parse `population.pkl` into the workspace.
2. **Filter Conditions:** Iterate through `Choice` (L/R) and `Difficulty` (E/H) to create a logic mask for trial selection.
3. **Bin Spikes:** For each neuron (0-13), generate a matrix of spike counts (trials x time bins) aligned at `stim_onset`.
4. **Smooth:** Compute PSTHs using a 75ms boxcar window with a 10ms step. 
5. **Compute Statistics:** For each neuron-condition, compute `mean(rate)` and `std(rate)/sqrt(N)`.
6. **Visualize:** Initialize a $2 \times 7$ grid; for each neuron, plot 4 lines (one per condition) with `fill_between` or shaded regions for the SEM.

### Output Specification
*   **Format:** Multi-panel figure (PNG or PDF).
*   **Content:** 14 subplots; color-coded lines by choice, linestyle-coded by difficulty.
*   **Location:** `examples/2024_the_dynamics_and_geometry/results/`.

### Validation Criteria
*   Check if 14 subplots are present.
*   Confirm time range encompasses the stimulus window.
*   Verify that SEM shading is present for each line.

## File Structure

```
_Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14__maikstue_mlib-spike-data/
    references/
        matched_files/
            README.md
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
*   `load_population_data.m`: Primary loader for the PMd population data.
*   `compute_psth.m`: Implements the 75ms sliding window smoothing.
*   `run_analysis.m`: Orchestrates the neuron selection (0-13) and plotting loops.

## References Documentation
*   `population.pkl`: Dataset containing trial-aligned spike timestamps for the 14 PMd neurons.

## Usage Example
```bash
# Run the primary analysis script to generate the population figure
matlab -batch "run('examples/2024_the_dynamics_and_geometry/scripts/run_analysis.m')"
```

## Notes & Caveats
*   **Normalization:** The current PSTHs represent raw firing rates (Hz). If neurons differ significantly in absolute baseline firing, visual interpretation may require individual y-axis scaling per subplot.
*   **Data Format:** Ensure the `load_population_data.m` handles the Python-specific `.pkl` file type; if errors occur, use `python` to export the data to `.mat` first.
*   **Edge Effects:** Using `mode='same'` in `np.convolve` may introduce artifacts at the trial boundaries. Truncate plot axes to the time range where the window is fully contained within the trial duration.