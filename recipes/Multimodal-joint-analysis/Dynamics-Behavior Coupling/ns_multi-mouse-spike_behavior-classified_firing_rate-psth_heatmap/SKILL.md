---
name: ns_multi-mouse-spike_behavior-classified_firing_rate-psth_heatmap
description: Calculates and visualizes trial-averaged firing rate profiles for neuronal populations, segmented by stimulus difficulty and behavioral choice.
triggers:
  - How do I compute trial-averaged firing rates for my neural data?
  - Show me how to plot PSTHs grouped by task condition
  - Generate population firing rate profiles sorted by stimulus difficulty and choice
  - How can I visualize trial-aligned neural activity for decision-making tasks?
  - Help me construct PSTHs for simultaneously recorded neurons
tags:
  - electrophysiology
  - neuroscience
  - PSTH
  - spike-sorting
  - population-dynamics
  - data-analysis
version: '1.0'
---

# Generation of Trial-Averaged PSTHs for Population Neurons

This recipe describes the methodology for constructing Peristimulus Time Histograms (PSTHs) to visualize the firing rate profiles of simultaneously recorded neurons. By aligning spike times to task-relevant events (e.g., stimulus onset) and grouping trials by behavioral variables, this analysis characterizes the neural signatures of decision-making, such as evidence accumulation and choice selectivity.

The process involves transforming raw spike timestamps into continuous firing rate estimates through Gaussian smoothing, followed by normalization to account for the heterogeneous baseline activity of individual neurons across a recorded population.

## When to use this

- Generate a neuron-by-time PSTH heatmap grouped by behavioral choice and stimulus difficulty.
- Compare trial-averaged population response structure using a fixed alignment and color scale.
- Do not use this workflow when trial labels or event-alignment timestamps are incomplete.

## Scientific context

Studies investigating decision-making (e.g., *Churchland et al., 2011*) utilize population-averaged PSTHs to identify neurons that encode sensory evidence magnitude and decision outcome. These plots reveal the temporal evolution of neuronal selectivity throughout a trial.

## Preconditions

*   `numpy`: Array manipulation and numerical operations.
*   `pandas`: Metadata filtering and trial indexing.
*   `scipy`: `scipy.ndimage.gaussian_filter1d` for smoothing.
*   `matplotlib` or `seaborn`: Visualization of temporal profiles.

## Inputs and outputs

1.  **Spike Data:** A matrix or list of spike times per neuron.
2.  **Behavioral Metadata:** A table (CSV/HDF5) with `Trial_ID`, `Difficulty`, `Choice`, and `Alignment_Event_Timestamp`.
3.  **Parameters:** Smoothing kernel width ($\sigma$) and bin size.

1.  **PSTH Array:** A 4D array `(N_neurons, N_timepoints, N_difficulties, N_choices)`.
2.  **Visualization:** A faceted figure plotting firing rate vs. time, with shading for SEM.

## Procedure

1.  **Trial Alignment:** Spike trains are aligned to a fixed event time ($t=0$), typically stimulus onset.
2.  **Discretization:** Spike trains are binned into fixed time windows (e.g., $\Delta t = 1$ ms or 10 ms).
3.  **Kernel Smoothing:** Binned spikes are convolved with a Gaussian kernel ($\sigma = 20-50$ ms) to produce a continuous estimate of the firing rate.
4.  **Condition Grouping:** Trials are partitioned based on behavioral log metadata (Choice: L/R; Difficulty: Coherence levels).
5.  **Averaging:** Mean activity across all trials for a specific condition is calculated for each neuron.

The implementation should rely on `pandas` for metadata filtering and `scipy.ndimage.gaussian_filter1d` for the smoothing operation. We assume the presence of a spike matrix where rows are trials and columns are time bins. We assume metadata is stored in a tabular format (e.g., `pandas.DataFrame`) containing `Trial_ID`, `Stimulus_Difficulty`, and `Choice`.

1.  **Filter Metadata:** Partition the trial indices using `df.groupby(['Difficulty', 'Choice'])`.
2.  **Bin Spikes:** Generate a binary spike matrix (trials x time) using `np.histogram`.
3.  **Apply Smoothing:** Convolve the average of the binary matrix across the time dimension using `gaussian_filter1d`.
4.  **Normalize:** (Optional) Apply Z-scoring using the mean and std of the pre-stimulus baseline period.
5.  **Compute SEM:** Calculate the Standard Error of the Mean for each condition to visualize trial-to-trial variance.

## Expected results

The results typically present a series of heatmaps or line plots showing divergence in firing rate between choice conditions starting shortly after stimulus onset, with the magnitude or speed of this divergence modulated by stimulus difficulty.

1.  **Baseline Stability:** Ensure pre-stimulus rates are consistent across conditions.
2.  **Alignment Check:** Confirm $t=0$ coincides exactly with the chosen behavioral event.
3.  **Kernel Width:** Verify that the $\sigma$ used in code matches the manuscript methods exactly.

## Pitfalls

*   **Edge Effects:** Ensure appropriate padding (e.g., reflecting data points) during convolution to prevent artificial dips in firing rates at the beginning and end of the trial window.
*   **Low Trial Count:** Verify that conditions with "Hard" difficulty have sufficient trial numbers; if $N$ is too low, the PSTH will be dominated by noise rather than neural signal.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
python compute_rates.py --input spikes.npy --metadata behavior.csv --sigma 25
python plot_psth.py --data processed_rates.h5 --group_by difficulty choice
```
