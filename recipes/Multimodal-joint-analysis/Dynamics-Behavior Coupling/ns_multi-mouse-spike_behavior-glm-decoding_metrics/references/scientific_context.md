# Scientific context

## Methodological requirements

*   **Population Decoding:** Implementation of a linear support vector machine (SVM) or a Poisson-GLM decoder trained on neural firing rates during the ITI.
*   **Cross-validation:** Leave-one-trial-out cross-validation to ensure the decoder does not overfit individual trial noise.
*   **Bayesian Observer Model:** Implementation of the trial-by-trial posterior estimation model to generate the "Bayes-optimal" benchmark.
*   **Statistical Metrics:** 
    *   **Pearson Correlation ($r$):** To measure the linear relationship between the decoder output and the model output.
    *   **Corrected $R^2$:** To measure the proportion of variance in the Bayes-optimal prior explained by the ORBvl neural activity, adjusted for the number of neurons/trial count.

## Required data

*   **Neural Data:** Spiking activity from ORBvl neurons, binned during the ITI (typically 500ms–1000ms window preceding the stimulus).
*   **Behavioral Data:** Trial history (previous stimulus/reward outcomes) to compute the Bayes-optimal prior, and the "true" block switch points for the hidden state identity.
*   **Session Metadata:** Identification of sessions with sufficient ORBvl unit yield to support reliable population decoding.

## Validation criteria

*   **Temporal Precision:** The decoder must specifically use the ITI window (activity before the stimulus appears) to ensure it represents the *prior* rather than the *response* to the stimulus.
*   **Benchmark Accuracy:** The decoded prior must track the fluctuations in the Bayes-optimal prior, not just the mean block-level probability.
*   **Robustness:** The $R^2$ calculation must account for the limited number of trials or neurons to avoid overestimation of decoding accuracy.
