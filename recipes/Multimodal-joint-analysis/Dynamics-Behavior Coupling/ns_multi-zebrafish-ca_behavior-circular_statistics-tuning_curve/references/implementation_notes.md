# Implementation notes

## Prerequisites

*   **Environment:** MATLAB (recommended for `Kent_func` compatibility).
*   **Data Structure:** `behavioral_data.mat` (timestamps, $\theta$, epoch indices) and `neural_data.mat` (pre-processed $\Delta F/F$ traces).
*   **Dependencies:** `analysis/libs/Kent_func/` (circular fitting), `analysis/libs/stats_plot/` (plotting), and `analysis/im_dissim/` (base processing).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Identify HD Cells | Methods: Tuning Estimation | `Kent_func/` | $\Delta F/F$, $\theta$ | Binary mask `is_HD` | Rayleigh $z$-test $p < 0.05$ |
| **2** | Estimate $b$ | Methods: Preferred Orientation | `Kent_func/fit_vonMises` | `is_HD` traces | Vector $b$ per ROI | Peaks match circular mean |
| **3** | Compute Tuning | Methods: Radial Tuning | `im_dissim/` | $\Delta F/F$, $\theta$ | Curves $T(ROI, \theta)$ | $\theta \in [-\pi, \pi]$ |
| **4** | Center & Sort | Methods: Normalization | Custom Loop | $T, b$ | Centered $T_{norm}$ | Indices $i = \text{sort}(b)$ |
| **5** | Generate Plots | Visualization Methods | `stats_plot/` | $T_{norm}$ | 3 Heatmaps | Shared `clim` scale |
| **6** | Assess Bimodality | Results: Bimodal Analysis | N/A (Manual) | $T_{norm}$ (Learning) | Bimodal metrics | $\Delta$ BIC/AIC fit |

## Expected artifacts

*   **Visualization:** A figure containing three panels: [Pre | Learning | Post]. 
    *   **Pre:** Sharp diagonal line (centered at 0).
    *   **Learning:** Visible bifurcation or secondary peaks at $\pm \pi$ for cells tuned to symmetric landmarks.
    *   **Post:** Either consolidation of the bimodal state or extinction, depending on plasticity rules.
*   **Data Objects:** A `.mat` file containing `Tuning_Matrices` (3D array), `ROI_Ordering` (index vector), and `b` (preferred orientations).
*   **Summary Report:** A text document detailing whether the bimodal "split" is correlated with $b$ (i.e., do neurons tuned to symmetric landmarks split more reliably?).

---

## Troubleshooting

*   **Mismatch in ROI count:** Ensure that the Pre-learning epoch is used as the *canonical* ROI set. If an ROI becomes silent in the "Post" epoch, it must remain in the heatmap as a row of zeros to maintain index consistency.
*   **Edge Effects:** If tuning curves appear "cut off," verify the wrapping function `mod(x + pi, 2*pi) - pi` is applied *after* subtraction, not before.
*   **Bimodality Ambiguity:** If the "Learning" epoch shows messy activity, calculate the "Modulation Index" (ratio of second peak amplitude to first). If the index is $< 0.5$, the transition to bimodal coding may be incomplete.
*   **Missing Bimodal Logic:** Since the implementation lacks a `fit_bimodal_tuning.m`, utilize `fitgmdist` (MATLAB Statistics Toolbox) with 2 components to evaluate the mixture model against the single von Mises model calculated in Step 2.
