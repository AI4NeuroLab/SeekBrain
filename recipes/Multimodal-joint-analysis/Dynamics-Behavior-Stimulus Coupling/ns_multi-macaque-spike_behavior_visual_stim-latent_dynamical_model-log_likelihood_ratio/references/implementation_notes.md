# Implementation notes

## Prerequisites

*   **Environment:** Python 3.8+, `numpy`, `scipy`, `matplotlib`.
*   **Model components:** LDM modules such as `mjp.py`, `generative_model.py`, and `example.py`.
*   **Data:** Simulated spike train matrices generated via `generative_model.py` (ensure $K \ge 10$ trials per neuron to allow for meaningful PSTH calculation).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input/Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. PSTH Baseline** | Calculate $\bar{r}_i(t) = \frac{1}{K}\sum_k s_{i,k}(t)$. | Methods: "Baseline Definition" | `np.mean(spikes, axis=0)` | Spike matrix ($N, T, K$) | Verify $\bar{r}_i(t)$ dimensions match $T$. |
| **2. PSTH Likelihood** | Compute $\mathcal{L}_{PSTH} = \sum \log \text{Pois}(s| \bar{r}_i(t))$. | Methods: "Performance Metric" | Custom function | PSTH array | Check for $log(0)$ (apply small epsilon). |
| **3. LDM Fit** | Fit LDM to training trials; extract posterior rate $\hat{r}_{i,k}(t)$. | Results: "Predictive Performance" | `model_fit.py` | Spike matrix | Check if `optimizer` converges (flag `success`). |
| **4. LDM Likelihood** | Compute $\mathcal{L}_{LDM}$ on **held-out** trials. | Methods: "Cross-Validation" | `likelihood_FV.py` | Posterior params | Verify log-likelihood is > PSTH-LL. |
| **5. Delta-LL Comp** | Compute $\Delta LL_i = \mathcal{L}_{LDM, i} - \mathcal{L}_{PSTH, i}$. | Results: "Comparison Plot" | `example.py` (LLR logic) | $\mathcal{L}_{LDM}, \mathcal{L}_{PSTH}$ | Ensure signs are consistent. |

## Expected artifacts

1.  **Metric:** A summary table showing Mean $\Delta LL$ across the population $\pm$ standard error.
2.  **Visualization:** A histogram (Distribution of Improvement) showing the frequency of $\Delta LL$ values. A skew toward positive values indicates LDM superiority.
3.  **Statistical Test:** A p-value from a **Wilcoxon signed-rank test** applied to the population $\Delta LL$ scores to reject the null hypothesis that the PSTH and LDM perform identically.
4.  **Scatter Plot:** Plot $\Delta LL$ vs. "Trial-to-Trial Variance" of the neurons to confirm the insight that LDM gains are largest where PSTH fails to capture dynamics.

---

## Troubleshooting

*   **Overfitting:** If the LDM outperforms the PSTH on training data but performs worse on test data, increase the regularization parameter in `model_fit.py` (e.g., penalty on the latent variance $\sigma$).
*   **Zero-Spike Bias:** If many neurons have sparse firing, the Log-Likelihood calculation may be dominated by time bins with zero spikes. Use a smoothed PSTH (Gaussian kernel) to ensure the baseline is robust.
*   **Model Non-Convergence:** If the LDM optimization fails, verify the initialization of the latent variables $x(t)$. Use the trial-averaged PSTH as a starting point (prior) for the latent firing rate to stabilize the optimization.
*   **Data Sufficiency:** If $\Delta LL \approx 0$, increase the number of trials ($K$) or the magnitude of the latent coupling $C$ in `generative_model.py` to ensure there is actually dynamic structure for the model to capture.
