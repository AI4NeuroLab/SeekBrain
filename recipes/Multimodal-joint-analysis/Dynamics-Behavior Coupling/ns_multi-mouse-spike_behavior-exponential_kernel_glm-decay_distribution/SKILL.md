---
name: ns_multi-mouse-spike_behavior-exponential_kernel_glm-decay_distribution
description: Calculates session-specific exponential decay constants from neural GLMs and behavioral action kernels, then quantifies their alignment using Pearson correlation.
triggers:
  - calculate neural versus behavioral decay constant correlation
  - estimate tau parameters from neural activity and behavior
  - how does neural history integration compare to behavioral action kernels?
  - compute pearson correlation of inverse decay constants across recording sessions
  - analyze trial-history dependence timescales in neural and behavioral data
tags:
  - Neuroscience
  - GLM-Analysis
  - Trial-History
  - Computational-Modeling
  - IBL-Brain-Wide-Map
version: '1.0'
---

# Estimating Neural and Behavioral Inverse Decay Constants for Trial-History Analysis

This recipe quantifies the integration timescales of past trial information in both neural populations and behavioral strategies. By fitting exponential decay kernels—defined as $f(t) = a \cdot e^{-t/\tau}$—to neural activity and behavioral choice patterns, we can map the "inverse decay constant" ($\tau$), which represents the integration window of past events.

The approach involves fitting a Generalized Linear Model (GLM) to neural data (electrophysiology spikes or widefield fluorescence) using an exponential basis function. By comparing these neural $\tau$ estimates with those derived from the behavioral action-kernel model, we can compute a session-wise Pearson correlation to determine how closely neural dynamics track behavioral history strategies across different recording modalities.

## When to use this

- Fit exponential-history kernels to neural and behavioral data and estimate their decay constants.
- Compare session-level neural and behavioral timescales with a Pearson correlation.
- Do not use this workflow when history kernels cannot be fit reliably or paired by session.

## Scientific context

The trial-history effect refers to the influence of previous choices and outcomes on current behavior and neural responses. The method's establishes that this history dependence is not instantaneous but decays over time, with the timescale of decay ($\tau$) serving as a fundamental metric for understanding neural integration.

## Preconditions

*   `numpy`, `scipy.stats` (for Pearson correlation)
*   `pandas` (for result aggregation)
*   `ibllib` (for IBL `ONE` data loading)
*   `statsmodels` or `scikit-learn` (for GLM fitting)

## Inputs and outputs

1. **`repro_ephys_release.txt`**: List of session IDs (eids) for analysis.
2. **Behavioral Data**: Trial-by-trial choice/reward sequences.
3. **Neural Data**: Binned spike counts (ephys) or fluorescence traces (widefield) aligned to trial onset.

*   **Summary CSV**: A file named `tau_correlation_results.csv` containing session metadata and $\tau$ parameters.
*   **Correlation Metrics**: Console print-out of $r$ and $p$-values for Ephys and Widefield datasets.
*   **Visualization**: Two scatter plots showing the relationship between $\tau_{neural}$ and $\tau_{behav}$ for each modality.

## Procedure

1. **Behavioral Kernel Fitting:** Utilize logistic regression with a trial-history filter, where the weight of past trials $t$ is modeled by $e^{-t/\tau}$.
2. **Neural GLM Fitting:** Apply a Poisson or Ridge-regularized GLM to neural spike counts or widefield fluorescence, incorporating the same exponential basis function for trial history.
3. **Parameter Optimization:** Estimate the optimal $\tau$ per neuron or per pixel-cluster using Maximum Likelihood Estimation (MLE) or cross-validated regression.
4. **Aggregation:** Pair the session-averaged neural $\tau$ with the session-specific behavioral $\tau$.
5. **Statistical Validation:** Compute the Pearson correlation $r$ across sessions for each recording modality, using permutation testing to confirm significance.

*   **Encoding Model:** Develop a new Python module utilizing `scikit-learn` or `statsmodels` to define a design matrix where the trial-history predictor is the interaction of choice/reward history and an exponential kernel with variable $\tau$.
*   **Parameter Search:** Implement a grid search over $\tau \in \{0.5, 1, 2, 5, 10, 20\}$ trials to maximize the log-likelihood of neural activity.
*   **Correlation Engine:** Create a post-processing script that aggregates scalar $\tau$ results from all sessions listed in `data/repro_ephys_release.txt`, separating by modality.

1. **Cache Data**: Execute `scripts/0_data_caching.sh` to ensure neural and behavioral data are synchronized for all sessions.
2. **Estimate $\tau_{behav}$**: Fit a logistic regression model to the behavioral data using an exponential decay kernel; store the resulting $\tau_{behav}$ per session.
3. **Estimate $\tau_{neural}$**: For each session, fit a GLM per neuron/pixel using an exponential decay basis. Identify the best-fit $\tau_{neural}$ by finding the value that maximizes model log-likelihood.
4. **Aggregate**: Create a CSV file containing `[eid, modality, tau_neural, tau_behav]`.
5. **Correlate**: Run `scipy.stats.pearsonr` on the aggregated data, grouping by the modality identifier.

## Expected results

A positive correlation between neural $\tau$ and behavioral $\tau$ in specific brain areas would indicate that neural populations track the integration window associated with the animal’s behavioral strategy.

*   Convergence of the GLM likelihood function.
*   Successful matching of trial counts between neural and behavioral datasets.
*   Pearson $p$-value indicating significance after permutation testing (null distribution creation).

## Pitfalls

*   **Modality Differences**: Widefield signals represent aggregate activity and may require higher regularization in the GLM compared to single-unit ephys spikes.
*   **Parameter Sensitivity**: If the optimizer fails to find a stable $\tau$, check for multicollinearity in the trial-history regressors (e.g., if many past trials are highly correlated).
*   **Alignment**: Ensure that the "trial start" alignment is identical for both behavioral kernel fitting and neural GLM fitting to prevent temporal offsets.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# 1. Prepare data
python src/0_data_caching.py --session_list data/repro_ephys_release.txt

# 2. Fit neural decay constants (custom implementation)
python src/fit_encoding_model.py --input_dir data/cached_sessions/ --output_dir results/tau_fits/

# 3. Compute correlation across sessions
python src/compute_correlations.py --results_dir results/tau_fits/ --output_plot plots/correlation_summary.png
```
