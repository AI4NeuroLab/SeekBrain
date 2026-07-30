# Scientific context

## Methodological requirements

*   **Ridge Regression (Tikhonov Regularization):** Used as the primary linear decoder to map neural activity $R(t)$ to velocity $V(t + \tau)$.
*   **Time-Lagged Decoding:** Systematic shifting of the time offset ($\tau$) to probe the predictive window.
*   **Control/Scrambled Decoder:** Shuffling neural data or behavior labels to establish a baseline error for performance normalization.
*   **Sliding Window Averaging:** 10-second window applied to the predicted velocity values for smoothing.
*   **Metric:** Performance = $Error_{control} - Error_{actual}$.

## Required data

*   **Neural Activity:** High-resolution time-series data (e.g., calcium imaging or electrophysiology) corresponding to the behavioral epoch.
*   **Behavioral Data:** Continuous velocity vectors ($V$).
*   **Temporal Alignment:** Precise synchronization between the neural recording timestamps and the behavioral tracking frames.
*   **Animal Cohort:** Sufficient number of subjects to compute the standard deviation (SD) shown in the shading.

## Validation criteria

*   **Temporal Sensitivity:** Does the decoder performance peak at a specific time offset ($\tau \neq 0$)?
*   **Significance:** Is the performance (Brown curve) significantly above the zero-baseline (control) across the relevant time offsets?
*   **Comparison:** How does the performance at specific offsets compare to the "All-time" (gray) or "Current-time" (black) decoders?
*   **Robustness:** Is the SD shading sufficiently tight to conclude that the information about past behavior is a conserved feature across all animals?
