---
name: "PMd Population Trial-Averaged PSTH Analysis"
description: "Computes and visualizes stimulus-aligned, trial-averaged firing rate curves for PMd neurons, split by choice direction and difficulty with SEM uncertainty visualization."
triggers:
  - "Plot the PSTHs for the 14 PMd neurons"
  - "Calculate trial-averaged firing rates for the example population dataset"
  - "Generate a 14-panel plot of firing rates aligned to stimulus onset"
  - "How to visualize temporal response heterogeneity in PMd neurons"
  - "Compute PSTHs split by choice and difficulty from population.pkl"
tags:
  - "electrophysiology"
  - "PSTH"
  - "neuroscience"
  - "firing-rate-analysis"
  - "population-dynamics"
version: "1.0"
---

# Skill: Trial-Averaged Firing-Rate Curve (PSTH) Analysis for Neural Populations

## Overview
This skill outlines the process for computing and visualizing Peri-Stimulus Time Histograms (PSTHs) for a population of simultaneously recorded neurons in the dorsal premotor cortex (PMd). The analysis transforms raw spike times into smoothed firing-rate estimates, segmented by experimental conditions (choice direction and stimulus difficulty) to elucidate the temporal dynamics of choice encoding.

By aligning activity to stimulus onset and applying standardized kernel smoothing, this approach allows for the comparison of trial-locked neural responses across heterogeneous population members. This pipeline is essential for characterizing how neural populations represent task-relevant variables over time.

## Objective
To compute and plot the trial-averaged firing-rate curves (PSTHs) for 14 PMd neurons, split by four experimental conditions (Left/Right choice × Easy/Hard difficulty), using a 75 ms smoothing window and 10 ms step size, with standard error representation.

## Background (from Paper)
### Scientific Context
The dorsal premotor cortex (PMd) is central to motor planning and the integration of sensory evidence into a motor decision. The paper establishes that individual neurons within the PMd exhibit varied response latencies and modulation depths, necessitating population-level visualization to capture the "geometry" of the decision-making process.

### Methods Description
1. **Data Alignment:** Spike times are centered at $t=0$ (stimulus onset).
2. **Binning & Smoothing:** Spike trains are binned and convolved with a 75 ms boxcar/Gaussian kernel to estimate instantaneous firing rate.
3. **Condition Sorting:** Trials are categorized into four groups based on task metadata (Choice: L/R; Difficulty: Easy/Hard).
4. **Statistical Aggregation:** For each condition, the mean firing rate across trials is calculated, with the Standard Error of the Mean (SEM) representing uncertainty.

### Expected Results
The paper shows that the PMd population exhibits heterogeneous temporal dynamics. PSTHs should reveal clear differentiation between choice conditions (Left vs. Right) beginning after stimulus onset, with modulated amplitudes depending on the stimulus difficulty.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context.

### Conceptual Implementation Plan
As the repository is a legacy MATLAB toolbox and does not contain the specific population data or analysis scripts, the implementation should be performed in a Python environment using standard scientific libraries (`numpy`, `pandas`, `scipy`, `matplotlib`).

1. **Load Data:** Use `pickle` to ingest `population.pkl`.
2. **Preprocessing:** Transform spike times into binary spike trains (1 ms resolution).
3. **Kernel Convolution:** Apply a 75 ms boxcar filter to the binned spikes.
4. **Resampling:** Downsample to 10 ms intervals to match the required temporal resolution.
5. **Stats:** Compute the mean and SEM per neuron per condition.
6. **Layout:** Generate a 14-panel grid (`7x2` or similar) to map each neuron to an axis.

### Dependencies
* `numpy` (numerical operations)
* `scipy` (signal convolution)
* `pandas` (metadata indexing)
* `matplotlib` (visualization)
* `pickle` (data loading)

## Structured Prompt
### Input Specification
1. **Source Data:** `examples/2024_the_dynamics_and_geometry/data/population.pkl`.
2. **Variables:** `spike_times` (array of event times), `trial_metadata` (labels for Choice/Difficulty).
3. **Parameters:** Window = 75 ms; Step = 10 ms; Alignment = $t=0$.

### Processing Steps
1. **Group Trials:** Create a mapping of trial indices to the four conditions: `{L_Easy, L_Hard, R_Easy, R_Hard}`.
2. **Compute Rates:** For each neuron, create a 2D matrix (trials × time_bins) of spike counts.
3. **Smooth:** Convolve each trial's spike train with a 75 ms boxcar kernel. 
4. **Downsample:** Select every 10th sample from the convolved trace.
5. **Aggregate:** Calculate the `np.mean()` and `np.std() / sqrt(N_trials)` across trials for each condition-specific subset.
6. **Plot:** For each of the 14 neurons, create a subplot; plot the four mean curves and use `plt.fill_between()` for the SEM.

### Output Specification
* **Figure:** 14-panel plot grid.
* **Format:** Multi-panel graphic saved as PDF/PNG.
* **Content:** Each panel contains 4 curves (mean) with shaded regions (SEM).

### Validation Criteria
1. **Alignment:** Peak firing rate modulation should follow $t=0$.
2. **Uncertainty:** Shaded areas must represent SEM, not Standard Deviation.
3. **Heterogeneity:** Ensure all 14 panels are visually distinct and correctly mapped to `neuron_0` to `neuron_13`.

## File Structure

```
_Plot_the_trial-averaged_firing-rate_curves__PSTHs__for_the___maikstue_mlib-spike-data/
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
* **`compute_psth.py`**: User-defined script to load the `.pkl`, apply the 75ms boxcar kernel, and compute group stats.
* **`visualize_population.py`**: Script to iterate through the 14 neurons and generate the 14-panel grid layout.

## References Documentation
* **`population.pkl`**: The raw data file containing trial-structured spike timestamps and task condition descriptors.

## Usage Example
```bash
python scripts/compute_psth.py --input examples/2024_the_dynamics_and_geometry/data/population.pkl
python scripts/visualize_population.py --output output/psth_population.pdf
```

## Notes & Caveats
* **Kernel Normalization:** Ensure the 75 ms kernel is normalized to 1 (i.e., `kernel / sum(kernel)`) so that units remain in spikes/sec (Hz) rather than total spike counts.
* **Trial Length:** Ensure all trials are truncated to the same duration or padded with NaNs to avoid artifacts in the mean calculation at the end of trials.
* **Data Bridge:** If the `.pkl` file contains complex Python objects, use `pickle` only within a Python environment; do not attempt to access directly via MATLAB unless using a bridge.