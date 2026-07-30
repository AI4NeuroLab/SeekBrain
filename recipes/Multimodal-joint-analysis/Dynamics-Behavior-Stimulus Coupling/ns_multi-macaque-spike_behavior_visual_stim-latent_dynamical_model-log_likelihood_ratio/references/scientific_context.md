# Scientific context

## Methodological requirements

*   **Baseline Definition:** The definition of the PSTH baseline (usually the mean firing rate at each time bin across trials).
*   **Performance Metric:** The metric used to quantify "fitting" (e.g., Poisson Log-Likelihood, Mean Squared Error, or Pseudo-$R^2$).
*   **Cross-Validation Procedure:** The method used to ensure the LDM is not overfitting compared to the static PSTH (e.g., held-out trials).
*   **Population Analysis:** The method used to aggregate results across neurons (e.g., computing the difference in log-likelihood for every neuron).

## Required data

*   **Spike Train Matrix:** $N$ neurons $\times$ $T$ time bins $\times$ $K$ trials.
*   **Held-out Data:** A subset of trials (not used for model training) to test generalization.
*   **Latent Variable Estimates:** The posterior mean of the latent states extracted from the model.

## Validation criteria

To determine if the LDM outperforms the PSTH, check for:
1.  **Metric Significance:** Is the improvement statistically significant across the population?
2.  **Generalization:** Is the improvement measured on *held-out* data? (LDMs often have more parameters than PSTHs; without cross-validation, the improvement could be an artifact of overfitting).
3.  **Heterogeneity:** Determine whether improvement is non-uniform across neurons; some neurons may be well described by PSTHs while others are latent-driven.
4.  **Consistency:** Does the LDM provide better fits for neurons with high trial-to-trial variance compared to those with low variance?
