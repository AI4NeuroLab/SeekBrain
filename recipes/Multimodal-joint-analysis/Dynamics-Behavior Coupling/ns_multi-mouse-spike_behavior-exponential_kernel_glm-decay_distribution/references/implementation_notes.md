# Implementation notes

## Prerequisites

*   **Environment:** Access to the IBL `ONE` API and the `ibl-brain-wide-map` bundled implementation.
*   **Data Dependencies:** `repro_ephys_release.txt` (for electrophysiology) and the equivalent widefield session list.
*   **Libraries:** `numpy`, `scipy`, `pandas`, `statsmodels` (or `scikit-learn`), `ibllib`, and `one-api`.
*   **Core Concepts:** Familiarity with the exponential decay kernel $f(t) = a \cdot e^{-t/\tau}$.

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Data Preparation** | Load aligned trial history and neural activity (spikes/fluorescence). | Methods: Neural GLM | `src/0_data_caching.py` | `repro_ephys_release.txt` | Trial-aligned matrices ($X_{hist}, Y_{neural}$) | Spike/Fluor count consistency |
| **2. Behavioral Fitting** | Fit the action kernel model to estimate $\tau_{behav}$. | Methods: Behavioral kernels | `ibl-behavioral-fit` (ext) | `trials_table` | Scalar $\tau_{behav}$ per session | Residual error minimization |
| **3. Neural GLM Implementation** | Fit an exponential decay model: $Y_{neur} \sim \beta_0 + \beta_1(X_{hist} \cdot e^{-t/\tau})$. | Results: Neural history encoding | *New Script:* `fit_encoding_model.py` | Neural time-series | $\tau_{neural}$ per neuron/pixel | Convergence of MLE |
| **4. Aggregation** | Group $\tau_{neural}$ values (e.g., take the mean or top 10% of responsive units). | Methods: Correlation | *New Script:* `run_analysis.py` | $\tau_{neural}$, $\tau_{behav}$ | Session-wise pairings | Shape of input array |
| **5. Statistical Analysis** | Compute `pearsonr` for ephys vs. behavior, and widefield vs. behavior. | Results: Correlation plots | `scipy.stats.pearsonr` | Session pairs | $r$-value, $p$-value | $p < 0.05$ threshold |

## Expected artifacts

*   **Table:** A summary table listing the Pearson correlation coefficient ($r$) and significance ($p$) for both Ephys and Widefield modalities.
*   **Visualization:** Two scatter plots (x-axis: $\tau_{behav}$, y-axis: $\tau_{neural}$) with regression lines, colored/grouped by recording modality.
*   **Data File:** `tau_results_summary.csv` containing session IDs, modality type, estimated $\tau$ values, and model goodness-of-fit metrics.

---

## Troubleshooting

*   **Non-Convergence:** If the GLM fails to converge, ensure the neural data is standardized (z-scored) and the trial history variable is binary (previous win/loss or left/right choice).
*   **Heterogeneity:** If $\tau_{neural}$ varies widely across neurons in a single session, take the average of the "significantly history-responsive" neurons (using a likelihood ratio test vs. a model without history).
*   **Data Sparsity:** If widefield signals are too noisy for decay estimation, apply a spatial PCA/ICA reduction to the fluorescence data before fitting the GLM.
*   **Alignment Errors:** Ensure the behavioral kernel uses the exact same `trials_table` used for the neural alignment; discrepancies in trial counts (dropped trials) will invalidate the Pearson correlation.
