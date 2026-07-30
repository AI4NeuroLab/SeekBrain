# Implementation notes

## Prerequisites

*   **Environment:** R (with `dplyr`, `ggplot2`) and Python (with `umap-learn`, `numpy`, `scipy`).
*   **Data:** 
    *   `Raw_Traces.csv`: Time-series neural activity (Ca2+) for $N$ neurons $\times$ $T$ frames across 14 animals.
    *   `Behavior_Logs.csv`: Time-stamped feeding events for each animal.
*   **External Dependencies:** 
    *   `CePNEM` bundled implementation/implementation (to generate feeding-tuning coefficients).
    *   `uwot` or `umap-learn` packages for manifold dimensionality reduction.

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Aggregation** | "Data from 14 animals" | `R/bind-rows.R` | Individual animal matrices | Unified `all_neurons` dataframe | Check total neuron count = sum of all animals |
| **2** | **Tuning Calculation** | "CePNEM-derived tuning" | [External Logic] | Neural traces + Behavior | `tuning_index` per neuron | Compare indices to known positive/negative controls |
| **3** | **Manifold Embedding** | "UMAP embedding" | [External Logic] | `all_neurons` activity matrix | 2D `UMAP_x`, `UMAP_y` coords | Verify 2D space captures > 30% of variance |
| **4** | **Data Integration** | "Coloring the UMAP" | `R/mutate.R` | UMAP coords + `tuning_index` | Master dataframe with tuning columns | `head(df)` displays all variables correctly joined |
| **5** | **Subsetting** | "Feeding-activated/inhibited" | `R/filter.R` | Master dataframe | Filtered subset for stats | `table(subset$class)` to ensure group sizes are non-zero |
| **6** | **Visualization** | "Graded along one axis" | `ggplot2` (via R) | Master dataframe | Color-coded UMAP plot | Check for smooth color gradient along UMAP_x axis |

---

## Expected artifacts

*   **Visual:** A scatter plot where each point represents a neuron, color-coded by its feeding-tuning coefficient. You should observe a shift in color (e.g., blue-to-red) along the X-axis (the "feeding-encoded" axis).
*   **Statistical:** A distribution density plot confirming that "feeding-activated" (high index) and "feeding-inhibited" (low index) neurons occupy distinct, yet continuous, regions of the UMAP space.

---

## Troubleshooting

*   **Artifacts in UMAP:** If the manifold looks like "blobs" rather than a continuous axis, adjust the `n_neighbors` parameter in UMAP (e.g., increase to 30–50 to capture global manifold structure rather than local clusters).
*   **Lack of Gradient:** If the colors look random, check the registration of the `neuron_id` during the `mutate()` step. Ensure that indices are not being shuffled during the `bind_rows()` process.
*   **Batch Effects:** If the 14 animals appear as separate clusters, the UMAP is likely embedding animal-specific noise rather than neural state. Re-run UMAP after standardizing (Z-scoring) the neural activity across all animals.
