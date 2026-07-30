---
name: ns_multi-macaque-spike_behavior-classified_firing_rate-raster_psth
description: Analyzes and visualizes single-neuron spiking activity in the macaque dorsal premotor cortex by decomposing trial-binned firing rate tensors across task-specific variables.
triggers:
  - How does PMd neural activity change with stimulus difficulty?
  - Visualize trial-averaged firing rates for macaque premotor neurons
  - Perform tensor decomposition on single-neuron spike trains
  - Analyze PMd spiking activity sorted by choice and coherence
  - Generate PSTHs for perceptual decision-making neurons
tags:
  - neuroscience
  - dorsal-premotor-cortex
  - tensor-decomposition
  - electrophysiology
  - spike-train-analysis
version: '1.0'
---

# Analysis of PMd Single-Neuron Spiking Dynamics via CP Tensor Decomposition

This recipe focuses on characterizing the firing rate dynamics of individual neurons in the macaque dorsal premotor cortex (PMd) during perceptual decision-making tasks, such as Random Dot Motion (RDM). By bridging the gap between single-neuron electrophysiology and population-level dimensionality reduction, this approach allows researchers to evaluate how spiking activity reflects decision variables like stimulus difficulty (coherence) and target choice.

The methodology utilizes Canonical Polyadic (CP) tensor decomposition to summarize high-dimensional neural activity. While individual neurons show stochastic spiking, decomposing the `[Neurons x Time x Trials]` tensor enables the extraction of latent factors that represent the underlying neural population dynamics, which can then be validated against trial-averaged firing rates (PSTHs) and behavioral metadata.

## When to use this

- Visualize single-neuron rasters and PSTHs across macaque decision conditions.
- Organize trial-binned firing rates by choice and difficulty before tensor-based analysis.
- Do not use this workflow when the goal is only a population latent trajectory without unit-level plots.

## Scientific context

PMd neurons are known to integrate sensory evidence in tasks where macaques must choose a side based on noisy stimuli. During such tasks, individual neurons often exhibit "ramping" activity, where the slope of the firing rate rise is proportional to evidence strength (coherence) and the ultimate choice is represented by a divergence in activity traces prior to movement.

## Preconditions

*   MATLAB
*   Sandia `Tensor Toolbox for MATLAB`

## Inputs and outputs

1. Binned spike counts in an $N \times T \times K$ matrix.
2. Behavioral metadata vector (size $K$) containing Choice (1=Left, 2=Right) and Coherence (float).
3. Alignment time (e.g., `t=0` at stimulus onset).

*   **Latent PSTH Plot**: A visualization of the temporal factors over the duration of the trial.
*   **Trial Loadings**: A scatter or bar plot of the trial-weights ($K$ factors) showing whether the decomposition successfully separated trials by difficulty or choice.

## Procedure

1. **Spike Sorting**: Isolate single units based on waveform stability and inter-spike interval (refractory period) violations.
2. **Preprocessing**: Align spike trains to stimulus onset or decision time (go signal) and convolve with a causal Gaussian kernel (e.g., 20–50ms width) to obtain continuous firing rate traces.
3. **Condition Sorting**: Organize trials by behavioral parameters, specifically side chosen (Left vs. Right) and coherence level (0%–51.2%).
4. **Normalization**: Z-score the firing rates across the time dimension to ensure individual neurons with high baseline firing do not disproportionately bias the population analysis.

1. **Data Formatting**: Create a 3D matrix (Tensor) where $N$ = units, $T$ = time bins relative to stimulus onset, and $K$ = trials sorted by coherence and choice.
2. **Decomposition**: Apply `cp_als` from the Tensor Toolbox to extract 3–5 latent factors.
3. **Factor Validation**: Plot the temporal factor against the trial-averaged firing rate of the original PMd neurons. If the factors match the PSTHs, the model has successfully captured the difficulty-dependent dynamics.

1. **Prepare Tensor**: Load binned spike data and rearrange into a 3rd-order tensor format.
2. **Order Trials**: Sort the index $K$ such that trials are grouped by difficulty condition to facilitate viewing latent factor separation.
3. **Decompose**: Run `cp_als(tensor, rank)` where `rank` represents the latent decision signals.
4. **Visualize**: Use `visualize_neuron_ktensor.m` to plot temporal factors against time and evaluate their separation by experimental condition.

## Expected results

*   **Trial-Averaged PSTHs**: Line plots should show distinct trajectories for different stimulus difficulties, with high-coherence trials reaching threshold faster than low-coherence trials.
*   **Latent Factors**: Decomposition results should reveal temporal components that mirror the ramping behavior of observed neurons.

*   Convergence of `cp_als` (resid should plateau).
*   Visual correspondence between the temporal latent factor and the calculated trial-averaged PSTH of a representative PMd neuron.

## Pitfalls

*   **Data Domain Mismatch**: the available implementation is designed for generic dimensionality reduction; it lacks specific PMd behavioral sorting logic. You must manually map metadata to the $K$ dimension.
*   **Single-Neuron Resolution**: This code focuses on population trends. Individual neuron raster plots must be generated separately using standard `imagesc` or `plot` commands on the original spike matrix.
*   **Normalization**: Always Z-score your data across neurons before decomposition to prevent high-firing units from dominating the latent factors.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Within MATLAB
% Ensure Tensor Toolbox is added to path
addpath('/path/to/tensor_toolbox');
% Run the decomposition demo with PMd data structure
[factors] = cp_als(my_pmd_tensor, 3);
% Visualize the resulting temporal and trial factors
visualize_neuron_ktensor(factors);
```
