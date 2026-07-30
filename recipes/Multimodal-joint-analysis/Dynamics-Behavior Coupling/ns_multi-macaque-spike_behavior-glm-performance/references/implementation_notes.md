# Implementation notes

## Prerequisites

1.  **Software Environment:** MATLAB (for Lablib execution) and a statistical analysis environment (Python/R/MATLAB) for the offline regression.
2.  **Hardware Integration:** A calibrated neural recording system (e.g., Plexon/Blackrock) capable of receiving TTL event markers from the Lablib `LLStateSystem`.
3.  **Neural Data:** Sorted spike trains from the SC intermediate layers, timestamped to the Lablib trial events.

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input/Output | Parameters |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Prior Manipulation** | Implement block-based stimulus probabilities. | Methods: Behavioral Task | `LLTaskPlugin`, `LLStateSystem` | In: Block probability. Out: Trial type events. | `BlockSize`, `PriorRatio` |
| **2. Timing Synchronization** | Define post-stimulus windows via state transitions. | Methods: Electrophysiology | `LLStateSystem` transitions | In: `StimOff` state. Out: TTL pulse to recording. | `PostStimWindow` (e.g., 200-500ms) |
| **3. Data Logging** | Ensure trial metadata is saved per trial. | Methods: Data Analysis | `LLDataDoc` | In: Contrast/Prior. Out: `.mat` data file. | `SignedContrast`, `TrialBlock` |
| **4. Neural Binning** | Extract spike counts within the post-stimulus window. | Methods: Electrophysiology | External script | In: Neural events. Out: Firing rates ($FR$). | Epoch start/end |
| **5. Regression Analysis** | Fit the logistic model for choice behavior. | Methods: Data Analysis | External script | In: $FR$, Contrast, Prior. Out: $\beta$ coefficients. | Logistic function |

## Expected artifacts

*   **Behavioral Verification:** Neurometric curves showing a horizontal shift (bias) in the PSE between high-prior and low-prior blocks.
*   **Neural Correlation:** A statistically significant interaction term ($\beta_2$ or $\beta_3$) indicating that neural activity contributes to the choice outcome above and beyond the sensory (contrast) information.
*   **PSTH Comparison:** Overlaid Peri-Stimulus Time Histograms showing divergence in SC activity trajectories based on prior condition in the post-stimulus window.

---

## Troubleshooting

*   **Issue: Timing Drift.** If TTL pulses are misaligned with neural spikes, check `LLStateSystem` clock resolution. *Fix:* Ensure the Lablib machine and the neural recorder share a common hardware trigger or master clock.
*   **Issue: Low Signal-to-Noise.** If SC activity is sparse, consider increasing the analysis window length, though this risks contaminating the window with saccadic preparation activity. *Fix:* Restrict the analysis to "M-neurons" (motor-related) specifically identified during the pre-saccadic epoch.
*   **Issue: Model Convergence.** If the logistic regression fails to converge, ensure `SignedContrast` is normalized between -1 and 1 and `FiringRates` are z-scored.
