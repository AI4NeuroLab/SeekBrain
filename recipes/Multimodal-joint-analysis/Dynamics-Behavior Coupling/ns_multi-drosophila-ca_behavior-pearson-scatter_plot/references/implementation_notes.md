# Implementation notes

## Prerequisites

*   **Data:** 15 folders (one per fly) containing:
    *   `epg_traces.npy`: Normalized fluorescence ($\Delta F/F$) for the EPG population (16 segments).
    *   `behavior.npy`: Time-series containing `head_angle` (rad) and `ball_velocity` (mm/s).
*   **Libraries:** `numpy`, `scipy`, `matplotlib`, `pandas`.
*   **Theoretical Basis:** Use the harmonic analysis logic found in `encoding with multiple harmonics.ipynb` to define how the neural population vector represents heading $\theta$.

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Load & Filter** | Apply velocity threshold ($v > 2 \text{mm/s}$) to isolate movement epochs. | "Methods: Data Filtering" | `fruit_fly_data_analysis.ipynb` (IO structure) | `behavior.npy` | `mask_indices` | Plot velocity vs time to verify filter logic. |
| **2. Decode Phase** | Compute EPG bump phase $\phi$ via circular mean of activity or FFT. | "Methods: EPG Decoding" | `encoding with multiple harmonics.ipynb` | `epg_traces` | `phi_epg` | Ensure phase wraps at $[-\pi, \pi]$. |
| **3. Metric A** | Compute $V = \text{circular\_var}(\phi_{epg} - \theta_{head})$. Accuracy $= 1 - V$. | "Methods: HD Accuracy" | `numpy` (stats) | `phi`, `head_angle` | `accuracy_score` | Accuracy ranges $[0, 1]$. |
| **4. Metric B** | Fit von Mises distribution to EPG activity to extract bump width ($\kappa$ or FWHM). | "Methods: Bump Width" | `encoding with multiple harmonics.ipynb` | `epg_traces` | `width_mean` | Verify fit residuals are low. |
| **5. Correlation** | Perform Pearson correlation between `accuracy_scores` and `widths`. | "Statistical Test" | `scipy.stats.pearsonr` | `[15 scores, 15 widths]` | `r_val`, `p_val` | Check $N=15$. |
| **6. Visualization** | Plot scatter + `linregress` line + $P$-value annotation. | "Figure Panel" | `matplotlib.pyplot` | `r_val`, `p_val`, arrays | Scatter figure | Ensure axes are labeled. |

---

## Expected artifacts

*   **Numerical:** A CSV file (`population_metrics.csv`) with columns: `fly_id`, `mean_width`, `encoding_accuracy`.
*   **Statistical:** A terminal output showing: `Pearson r: X.XX, P-value: Y.YY`.
*   **Visual:** A single publication-quality figure:
    *   **X-axis:** HD Encoding Accuracy ($1 - V$)
    *   **Y-axis:** Mean EPG Bump Width (radians/bins)
    *   **Elements:** 15 data points, a linear regression line, and a text box showing $r$ and $P$.

---

## Troubleshooting

*   **Bump Width Definition:** The bundled implementation focuses on harmonics. If the EPG population is 16 neurons, define width as the Circular Standard Deviation or the $\kappa$ parameter of a von Mises fit to those 16 points. Ensure this is consistent across all 15 flies.
*   **Phase Discontinuities:** When calculating $\phi_{epg} - \theta_{head}$, ensure the result is treated as a circular difference: $\Delta \theta = \text{angle}(e^{i(\phi_{epg} - \theta_{head})})$. Failure to do this will lead to errors at the wrap-around point ($-\pi/\pi$).
*   **Low Movement Periods:** If a fly has very few movement periods, it may skew the encoding accuracy. **Solution:** Implement a minimum time requirement (e.g., discard flies with $< 60$ seconds of movement).
*   **bundled implementation Integration:** The `encoding with multiple harmonics.ipynb` provides the mathematical model for how the network should behave. Use the *same* decoding function used in that notebook to decode the experimental calcium imaging traces to ensure parity between theory and experiment.
