---
name: ns_multi-macaque-spike_behavior-tensor_decomposition-temporal_motif
description: Analyzes heterogeneous firing rate profiles in macaque PMd neurons by applying CP tensor decomposition to trial-averaged data sorted by choice and stimulus difficulty.
triggers:
  - How do single neurons in the macaque PMd exhibit diverse firing rate profiles during decision tasks?
  - Perform tensor decomposition on PMd electrophysiological data to extract ramping vs non-monotonic activity.
  - Analyze Cisek and Kalaska PMd neuronal heterogeneity using CP decomposition
  - Identify temporal dynamics of PMd neurons sorted by choice and stimulus coherence
  - How does PMd activity challenge the uniform accumulator model of decision-making?
tags:
  - neuroscience
  - PMd
  - tensor-decomposition
  - electrophysiology
  - perceptual-decision-making
  - neural-dynamics
version: '1.0'
---

# Analyzing Heterogeneous Neuronal Dynamics in PMd via Tensor Decomposition

This recipe provides a computational framework to characterize neuronal firing rate profiles during perceptual decision-making tasks, specifically in the macaque dorsal premotor cortex (PMd). By synthesizing the foundational work of Cisek & Kalaska (2005) with modern tensor decomposition techniques, this recipe enables researchers to move beyond the traditional "accumulator" (ramping) model of decision-making.

The approach treats neural populations as dynamical systems. Instead of classifying individual neurons into rigid functional categories (e.g., "ramping" vs. "non-monotonic"), we use Canonical Polyadic (CP) decomposition to extract latent temporal motifs shared across the population. This allows for a robust, data-driven identification of how firing rate dynamics are modulated by both choice (Left/Right) and task difficulty (stimulus coherence).

## When to use this

- Extract temporal motifs from PMd trial tensors with CP decomposition.
- Compare choice- and difficulty-dependent factor loadings while preserving neuron and time modes.
- Do not use this workflow for isolated single-neuron analyses without a population tensor.

## Scientific context

Cisek & Kalaska (2005) challenged the classic decision-making hypothesis, which posits that neurons act as simple accumulators of sensory evidence. Through electrophysiological recordings in macaque PMd, they observed a diverse population of neurons: some show sustained ramping predictive of reach direction, while others exhibit transient, phasic, or biphasic responses that do not fit a simple integrator model.

## Preconditions

- MATLAB
- `TensorToolbox` (Sandia National Labs)
- Standard statistics package for GLM regression

## Inputs and outputs

1. Spiking data (binned at 20ms) from PMd recordings.
2. Behavioral metadata (Trial IDs, Choice: {L, R}, Difficulty: {Coherence level}).

- A set of $R$ temporal motifs (vectors of size $T$).
- Regression coefficients confirming whether each motif is choice- or difficulty-sensitive.
- A reconstructed population activity map comparing observed vs. latent-predicted firing rates.

## Procedure

1. **Task Structure:** Utilize a two-target reaching task with variable stimulus evidence (coherence) to induce decision-making dynamics.
2. **Preprocessing:** Segment single-unit spike trains into peri-stimulus time histograms (PSTHs) using Gaussian kernel smoothing ($\sigma \approx 20$ ms).
3. **Data Organization:** Align activity to both target onset (decision formation) and movement onset (motor execution).
4. **Classification:** Apply ROC analysis to measure choice-selectivity windows and categorize temporal profiles based on their firing rate slope and latency relative to stimulus onset.

1. **Tensor Construction:** Structure the PMd data into a 3D tensor $Y \in \mathbb{R}^{N \times T \times K}$, where $N$ are neurons, $T$ are time bins, and $K$ are trials (stratified by choice and coherence).
2. **Decomposition:** Execute `cp_als` to decompose the tensor into $R$ latent components.
3. **Correlation Analysis:** Perform a Generalized Linear Model (GLM) analysis to regress the $K$-dimension (trial factor weights) against behavioral labels (Choice, Coherence).
4. **Validation:** (Assumption) Reconstruct the mean PSTH using the latent factors to confirm they capture the original "ramping" vs. "phasic" profiles.

1. **Format:** Organize spike counts into a 3D matrix $[N, T, K]$.
2. **Decompose:** Run `cp_als(tensor(data), R)` with $R=5$ to $10$ to identify latent components.
3. **Analyze Weights:** Extract factor matrix $C$ (trial weights) and perform a regression: `C ~ 1 + Choice + Coherence + Choice*Coherence`.
4. **Characterize Temporal Motifs:** Plot Factor matrix $B$ (temporal factors) to identify ramp-like vs. transient components.

## Expected results

Expected results include heterogeneous PMd dynamics that differ with task requirements. Ramping activity may be task-specific or context-dependent, while non-monotonic factors can capture timing and movement-related signals omitted by simple integrator models.

- Reconstruction error (residual variance) should be minimized ($<10\%$).
- Ramping factors must show high correlation with trial-averaged activity sorted by Choice.

## Pitfalls

- **Binning:** Using a smoothing kernel $>50$ms may artificially "ramp" transient signals. Keep $\sigma \leq 20$ms.
- **Rank Selection:** If $R$ is too low, the model will merge distinct dynamics; if too high, it may model noise. Use the "elbow method" on the reconstruction error.
- **Alignment:** Ensure data is aligned to target onset; movement-aligned data may conflate decision signals with movement-related motor noise.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Set up environment according to README.md
# Prepare PMd data tensor (pmd_data.mat)
# Execute decomposition in MATLAB:
matlab -batch "data = load('pmd_data.mat'); model = cp_als(tensor(data), 5); visualize_neuron_ktensor(model);"
```
