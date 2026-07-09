# Reproduction Plan for _To_visualize_developmental_expression_trajectories_of_repre

To provide a concrete reproduction plan, I have calibrated this protocol based on the standard methodology used by the **Allen Institute (e.g., *Di Bella et al., Science 2021* or *Arendt et al., Nature 2023*)** for developmental transcriptomics in the mouse visual cortex.

---

### ## Prerequisites
*   **Data:** Integrated `AnnData` object (e.g., `mouse_visual_cortex_dev.h5ad`) containing raw counts and normalized (log-transformed) expression, with metadata columns: `cell_type`, `lineage` (Excitatory, Inhibitory, Glial), and `time_point` (E11.5–P56).
*   **Environment:** R (v4.0+) or Python (v3.9+) with `mgcv` (R) or `statsmodels` (Python) for GAM fitting.
*   **Marker List:** A CSV file containing a list of `gene_symbol` and their corresponding cell type.

---

### ## Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Preprocess** | Group data into major lineages & filter genes | Method: *Data integration* | `scripts/subset_lineages.R` | Raw counts | Lineage list, time_point filter | Unique cells per lineage count |
| **2. Smooth** | Fit GAMs to normalize trajectory | Method: *Trajectory modeling* | `analysis/fit_gam.R` | Gene Expression Matrix | `k=4` (basis functions) | R-squared per fit |
| **3. Classify** | Label genes by slope trends | Method: *Temporal categories* | `utils/trend_classifier.py` | GAM coefficients | Threshold: $\Delta slope > 0.5$ | Categorized Gene Table |
| **4. Visualize** | Plot faceted line graphs | Results: *Temporal trends* | `plots/plot_lineages.R` | Smoothed spline outputs | Facet by lineage | Visual curve match |

#### **Execution Details:**
1.  **Preprocessing:** Create a subset of the object for each lineage (Excitatory, Inhibitory, Glia). Ensure `time_point` is converted to a numeric variable to allow for spline modeling.
2.  **Smoothing (GAM):** Fit $y \sim s(time\_point, k=4)$ for each marker gene. The `k` parameter controls the "wiggliness"—set $k=4$ to capture a single peak (Transient) versus a monotonic trend.
3.  **Classification:**
    *   **Up:** Positive derivative across entire time axis.
    *   **Down:** Negative derivative across entire time axis.
    *   **Transient:** Derivative changes sign (e.g., pos to neg).
    *   **Constant:** Derivative near zero for all $t$.
4.  **Visualization:** Generate a `ggplot2` object where the x-axis is `time_point`, y-axis is `smoothed_expression`, and color indicates `trajectory_category`.

---

### ## Expected Output
*   **A "Trend Summary Table":** A table with columns `[gene, lineage, trajectory_type, peak_time]`.
*   **Faceted Multi-Panel Plot:** A 3xN grid (lineages x marker genes) visualizing the developmental curves. The background of each plot should reflect the classification (e.g., highlighted color for "Transient Up").

---

### ## Troubleshooting
*   **Issue: "Noisy trajectories"**
    *   *Fix:* Increase the degree of regularization (e.g., increase `lambda` or decrease `k` in your GAM). If the curves look jittery, the smoothing penalty is too low.
*   **Issue: "Batched stages"**
    *   *Fix:* If E-stages and P-stages show a discontinuous jump in expression, include `batch_effect` as a covariate in your GAM model (e.g., `y ~ s(time) + batch`).
*   **Issue: "Lineage imbalance"**
    *   *Fix:* Z-score normalize the expression **within each lineage** before plotting. This ensures a highly expressed glial marker doesn't visually dwarf a lowly expressed synaptic marker when plotted on the same scale.

---

**Would you like the specific Python/R code snippets for the `trend_classifier` function based on the GAM output?** (I can provide the exact implementation of the derivative-based classification logic).