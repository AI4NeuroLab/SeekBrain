# Reproduction Plan for _To_test_whether_flies_with_more_accurate_head-direction_enc

This plan outlines the reproduction of the analysis correlating EPG bump width with HD encoding accuracy. Since the provided repository is structural/connectomic, this procedure assumes the procurement of the functional calcium imaging data associated with the relevant *Drosophila* study (e.g., *Green et al., 2017* or *Fisher et al., 2019*).

---

## Prerequisites
1.  **Data:** Access to functional calcium imaging time-series (e.g., EPG neuron calcium traces) and behavioral tracking data (fly heading/velocity) for 15 flies during the "dim-cue" block.
2.  **Environment:** Python 3.x with `numpy`, `pandas`, `scipy`, `matplotlib`, `seaborn`, and `astropy` (for circular statistics).
3.  **Connectivity Context:** Use the existing `connectivity_matrices.py` only if needing to verify the EPG neurons' physical ring-attractor architecture as a prior.

---

## Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference (Create) | Input | Output | Parameters |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Filter Movement** | Methods: Behavioral epochs | `behavior_filter.py` | Velocity data | Time indices (Mask) | $v > \text{threshold}$ |
| **2** | **Extract EPG Phase/Width** | Methods: Bump fitting | `bump_analysis.py` | Calcium traces | $\phi(t)$, $\sigma(t)$ | Von Mises/Gaussian |
| **3** | **Compute Accuracy** | Metrics: Encoding accuracy | `stats_utils.py` | $\phi(t), \theta_{HD}(t)$ | Per-fly accuracy | $1 - \text{circ\_var}(\Delta \theta)$ |
| **4** | **Aggregate Data** | Methods: Population stats | `aggregate_results.py` | Per-fly metrics | `results.csv` | N=15 |
| **5** | **Correlation/Plot** | Results: HD-bump relationship | `plot_results.py` | `results.csv` | Scatter plot | Pearson correlation |

### Detailed Execution
1.  **Filter Movement:** Import velocity time series. Implement `boolean_mask = velocity > v_threshold`.
2.  **Bump Fitting:** For every time point in the mask, fit a Von Mises distribution to the EPG population activity vector. The distribution parameters are: $\mu$ (bump phase), $\kappa$ (concentration/width), and $A$ (amplitude). Note: $\sigma \propto 1/\sqrt{\kappa}$.
3.  **HD Encoding:** Compute the phase offset: $\Delta \theta = (\phi_{EPG} - \theta_{HD}) \pmod{2\pi}$. Calculate $1 - \text{circular\_variance}(\Delta \theta)$ for each fly.
4.  **Aggregate:** Create a `pandas.DataFrame` where each row is one fly (15 total). Populate with `mean_bump_width` (mean of $\sigma$ across valid time points) and `accuracy_score`.
5.  **Plot:** Use `seaborn.regplot` to plot accuracy (x) vs width (y). Use `scipy.stats.pearsonr` to extract $r$ and $P$. Annotate the plot with `plt.text`.

---

## Expected Output
*   **Data Object:** `fly_metrics.csv` containing columns: `fly_id`, `mean_bump_width`, `encoding_accuracy`.
*   **Statistical Result:** A Pearson $r$-value and $P$-value (e.g., $P < 0.05$ indicating a significant relationship).
*   **Visualization:** A figure showing a scatter plot of 15 points, a downward-sloping regression line (expected if narrower bumps imply more accurate encoding), and the statistical annotation.

---

## Troubleshooting
*   **High Noise:** If the bump fitting fails (low $R^2$), increase the velocity threshold to ensure the fly is walking briskly, which typically stabilizes the EPG bump.
*   **Circular Statistics Issues:** Ensure the subtraction $\phi_{EPG} - \theta_{HD}$ is wrapped correctly using `scipy.stats.circmean` or `numpy.angle(np.exp(1j * diff))`.
*   **Data Missingness:** If a fly has insufficient movement epochs, exclude it from the $N=15$ sample set and report the final $N$ clearly to maintain statistical integrity.
*   **Mismatch with Repo:** If variables like `kappa` are unclear, refer to `encoding with multiple harmonics.ipynb` in the current repo; it defines the Fourier components of the bump that act as the theoretical proxy for the bump width extracted from raw data.