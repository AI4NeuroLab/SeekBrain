# Implementation notes

## Prerequisites

*   **Environment:** Python 3.8+
*   **Libraries:** `allensdk`, `pandas`, `numpy`, `scipy`, `seaborn`, `matplotlib`.
*   **Access:** Allen Institute Brain Observatory API key (for SDK access).
*   **Knowledge:** Familiarity with the `allensdk.brain_observatory` and `allensdk.ephys` data structures.

---

## Execution details

| Step | Action | Method basis | Implementation basis (Conceptual) | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Loading** | Methods: Data Acquisition | `BrainObservatoryCache` | API Keys | `ophys_data`, `ephys_data` | `len(data) > 0` |
| **2** | **Region Alignment** | Methods: ROI Definition | `CCF_lookup_table` | CCF IDs | 32 matched cortical labels | `set(ephys_regions) == set(wfi_regions)` |
| **3** | **Shift Computation** | Methods: Neurometric calculation | `compute_d_prime()` | Raw spikes/$\Delta F/F$ | `shift_vector_e`, `shift_vector_w` | Check for nulls/NaNs |
| **4** | **Correction** | Supplementary Methods | `apply_baseline_correction()` | Raw shifts | `corrected_shifts` | Distribution check |
| **5** | **Statistics** | Statistical Analysis section | `scipy.stats.spearmanr` | `corrected_shifts` | $\rho$ and $p$-value | Verify $p < 0.05$ |
| **6** | **Visualization** | Figure Panel | `sns.regplot` | Arrays from Step 4 | Scatter plot | Visual check of trend |

## Expected artifacts

*   **Quantitative:** A Spearman's rank correlation coefficient ($\rho$) and a corresponding $p$-value.
*   **Visual:** A scatter plot with 32 points, a linear regression line, and a translucent 95% confidence interval band. 
*   **Annotation:** Text overlay on the plot: "Spearman $\rho$ = [Value], $p$ = [Value]".

---

## Troubleshooting

*   **Mismatched Region Count:** If you identify > 32 regions, verify that you are strictly applying the "visuallly responsive" filter criteria for the analysis's methods (e.g., minimum firing rate thresholds or calcium signal variance).
*   **Zero Variance in Shifts:** Ensure the "correction" step is not collapsing the data. If shifts appear identical, check that the baseline window is correctly positioned before stimulus onset.
*   **Statistical Non-Significance:** If your $p$-value is high, verify that you are not comparing "corrected" values against "raw" values. Modality-specific preprocessing (the "correction") is usually what brings the two datasets into the same statistical space.
*   **Code Caveat:** Do not use `nonsense.ipynb` for these steps. That notebook is for testing the **robustness of the statistical estimators**, not for performing the biological measurement. If your results in Step 5 feel suspicious, *then* use the `pseudosession` method from `nonsense.ipynb` to shuffle your data and check if your $\rho$ value remains significant against the null distribution.
