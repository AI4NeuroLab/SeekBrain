# Reproduction Plan for _To_test_whether_cue-offset_remapping_is_related_to_the_conf

This reproduction plan outlines the systematic analysis of how cue-offset remapping relates to cue conflict in *Drosophila* sensory integration.

---

### 1. Prerequisites
*   **Environment:** Python 3.9+ with libraries: `numpy`, `pandas`, `scipy`, `matplotlib`, `seaborn`, `pymc`, `arviz`.
*   **Data:** 18 NWB files containing per-frame heading and stimulus phase markers (`cue_contrast`).
*   **Domain Knowledge:** Familiarity with circular statistics (angular difference, mean resultant length, von Mises distributions).

---

### 2. Step-by-Step Procedure

| Step | Action | Paper/Code Reference | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Data Extraction** | Extract `initial`, `both`, and `final` offsets for 18 flies. | `load_nwb_data.py` | 18 NWB files | List of 36 `(fly, cue)` objects | Check that each fly has valid data for all 3 phases. |
| **2. Aggregation** | Group data by `fly_id` and `cue_id`. Calculate mean offset per phase. | `preprocess_behavior.py` | Phase-segmented arrays | 36-row DataFrame | Verify `len(df) == 36`. |
| **3. Metric Calculation** | Calculate `conflict` and `change` using `circ_dist` (wrapped). | `utils_math.py` | Mean phase offsets | `conflict` and `change` columns | Ensure values are in `[-180, 180]` range. |
| **4. Bayesian Modeling** | Fit linear model with von Mises residuals. | `fit_remapping_models.py` | DataFrame (36 rows) | Model posterior parameters ($\alpha, \beta$) | R-hat values $\approx 1.0$. |
| **5. Visualization** | Plot scatter + regression trend line. | `plot_remapping.py` | Model params, DataFrame | Scatter plot (Black/Gray) | Check axes labels and color coding. |

#### Detailed Execution Steps:
1.  **Phase Extraction:** Iterate through `cue_contrast` array. Map `1` to `initial_cue_1`, `2` to `initial_cue_2`, `3` to `both`. For each file, compute `mean(offset)` for the first occurrence of `1` (or `2`), the first occurrence of `3`, and the final occurrence of `1` (or `2`).
2.  **Circular Math:** Implement `def circ_dist(a, b): return np.degrees(np.arctan2(np.sin(np.radians(a-b)), np.cos(np.radians(a-b))))`.
    *   `Conflict` = `circ_dist(offset_both, offset_initial)`
    *   `Change` = `circ_dist(offset_final, offset_initial)`
3.  **Bayesian Implementation:**
    *   Using PyMC: `mu = beta0 + beta1 * conflict`.
    *   `likelihood = pm.VonMises('likelihood', mu=mu, kappa=kappa, observed=offset_change)`.
    *   Use NUTS sampler to estimate the slope of `beta1`.

---

### 3. Expected Output
*   **Dataset:** A 36-row CSV/Table with columns: `fly_id`, `cue_label`, `offset_initial`, `offset_both`, `offset_final`, `conflict`, `change`.
*   **Model Fit:** Posterior distribution summaries (Mean $\pm$ HDI) for the regression slope $\beta_1$.
*   **Figure:** A scatter plot with:
    *   **X-axis:** Cue Conflict ($[-180, 180]$ degrees).
    *   **Y-axis:** Offset Change ($[-180, 180]$ degrees).
    *   **Styling:** Cue 1 points (Black circles), Cue 2 points (Gray circles).
    *   **Trend:** A solid colored line representing the regression mean, with shaded ribbons representing the 95% HDI.

---

### 4. Troubleshooting

*   **Non-convergent Model:** If the von Mises model fails to converge, verify that the `kappa` parameter (concentration) is initialized reasonably. A small `kappa` suggests the data is too noisy; check if the 18 flies contain high behavioral variance.
*   **Wrap-around Artifacts:** If you see points forming lines at the edges of the plot, it confirms that `arctan2` was not used correctly in your circular difference function. Ensure all inputs to `np.sin/cos` are in radians.
*   **Missing Metadata:** If NWB files lack `cue_contrast` labels, verify if the cue phases must be inferred from the stimulus timestamp arrays (`stim_on`, `stim_off`).
*   **Sample Size Discrepancy:** If you obtain >36 points, ensure you are taking the *mean* across the experimental phases as specified, not the trial-by-trial mean.