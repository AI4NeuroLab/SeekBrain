---
name: ns_multi-macaque-spike_behavior-classified_firing_rate-psth_distribution
description: Computes and visualizes trial-averaged PSTHs for PMd neurons categorized by decision choice and coherence difficulty during the perceptual decision-formation period.
triggers:
  - How do I analyze heterogeneous PMd neuronal responses during decision making?
  - Compute stimulus-aligned PSTHs for macaque PMd neurons by choice and difficulty
  - Generate sliding window firing rate plots for PMd units from stimulus to RT
  - How to challenge canonical ramping models with single-neuron firing patterns?
  - Analyze trial-averaged firing rates in PMd with 75ms bins and SEM
tags:
  - electrophysiology
  - PMd
  - perceptual decision-making
  - PSTH
  - neuroscience
  - single-unit analysis
version: '1.0'
---

# Characterizing Heterogeneous Single-Neuron PMd Dynamics

This recipe provides a pipeline for analyzing the decision-formation period in macaque premotor cortex (PMd) neurons. By integrating spike-sorted neural data with behavioral trial logs, this workflow characterizes diverse temporal profiles—including ramping, transient, and non-monotonic responses—that challenge classical canonical ramping models.

The analysis centers on constructing condition-averaged Peristimulus Time Histograms (PSTHs) aligned to stimulus onset. It differentiates neuronal selectivity across four conditions: Left-Easy, Left-Hard, Right-Easy, and Right-Hard, using a sliding boxcar filter to resolve the temporal dynamics of the decision process up to the individual reaction time (RT) of each trial.

## When to use this

- Characterize heterogeneous PMd responses across choice and stimulus-difficulty conditions.
- Compute stimulus-aligned PSTHs with 75-ms windows, 10-ms steps, and SEM across trials.
- Do not use this workflow for population averages that discard single-unit response diversity.

## Scientific context

Decision-related PMd neurons are often hypothesized to exhibit canonical ramping activity, reflecting the integration of evidence. However, recent characterizations demonstrate a surprising diversity, where neurons exhibit transient, non-monotonic, or mixed-selectivity profiles that challenge the uniformity of these models.

## Preconditions

* `numpy`: For convolution, binning, and array manipulation.
* `pandas`: For grouping trials by condition.
* `scipy`: For calculating standard error.
* `matplotlib`: For visualization.
* `phy`: For loading the primary spike-sorted data.

## Inputs and outputs

1. `params.py`: Configuration file for the spike-sorted dataset.
2. `spike_times.npy` / `spike_clusters.npy`: Extracted from the `phy` GUI.
3. `behavior.csv`: File containing `trial_id`, `stim_onset_timestamp`, `RT`, `coherence` (binary: easy/hard), and `choice` (binary: left/right).

1. A multi-panel figure (one panel per neuron) displaying 4 lines (color-coded by choice/difficulty) with SEM shading.
2. A table/JSON mapping `cluster_id` to temporal profile classification (Ramping, Transient, Non-monotonic, Mixed).

## Procedure

1. **Trial Selection**: Isolate the decision-formation epoch from 120 ms post-stimulus onset until the trial-specific reaction time (RT).
2. **Binning**: Apply a 75-ms sliding boxcar window, advanced in 10-ms increments, to convert discrete spike trains into firing rates.
3. **Averaging**: Compute the trial-averaged firing rate and Standard Error of the Mean (SEM) for each condition group (Choice $\times$ Difficulty).
4. **Normalization**: Align data to stimulus onset; apply trial-by-trial masking to exclude data points occurring after the Go-cue/RT.

1. **Model Loading**: Initialize the `phy.io.model.load_model('params.py')` interface to gain programmatic access to `spike_times` and `spike_clusters`.
2. **Data Integration**: Load an external behavioral file (CSV/TSV) containing `stim_onset`, `RT`, `coherence`, and `choice` mapped to individual trial indices.
3. **Vectorization**: For each cluster, build a binary spike vector per trial. Mask values at $t > RT$ with `np.nan`.
4. **Convolution**: Perform a 1D convolution of the spike vector with a 75-ms boxcar kernel (normalized by bin width).
5. **Visualization**: Use `matplotlib` to plot mean firing rate lines for the four conditions, with shading for SEM.

1. Load `TemplateModel` using the `phy` API.
2. For every `cluster_id` in `model.spike_clusters`:
    a. Extract all `spike_times` for the cluster.
    b. Segment spikes into trials based on `stim_onset` and `RT` from the behavior log.
    c. Create a 1ms-resolution binary vector for each trial.
    d. Convolve with a 75-ms boxcar window and extract rates at 10-ms steps.
    e. Calculate the mean and SEM for the four defined condition groups.
    f. Store results in a structure indexed by `cluster_id`.

## Expected results

Individual neurons should show distinct temporal signatures. Successful characterization will identify a population that includes not only monotonic ramping (increasing or decreasing) but also transient bursts and non-monotonic responses. Comparing the four conditions should reveal if difficulty-related modulation is choice-dependent.

* Temporal profiles are smooth (due to sliding window).
* SEM is consistent with $1/\sqrt{N_{trials}}$.
* All traces terminate at or before the respective trial RT.

## Pitfalls

* **Trial Masking**: Ensure that the firing rate calculation does not include samples beyond the RT, as the decision period is the primary focus.
* **Low Trial Counts**: If the SEM is excessively high, consider pooling trials across similar coherence levels or verifying the stability of the cluster in the `phy` GUI.
* **Baseline Correction**: Consider Z-scoring the firing rates relative to the pre-stimulus baseline to normalize across heterogeneous baseline firing rates.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
python compute_psth.py --data_dir ./session_01 --behavior_log behavior.csv
python plot_neuronal_diversity.py --input_stats psth_results.npy
```
