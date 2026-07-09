# Reproduction Plan for _To_test_whether_flies_with_more_accurate_head-direction_enc

To reproduce the analysis of the relationship between EPG bump width and HD encoding accuracy in *Drosophila*, follow this structured pipeline. Note that since the `ITE_package_cmu` focuses on information theory and not EPG signal processing, this plan integrates standard neurophysiological analysis steps alongside necessary statistical procedures.

---

## Prerequisites
1.  **Software Environment:** Python 3.x with `numpy`, `scipy`, `matplotlib`, and `astropy` (for circular statistics).
2.  **Data:**
    *   Imaging data (E-PG activity across the Protocerebral Bridge).
    *   Behavioral data (Head direction and velocity timestamps).
    *   Metadata defining the "dim-cue" experimental block for each of the 15 flies.
3.  **Library:** Use `scipy.stats` for Pearson correlation; utilize the logic from `ITE_package_cmu` only if performing advanced non-linear dependency checks.

---

## Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference (Conceptual) | Input | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Filter Movement** | "Analyses were restricted to periods of active walking." | Custom velocity threshold logic. | Raw velocity data ($>20^\circ/s$). | Boolean mask (time points). |
| **2** | **Extract Bump Width** | Von Mises fitting to PB activity profile. | `scipy.optimize.curve_fit` | EPG neural traces. | Mean $\kappa$ or FWHM per time point. |
| **3** | **Calc Encoding Accuracy** | $1 - \text{circ\_var}(\Delta\theta)$. | `astropy.stats.circvar` | $\theta_{bump}, \theta_{HD}$. | Accuracy score ($0-1$). |
| **4** | **Aggregate Data** | 1 point per fly ($N=15$). | `numpy.mean` | Time-series metrics. | $N=15$ vectors ($X, Y$). |
| **5** | **Stat Test** | Pearson correlation. | `scipy.stats.pearsonr` | Aggregated vectors. | $R$, $P$ values. |
| **6** | **Visualization** | Scatter plot with regression line. | `matplotlib.pyplot` | $X, Y$ data; $R, P$. | PNG/PDF figure. |

### Execution Details:
1.  **Preprocessing:** For each of the 15 flies, identify the indices where velocity exceeds the threshold. Discard all other time points to ensure the relationship is analyzed during active navigation.
2.  **Bump Parameterization:** Fit the population activity vector ($P$) across the PB to a Von Mises distribution $f(x|\mu, \kappa) = \frac{e^{\kappa \cos(x-\mu)}}{2\pi I_0(\kappa)}$. The concentration parameter $\kappa$ is inversely proportional to bump width.
3.  **Accuracy Calculation:** Compute the instantaneous angular error $\Delta\theta = \theta_{bump} - \theta_{HD}$. Calculate circular variance using $V = 1 - |\frac{1}{n} \sum e^{i\Delta\theta}|$.
4.  **Aggregation:** Calculate the average $\kappa$ and average Accuracy for the entire dim-cue block for each fly.
5.  **Correlation:** Execute `pearsonr(accuracy_list, bump_width_list)`.

---

## Expected Output
*   **Numerical:** Pearson $r$ coefficient and $P$-value.
*   **Visual:** A scatter plot with:
    *   **X-axis:** HD Encoding Accuracy ($1 - \text{circ\_var}$).
    *   **Y-axis:** Mean Bump Width (or $\kappa$).
    *   **Annotation:** $P = [value]$ and a best-fit regression line.
*   **Data File:** A CSV/NPZ file containing the per-fly averages used in the plot.

---

## Troubleshooting
*   **Low correlation ($P > 0.05$):** If Pearson shows no significance, the relationship may be non-linear. This is where the `ITE_package_cmu` becomes useful: replace `pearsonr` with `ite.cost_functions.qmi_cs` (Quadratic Mutual Information) to test for non-linear dependency.
*   **High Noise:** If EPG bumps are flickering, ensure the Von Mises fit is constrained to a single peak (avoid fitting noise). Use the `movement_boolean_mask` to strictly exclude periods where the fly is immobile, as bump width is often physically broader during stationary states.
*   **Small $N$ Sensitivity:** With $N=15$, the test is sensitive to outliers. Perform a Cook’s Distance calculation to verify that the regression line is not driven by a single fly.