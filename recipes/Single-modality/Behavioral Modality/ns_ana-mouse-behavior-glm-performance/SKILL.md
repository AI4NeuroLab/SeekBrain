---
name: ns_ana-mouse-behavior-glm-performance
description: Fits Bayes-optimal, stimulus, and action kernel models to behavioral choice data and performs group-level Bayesian model selection to calculate model frequencies and exceedance probabilities.
triggers:
- how to perform bayesian model comparison on behavioral data
- fit stimulus and action kernels to choice data
- calculate exceedance probability for competing cognitive models
- implement rfx-bms for behavioral modeling sessions
- compare bayes-optimal model against heuristic kernels
tags:
- computational-neuroscience
- behavioral-modeling
- bayesian-model-selection
- rfx-bms
- parameter-estimation
version: '1.0'
---

# Bayesian Model Comparison of Behavioral Prior Strategies

This recipe implements a hierarchical Bayesian model comparison framework to evaluate cognitive strategies—specifically the Bayes-optimal observer, stimulus kernel, and action kernel—underlying trial-by-trial choice behavior. By estimating the log-marginal likelihood for each model at the session level, we quantify the probability that a specific model architecture best accounts for subject choices across a population.

Consequently, this implementation leverages the `VBA-toolbox` (Rigoux et al., 2014) to bridge the gap between behavioral log-evidence and group-level model selection, ensuring robust inference on computational strategies.

## When to use this

Use this recipe to fit Bayes-optimal, stimulus-kernel, and action-kernel choice models and compare them with group-level exceedance probabilities. Do not use it for prediction alone when model evidence or a population-level comparison is not required.

## Scientific context

Behavioral research frequently compares normative models (Bayes-optimal) against heuristic strategies (kernels) to understand how history-dependent information influences decision-making. Model comparison ensures that differences in predictive accuracy are not merely artifacts of parameter flexibility.

## Preconditions

*   MATLAB (Optimization Toolbox).
*   VBA-toolbox (Rigoux et al., 2014).

## Inputs and outputs

1.  **Behavioral Data:** A data structure containing `stimulus`, `choice`, and `reward` history for each trial per session.
2.  **Objective Functions:** Three separate scripts/functions calculating the negative log-likelihood for the Bayes-optimal, Stimulus, and Action models.
3.  **Initialization:** A matrix of parameter starting points to prevent convergence on local minima.

*   **Result Matrix:** A CSV or MAT file containing the $S \times M$ Log-Evidence matrix.
*   **BMC Output:** A structure variable `out` containing exceedance probabilities and protected exceedance probabilities.
*   **Visuals:** A summary bar plot showing the comparison of model evidence and exceedance probabilities.

## Procedure

1.  **Generative Modeling:** Define the likelihood functions for the Bayes-optimal observer, stimulus kernel, and action kernel.
2.  **Parameter Estimation:** Perform Maximum A Posteriori (MAP) or Maximum Likelihood Estimation (MLE) on a per-session basis using constrained optimization (e.g., `fmincon`).
3.  **Evidence Computation:** Approximate the Log-Marginal Likelihood (LML) using BIC/WAIC or variational free energy to quantify model fit while penalizing complexity.
4.  **Random Effects Bayesian Model Selection (RFX-BMS):** Aggregate session-level LMLs to estimate model frequency and exceedance probabilities.

1.  **Wrapper Implementation:** Create a MATLAB or Python wrapper to loop through behavioral sessions, invoking a nonlinear optimizer (e.g., `fmincon`) to minimize the negative log-likelihood for each candidate model.
2.  **Evidence Matrix Construction:** Consolidate LML values into an $[N_{sessions} \times M_{models}]$ matrix.
3.  **Group Analysis:** Utilize the `VBA_groupBMC.m` function from the VBA-toolbox to process the evidence matrix and return posterior model frequencies.

1.  **Optimization:** For each model $m \in \{1, 2, 3\}$ and session $s$, find parameters $\theta^*$ that minimize $-\log(L(D_s | \theta_m, m))$.
2.  **BIC/AIC Calculation:** Calculate model evidence as $LML \approx -0.5 \times BIC$.
3.  **BMC Execution:** Pass the resulting $[S \times 3]$ matrix to `VBA_groupBMC.m`.
4.  **Interpretation:** Extract `out.ep` (exceedance probability) and `out.freq` (model frequency) from the VBA output structure.

## Expected results

The results typically present a bar chart of exceedance probabilities where the winning model demonstrates a probability ($P > 0.95$) significantly higher than alternative candidates. Representative fits display predicted vs. empirical choice probability traces as a function of stimulus evidence.

*   **Convergence:** All optimization runs must report successful exit flags.
*   **Model Recovery:** Simulated data from known model parameters should be correctly classified by the pipeline with $> 80\%$ accuracy.

## Pitfalls

*   **Overfitting:** Ensure the Bayes-optimal model includes a lapse rate (noise parameter); without it, the model may fail to converge on sessions with high stochasticity.
*   **Tooling:** Do not attempt to repurpose `BMS2_ModelSpec_VB.m` from `BMS4EEG` for behavioral data, as the input structures expect 4D NIfTI volumes, not trial-level vectors.

## Bundled files

- `scripts/run_analysis.py`: Run the analysis workflow.
- `scripts/utils.py`: Shared analysis utilities.

## Usage

```matlab
% Aggregate LMLs into a matrix 'L' [Sessions x 3]
[posterior, out] = VBA_groupBMC(L);
fprintf('Exceedance probabilities: %f, %f, %f\n', out.ep(1), out.ep(2), out.ep(3));
```
