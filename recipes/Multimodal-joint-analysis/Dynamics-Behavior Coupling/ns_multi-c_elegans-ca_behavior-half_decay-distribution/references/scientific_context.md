# Scientific context

## Methodological requirements

*   **Encoding Model:** A regression-based model (e.g., GLM or ridge regression) used to predict neural activity from behavioral features using multiple time lags.
*   **Half-Decay Calculation:** A method to fit the temporal kernels (e.g., exponential decay function $f(t) = e^{-t/\tau}$) to determine the time $\tau$ at which the kernel amplitude drops to half of its peak.
*   **Significance Testing:** Permutation-based testing or cross-validated $R^2$ thresholds to define "neurons that significantly encode at least one behavior."
*   **ECDF Computation:** The process of aggregating the median half-decay times for the subset of significant neurons and calculating the empirical cumulative distribution.

## Required data

*   **Neural Activity:** Spike counts or fluorescence traces aligned to behavioral timelines.
*   **Behavioral Variables:** Time-series data of animal motion (e.g., velocity, head direction, trajectory).
*   **Model Weights:** Temporal kernels derived from the encoding model for each neuron.
*   **Animal Metadata:** Identifiers to group neurons by animal for the calculation of standard deviation shading.

## Validation criteria

*   **Filtering Accuracy:** Does the code correctly exclude neurons that do not reach the significance threshold for behavioral encoding?
*   **Kernel Estimation:** Is the half-decay time derived from the fitted temporal kernel or the autocorrelation function? (Must be consistent with the study's definition of "encoding timescale").
*   **Aggregation:** Does the calculation correctly compute the median half-decay time per neuron *before* constructing the ECDF?
*   **Error Representation:** Does the shading reflect the inter-animal variance (SD) rather than the standard error of the mean (SEM)?
