# Implementation notes

## Prerequisites

1.  **Software Environment:** MATLAB (required for `plot2svg` and `ITE` toolbox).
2.  **Input Data:** A structure array (e.g., `flyData`) containing:
    *   `F`: Raw fluorescence matrix ($T \times N_{ROIs}$) for each fly.
    *   `heading`: Vector of fly angular position in degrees ($T \times 1$).
    *   `condition`: Metadata tag identifying condition (0: No Cue, 1: Dim, 2: Bright).
3.  **Dependencies:** `plot2svg` (for publication-quality output).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Preprocessing** | Calculate $\Delta F/F$ using 10th-percentile baseline subtraction per trial per ROI. | Methods: "Imaging Analysis" | Manual Script (Custom) | Raw $F$ | $\Delta F/F$ matrix |
| **2. Bump Estimation** | Calculate angular bump position ($\theta_{bump}$) via circular Center-of-Mass (CoM). | Methods: "Bump Position Estimation" | Manual Script (Circular Stats) | $\Delta F/F$ | Vector $\theta_{bump}$ |
| **3. Metric Calculation** | Compute Vector Strength: $R = \|\frac{1}{T}\sum_{t=1}^T e^{i(\theta_{bump}(t) - \theta_{head}(t))}\|$. | Methods: "Encoding Accuracy" | Manual Script | $\theta_{bump}, \theta_{head}$ | Scalar (VS) per trial |
| **4. Statistics** | Perform Kruskal-Wallis test followed by post-hoc Tukey-Kramer/Bonferroni. | Data Analysis: "Statistical testing" | MATLAB Stats Toolbox | VS values per condition | P-values, effect size |
| **5. Visualization** | Plot grouped scatter (gray lines) + mean (black/SEM) using `plot2svg`. | Figure/Results: "Encoding Accuracy Plot" | `plot2svg.m` | VS values | SVG vector graphic |

## Expected artifacts

1.  **Quantitative Summary:** A table of mean vector strength $\pm$ SEM for No, Dim, and Bright conditions ($N=15$).
2.  **Visual Asset:** A high-resolution figure (generated via `plot2svg`) showing significant differences between cue conditions, annotated with asterisks indicating statistical significance ($*p<0.05, **p<0.01$).

---

## Troubleshooting

*   **Drift in Baseline:** If $\Delta F/F$ fluctuates wildly, increase the sliding window size for the 10th-percentile calculation to account for slow bleaching artifacts.
*   **Low Vector Strength:** Ensure heading data and bump position are aligned in the same circular reference frame (e.g., 0 to $2\pi$). Check for $180^\circ$ phase shifts if the EB ROIs are mapped to a different orientation.
*   **bundled implementation Integration:** 
    *   **ITE Toolbox:** Use this **only** if you need to calculate the *Mutual Information* between the bump and the cue, not for standard vector strength. 
    *   **NCut:** Ignore this; it is not relevant to this time-series analysis (it is for spatial image segmentation).
*   **Statistical Significance:** If the data is non-normal (common in VS distributions), use a non-parametric test (Kruskal-Wallis) rather than an ANOVA. Ensure multiple comparison correction (Bonferroni-Holm) is applied if comparing all pairs (e.g., Dim vs. Bright).
