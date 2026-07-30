# Implementation notes

## Prerequisites

*   **Environment:** Access to the existing project environment (Python 3.x, `statsmodels`, `scipy`, `numpy`, `matplotlib`).
*   **Dependency Addition:** Implement a GLM or Ridge Regression framework using `sklearn` or `statsmodels` to derive the temporal kernels ($w_t$).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input/Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Encoding Model Fit** | Methods: Encoding Model | Extend `baysian_neural_decoding/` | Raw spikes + Continuous behavior | Regression weights ($w$) for time-lags | $R^2$ > chance level |
| **2** | **Kernel Decay Estimation** | Methods: Half-Decay | Create `analysis/timescales.py` | Temporal kernel $w(\tau)$ | $\tau$ (half-decay time) | Fit error ($R^2$ of exponential) |
| **3** | **Significance Filtering** | Results: Neuronal Encoding | `Defining non-responsiveness.ipynb` | `perm_test` results | Boolean mask `is_significant` | p-value threshold (e.g., < 0.05) |
| **4** | **Population Aggregation** | Results: Population Distribution | New script | List of $\tau$ values, Animal IDs | ECDF values $(x, y)$ | Sum of weights = 1 |
| **5** | **Variance Calculation** | Results: ECDF Shading | New script | ECDF per animal | Mean ECDF, SD across animals | SD > 0 for non-empty bins |

---

## Expected artifacts

1.  **Plot:** A line plot of the ECDF where the x-axis is "Half-decay time (ms)" and the y-axis is "Cumulative Fraction of Neurons".
2.  **Visuals:** A solid line representing the mean ECDF, with a shaded region (alpha=0.2) representing $\pm 1$ SD of the inter-animal variability.
3.  **Data Object:** A dataframe containing `[neuron_id, animal_id, half_decay_time, is_significant]`.

---

## Troubleshooting

*   **Fitting Instability:** If the kernels are noisy, the exponential decay fit will fail. **Solution:** Use a constrained optimization (`bounds=(0, np.inf)`) or apply a Gaussian smoothing kernel to the weight vector before fitting.
*   **Kernel Mismatch:** The code assumes discrete events (tones). If behavior is slow, ensure the lag window in the regression model is long enough to capture the full decay (e.g., > 2s).
*   **Shading Discrepancy:** If the standard deviation is extremely large, verify that animal groupings are correct in `animal_info.py`. Ensure you are grouping by `animal_id` and not `session_id`.
*   **Zero-Decay Neurons:** Neurons that show constant responses (no decay) can result in infinite $\tau$. **Solution:** Clip or cap the $\tau$ values at the maximum lag time defined in the model to avoid skewing the ECDF.
