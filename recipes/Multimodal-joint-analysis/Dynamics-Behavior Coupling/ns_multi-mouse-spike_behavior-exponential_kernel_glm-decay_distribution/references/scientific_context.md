# Scientific context

## Methodological requirements

*   **Behavioral Kernel Fitting:** Utilization of the logistic regression model (or GLM-HMM) that includes a trial-history filter (action kernel) represented by an exponential decay function $f(t) = a \cdot e^{-t/\tau}$.
*   **Neural GLM:** Fitting a GLM to neural spike counts (or widefield fluorescence) where the history term uses the same exponential decay basis as the behavior, with a free parameter for the inverse decay constant $\tau$.
*   **Estimation Strategy:** Optimization using Maximum Likelihood Estimation (MLE) or cross-validated ridge regression to fit $\tau$ for each neuron/pixel-cluster per session.
*   **Statistical Analysis:** Calculation of the Pearson correlation coefficient ($R$) between the session-wise $\tau_{neural}$ and $\tau_{behav}$.

## Required data

*   **Electrophysiology:** Spike counts per trial binned in the pre-stimulus period (or specific trial-epoch of interest).
*   **Widefield Imaging:** Pre-processed fluorescence traces (delta F/F) aligned to trial start.
*   **Behavioral Data:** Trial-by-trial action history (previous choices/rewards) for the same sessions.
*   **Session Metadata:** Unique session IDs (subject/date) to perform the mapping/pairing of neural and behavioral parameters.

## Validation criteria

*   **Fit Validity:** Did the exponential decay model achieve convergence for the neural data?
*   **Modality Specificity:** Are the correlations reported separately for electrophysiology and widefield?
*   **Time-Scale Alignment:** Is the $\tau$ parameter defined consistently between the behavioral kernel and the neural regressor?
*   **Statistical Significance:** Was the Pearson correlation assessed against a permutation-based null distribution to ensure the observed coupling is not due to noise?
