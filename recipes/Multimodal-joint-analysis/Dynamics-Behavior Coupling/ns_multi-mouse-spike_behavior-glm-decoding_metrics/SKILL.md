---
name: ns_multi-mouse-spike_behavior-glm-decoding_metrics
description: Analyzes orbitofrontal cortex (ORBvl) neural activity during the inter-trial interval to decode the subject's internal prior probability of stimulus presentation, benchmarking against a Bayes-optimal observer model.
triggers:
  - decode task prior from ORBvl population activity
  - calculate correlation between decoded prior and Bayes-optimal prior
  - estimate trial-by-trial prior probability from ORBvl spiking data
  - quantify ORBvl representation of task statistics using corrected R-squared
  - generate plot of decoded versus Bayes-optimal prior in ORBvl
tags:
  - neuroscience
  - orbitofrontal-cortex
  - bayesian-inference
  - population-decoding
  - neural-coding
version: '1.0'
---

# Decoding Prior Probability from ORBvl Neural Activity

This recipe implements the decoding of task priors from population neural activity in the ventrolateral orbitofrontal cortex (ORBvl) during the inter-trial interval (ITI). The process involves mapping trial-history-dependent beliefs, modeled as a Bayesian observer, to neural representations in the ORBvl.

By utilizing cross-validated regression or classification on binned firing rates, researchers can quantify how effectively the ORBvl tracks the "Bayes-optimal" prior relative to the ground-truth experimental block structure. This analysis is critical for validating the hypothesis that the ORBvl maintains a persistent representation of environmental statistics to guide future decisions.

## When to use this

- Decode a trial-by-trial prior from ORBvl population activity during the inter-trial interval.
- Compare the decoded prior with a Bayes-optimal observer using cross-validated metrics.
- Do not use this workflow when block history or ITI-aligned spike counts are unavailable.

## Scientific context

The ORBvl is hypothesized to encode trial-by-trial priors, allowing animals to perform Bayesian inference. By analyzing activity during the ITI—when no sensory stimulus is present—the experiment isolates the internal belief state from stimulus-evoked activity or motor responses.

## Preconditions

- `numpy`, `scipy` (Statistics and matrix operations)
- `scikit-learn` (SVM, regression, and cross-validation utilities)
- `matplotlib` (Visualization of time-series)

## Inputs and outputs

1.  `raw_spiking_data.h5`: Spike timestamps and unit IDs for ORBvl population.
2.  `behavioral_logs.csv`: Trial history including stimulus, choice, and reward.
3.  `session_metadata`: List of valid sessions meeting minimum unit-count criteria.

- A figure showing three traces: True Block Prior, Bayes-Optimal Prior, and Decoded Prior.
- Statistical report: $r$ value and corrected $R^2$ value for each session.

## Procedure

1.  **Bayesian Observer Modeling:** Estimate the trial-by-trial posterior probability using behavioral history (previous stimulus/reward outcomes).
2.  **Neural Population Binning:** Extract spike counts from ORBvl neurons in a predefined ITI window (e.g., 500ms–1000ms prior to stimulus).
3.  **Cross-validated Decoding:** Train a linear decoder (e.g., SVM or Poisson-GLM) on the population activity to predict the model-derived prior.
4.  **Statistical Quantification:** Evaluate the decoder output against the Bayes-optimal prior using Pearson correlation and noise-ceiling-corrected $R^2$.

1.  **Generate Ground Truth:** Run the Bayesian model on behavioral log files to generate a continuous vector of the optimal prior per trial.
2.  **Feature Preparation:** Load spiking data, align to trial start times, and sum spike counts within the established ITI window.
3.  **Decoding:** Use `decode_iti_prior.py` to train the decoder. Ensure the use of leave-one-trial-out cross-validation to prevent leakage of individual trial noise into the prediction.
4.  **Metric Calculation:** Compute the correlation between decoder predictions and the ground truth. Adjust $R^2$ by the noise ceiling (performance of the decoder on its own training set) to account for inherent signal limitations.

1.  **Compute Bayes-Optimal Prior:** Execute `bayesian_observer_model.py` with the trial history to get $P_{opt}$.
2.  **ITI Binning:** Slice `raw_spiking_data.h5` into ITI windows using event-triggered timestamps.
3.  **Train Decoder:** Pass ITI binned spikes and $P_{opt}$ to `decode_iti_prior.py`. Use a 10-fold cross-validation scheme.
4.  **Quantify:** Compute Pearson’s $r$ and corrected $R^2$ using `utils/stats_metrics.py`.
5.  **Visualize:** Run `plot_decoding_results.py` to generate the overlay of the three traces.

## Expected results

The decoded prior should show a significant positive correlation ($p < 0.001$) with the Bayes-optimal prior. Representative sessions typically show the decoded trace tracking the "steps" of the block prior, adjusted by the Bayesian observer's temporal weighting.

- The decoded trace must exhibit tracking behavior across block transitions.
- The $R^2$ value must be greater than the chance-level $R^2$ calculated via label-shuffling (permutation test).

## Pitfalls

- **Temporal Contamination:** Ensure the ITI window ends at least 100ms before stimulus onset to prevent stimulus-evoked spiking from contaminating the prior estimate.
- **Noise Ceiling:** Raw $R^2$ is often misleadingly low in neural data; always use the noise-ceiling-corrected version as described in the method's’s methods.
- **Stationarity:** The Bayes-optimal model assumes stationary learning parameters; ensure session-specific model fitting is performed if the animal's behavior shifts mid-session.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
python bayesian_observer_model.py --input sessions/behavioral_logs.csv --output processed/prior_ground_truth.npy
python decode_iti_prior.py --spikes sessions/raw_spiking_data.h5 --prior processed/prior_ground_truth.npy --output processed/decoded_prior_results.npy
python plot_decoding_results.py --decoded processed/decoded_prior_results.npy --ground_truth processed/prior_ground_truth.npy
```
