---
name: "Plot Trial-Averaged PMd Population PSTHs"
description: "Generates a 14-panel figure showing trial-averaged firing-rate curves for PMd neurons, split by choice direction and stimulus difficulty with SEM visualization."
triggers:
  - "Plot the trial-averaged firing-rate curves for the PMd neurons"
  - "Visualize PSTHs for the example population dataset"
  - "How do I generate a multi-panel PSTH plot for PMd neurons split by condition?"
  - "Create a heterogeneity visualization for neuron_0 through neuron_13"
  - "Show population PSTHs with SEM for different choice and difficulty levels"
tags:
  - "electrophysiology"
  - "PSTH"
  - "neural-dynamics"
  - "data-visualization"
  - "PMd-neurons"
version: "1.0"
---

# Skill: Plotting Trial-Averaged Firing-Rate Curves (PSTHs) for Neural Populations

## Overview
This skill describes the methodology for visualizing temporal response heterogeneity in PMd neurons. It involves constructing Peristimulus Time Histograms (PSTHs) from trial-aligned spike data, partitioned by experimental conditions (choice direction and stimulus difficulty). By calculating the firing rate across a sliding window and computing the standard error of the mean (SEM), researchers can observe how individual neurons in a population demonstrate distinct tuning profiles and time-locking to decision-making events.

The implementation relies on processing raw spike timestamps from a population dataset, applying a boxcar smoothing filter, and visualizing the results through a grid-based subplot layout. This approach directly translates the computational pipeline used to demonstrate neural dynamics in the PMd into a reproducible visualization script.

## Objective
To generate a 14-panel figure, where each panel represents an individual neuron from the `population.pkl` dataset, displaying trial-averaged firing rate curves for four unique experimental conditions (Left-Easy, Left-Hard, Right-Easy, Right-Hard) with associated SEM shading.

## Background (from Paper)
### Scientific Context
The Premotor Cortex (PMd) is known to represent decision-related information during stimulus-response tasks. Visualizing the heterogeneity of these responses—where different neurons may exhibit early stimulus-locked activity or later, choice-dependent ramping—is essential for understanding the population's geometric structure and dynamics.

### Methods Description
1. **Alignment:** Trigger all spike timestamps to the stimulus onset time ($t=0$).
2. **Smoothing:** Apply a sliding boxcar window of $W = 75$ ms with a step size $\Delta t = 10$ ms.
3. **Rate Estimation:** Calculate the firing rate $\lambda(t)$ as the mean number of spikes per trial within the sliding window, normalized by the window width.
4. **Uncertainty:** Compute the SEM for each time bin across trials to quantify the precision of the rate estimate.

### Expected Results
The paper reports that PMd neurons show diverse temporal profiles. The resulting plots should exhibit distinct, non-overlapping curves for different choice directions, with easy/hard conditions showing varied convergence rates, illustrating the population's varied temporal response properties.

## Implementation Guidance
### Verified Repository Components
- `examples/2024_the_dynamics_and_geometry/data/population.pkl`: Source dataset containing spike times and trial metadata.
- `examples/2024_the_dynamics_and_geometry/scripts/plot_population_psths.py`: Primary script for data loading and plotting.
- `examples/2024_the_dynamics_and_geometry/src/utils.py`: Helper module for spike-train processing (windowing and SEM calculations).

### Conceptual Implementation Plan
1. **Load Data:** Extract spike arrays and metadata from `population.pkl`.
2. **Condition Partitioning:** Utilize boolean indexing to categorize trials based on `choice` and `difficulty`.
3. **PSTH Generation:** Iterate through `neuron_0` to `neuron_13`. For each, calculate the smoothed firing rate for the four conditions. (Assumption: The script assumes a consistent time vector is generated relative to the stimulus onset.)
4. **Visualization:** Plot each neuron’s activity on a 2x7 grid, using `plt.fill_between` to depict SEM.

### Dependencies
- Python 3.8+
- `numpy`
- `matplotlib`
- `pickle`
- `scipy`

## Structured Prompt
### Input Specification
1. `population.pkl`: Dictionary containing keys `spikes` (a list of 14 arrays) and `metadata` (a structured array/list of dicts containing `stimulus_onset`, `choice_direction`, and `difficulty_level`).

### Processing Steps
1. **Data Loading:** Load the `.pkl` file into a dictionary object using `pickle.load()`.
2. **Alignment:** Create a function to subtract `stimulus_onset` from each spike timestamp to align trials.
3. **Binning:** Apply a 75ms boxcar window using a convolution or sliding loop at 10ms increments.
4. **Filtering:** Implement a mask: `mask = (choice == C) & (difficulty == D)` to isolate trial subsets.
5. **Statistics:** Compute the average across trials and the SEM ($\sigma / \sqrt{N}$) for each neuron/condition.
6. **Layout:** Generate a `plt.subplots(2, 7)` grid to house the 14 neurons.

### Output Specification
- **Format:** A single publication-quality figure (e.g., PNG/PDF).
- **Layout:** 14 panels arranged in a 2x7 grid.
- **Components:** Four lines per panel (Condition specific), with shaded bands representing SEM.

### Validation Criteria
- Grid must contain exactly 14 panels.
- X-axis must be centered at 0 (stimulus onset).
- Curves for at least one neuron should show discernible separation between 'Left' and 'Right' conditions.

## File Structure

```
_Plot_the_trial-averaged_firing-rate_curves__PSTHs__for_the___jmohl_mplxTests/
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
- `plot_population_psths.py`: Main executable. Loads data, iterates through the 14 neurons, and invokes the plotting functions. Run via `python scripts/plot_population_psths.py`.

## References Documentation
- `population.pkl`: Contains the raw neural and metadata objects required for all statistical calculations.

## Usage Example
```bash
python examples/2024_the_dynamics_and_geometry/scripts/plot_population_psths.py --input data/population.pkl --output output/psth_figure.pdf
```

## Notes & Caveats
- Ensure trial-alignment is accurate; misaligned data will lead to blurred PSTHs and artificially inflated SEMs.
- Handle edge effects: If the sliding window falls outside the trial duration, use zero-padding or `np.nan` values to avoid biased firing rates at the beginning/end of the trial.
- When working with small trial counts per condition, note that the SEM may be highly sensitive to single-trial outliers.