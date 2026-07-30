# Implementation notes

## Prerequisites

*   **Data:** Raw spike-sorted ORBvl data, trial-level behavioral data (stimuli, choices, reward outcomes).
*   **Environment:** Python (NumPy, Scikit-learn, Scipy) or MATLAB (Statistics Toolbox).
*   **Dependencies:** `behavioral_modeling` (for Bayes-optimal prior), `decoding` (for classification), `plotting` (for visualization).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Generate Bayes-Optimal Prior** | Methods: "Bayesian Observer" | `models/bayesian_observer.py` | Trial history (S, R) | $P_{opt}$ sequence | Match block shifts |
| **2** | **Extract ITI Activity** | Methods: "ITI Binning" | `preprocessing/get_iti.py` | Spike trains, event times | Binned firing rates | Mean FR > threshold |
| **3** | **Train/Test Decoder** | Methods: "Decoding Prior" | `decoding/train_decoder.py` | ITI firing rates | Predicted $\hat{P}$ | CV accuracy > chance |
| **4** | **Quantify Correspondence** | Methods: "Statistical Metrics" | `metrics/calc_r2.py` | $P_{opt}$ and $\hat{P}$ | $r$ and $R^2$ values | Significance ($p < .05$) |
| **5** | **Visualization** | Figure X | `plotting/plot_session.py` | All three vectors | Figure: $P(t)$ vs time | Overlay alignment |

## Expected artifacts

*   **Figure:** A time-series plot of 100+ trials showing the decoded prior "tracking" the Bayes-optimal prior, specifically spiking during block transitions.
*   **Metrics Table:** A report showing the correlation ($r$) and the explained variance ($R^2$) for the example session.

---

## Troubleshooting

*   **Low Decoding Accuracy:** If $R^2$ is near 0, the ITI window may be too short. Check if the study defines ITI duration based on *behavioral reaction time* or *fixed duration*. If fixed, extend the window to capture more spikes.
*   **Overfitting:** If training accuracy is high but testing accuracy is low, increase cross-validation folds or apply L2 regularization to the weights.
*   **Spillover Contamination:** If the decoded prior correlates with current stimulus identity, the ITI window is too close to the stimulus. Re-verify the "event-locked" timestamps.
*   **Missing "Corrected" $R^2$:** If the code only provides raw $R^2$, manually implement the noise-ceiling correction by dividing by the cross-validated prediction consistency across trial repetitions.
