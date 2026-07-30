# Implementation notes

## Prerequisites

*   **Environment:** Python 3.8+ with `numpy`, `scipy`, `matplotlib`, and `pandas`.
*   **Data:** Raw neural imaging data (calcium traces) and behavioral log files (`.mat` or `.csv`) containing `scene_orientation` ($\theta$) and `timestamps`.
*   **Codebase:** Access to the `analysis_scripts/` directory, specifically `bump_dynamics.py` and `epoch_indexing.py`.

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Filter Data by Epoch** | Methods: "Epoch Segmentation" | `get_epoch_indices()` | Raw timestamps | List of indices per epoch | Verify indices align with study timeline |
| **2** | **Extract Bump Phase** | Methods: "Bump Phase Estimation" | `calc_pop_vector_phase()` | Neural traces | Array of angles ($\phi \in [0, 2\pi]$) | Check for circular continuity |
| **3** | **Sync w/ $\theta$** | Results: "Mapping internal to external" | `merge_dataframes()` | `phi`, `theta` arrays | DataFrame: `[t, phi, theta]` | Check temporal alignment (no lag) |
| **4** | **Apply Epoch Transforms** | Results: "2θ relationship" | `compute_slope_mapping()` | `phi`, `theta`, `epoch_id` | Slope values for each epoch | Ensure $R^2 > 0.8$ for pre/post |
| **5** | **Visualize Plot** | Fig. X: "Mapping Panel" | `plot_bump_vs_theta.py` | Filtered `phi`/`theta` | Scatter plot with ref lines | Ensure `mod 2π` visual wrap is clean |

---

## Expected artifacts

1.  **Three scatter plots** (Pre, Learn, Post) for the specific fish.
2.  **Pre-Learning/Post-Training:** A clear diagonal trend (slope ≈ 1) indicating standard tracking of the scene.
3.  **Learning:** A transformed diagonal (slope ≈ 2, adjusted for `mod 2π`) indicating the neural representation of the environment has undergone a scaling transformation.

---

## Troubleshooting

*   **Issue: No clear slope in "Learning" phase.**
    *   *Check:* Are you accounting for the `mod 2π` wrap-around? Plotting `2 * theta` without modulo will result in a messy plot; always apply the wrap.
*   **Issue: "Bump" is noisy.**
    *   *Check:* Adjust the window size of the circular mean. If the population vector is too sensitive to transient neural noise, increase the temporal smoothing window.
*   **Issue: Discontinuity at $2\pi$ boundary.**
    *   *Check:* Ensure you are not performing standard linear regression on raw angles. Use `scipy.stats.circmean` or circular-linear correlation metrics to quantify the relationship correctly.
