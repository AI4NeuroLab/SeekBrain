# Scientific context

## Methodological requirements

*   **Exponential Decay Fitting:** Methods used to estimate the decay constant for neural population activity (often derived from the autocorrelation function or latent state transition probabilities).
*   **Behavioral State Mapping:** Methods used to quantify the temporal persistence of behaviors (e.g., HMM state dwell-time distributions or survival functions).
*   **Inverse Decay Calculation:** The mathematical transformation used to convert time constants ($\tau$) into decay rates (inverse decay constants: $1/\tau$).
*   **Session-wise Aggregation:** The specific pipeline for aligning neural and behavioral data on a per-session basis to ensure temporal correspondence.

## Required data

*   **Neural Time-series:** Binned spike counts or latent factors extracted from neural population activity across multiple recording sessions.
*   **Behavioral Annotations:** Time-series labels of mouse behaviors (or kinematic latent states) corresponding to the same sessions.
*   **Session Metadata:** Identifier tags to group neural and behavioral data by experimental session for the correlation analysis.

## Validation criteria

*   **Temporal Precision:** Are the neural and behavioral time constants calculated using the same windowing or normalization parameters?
*   **Robustness:** Does the analysis account for session-to-session variability in noise levels or recording depth?
*   **Statistical Validity:** Is the correlation calculated at the session level (N=number of sessions) rather than pooled across time-bins to avoid inflating degrees of freedom?
*   **Inverse Mapping:** Does the study explicitly state the transformation from time constant ($\tau$) to inverse decay constant ($1/\tau$)?
