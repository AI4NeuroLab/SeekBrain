# Reproduction Plan for _To_visualize_developmental_expression_trajectories_of_repre

To address the developmental expression trajectories using the provided research context and repository, you must bridge the gap between the **EASI-FISH imaging pipeline** and the **downstream statistical modeling** required for temporal analysis. 

### Prerequisites
1.  **Environment:** AWS CLI (for bucket access), Nextflow installed, and access to an R/Python environment (Jupyter/RStudio) with `tradeSeq` or `limma` installed.
2.  **Data:** Raw imaging data stored in S3 buckets configured for the provided Nextflow pipeline; metadata file mapping image acquisition IDs to developmental stages (e.g., E14, P0, P28).
3.  **Software:** The provided Nextflow pipeline for processing raw image stacks into a spatial gene expression matrix.

---

### Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Output | Parameters |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Image Pipeline** | Run Nextflow pipeline to extract spatial transcriptomic points. | Methods: Spot Detection | `main.nf`, `nextflow.config` | Raw OME-TIFFs | Cell x Gene Expression Matrix | `--cell_segmentation_threshold` |
| **2. Matrix Formatting** | Aggregate cell-spot counts by cell ID and developmental stage. | Methods: Differential Expression | N/A (Manual Python/R script) | Image metadata & JSON outputs | `all_stages_matrix.csv` | Cell type labels (Excitatory/Inhibitory/Glial) |
| **3. Temporal Modeling** | Use GAMs to fit expression curves for markers. | Results: Developmental Trajectory | N/A (External library: `tradeSeq`) | `all_stages_matrix.csv` | Fitted spline models | `nKnots` (e.g., 3-5) |
| **4. Dynamic Categorization** | Calculate derivatives of fitted curves to classify Up/Down/Transient. | Methods: Clustering/Classification | N/A | Fitted models | Categorized gene list (Up, Down, etc.) | FDR < 0.05 |
| **5. Visualization** | Generate heatmaps/line plots for marker genes across time. | Figures: Expression Heatmaps | N/A | Categorized gene list | Publication-ready plots | Z-score normalization |

---

### Step-by-Step Reproduction Plan

#### Step 1: Data Generation (Infrastructure Layer)
*   **Action:** Execute the Nextflow pipeline on your AWS infrastructure.
*   **Validation:** Verify that `segmentation_results/` contains CSV files where columns correspond to gene counts and rows to individual cell IDs.

#### Step 2: Temporal Integration (Data Preparation Layer)
*   **Action:** Create a master expression matrix by merging outputs from multiple developmental stages. Ensure each cell is tagged with its `developmental_stage` covariate.
*   **Validation:** Check that the cell-type distribution (e.g., *Gad1*+ inhibitory neurons) is represented in each time point.

#### Step 3: Statistical Modeling (Analysis Layer)
*   **Action:** Apply a Generalized Additive Model (GAM) to the expression values: `expression ~ s(developmental_stage, bs="cr")`.
*   **Validation:** Perform a Likelihood Ratio Test comparing the GAM to a null model (constant expression) to identify genes with significant temporal change.

#### Step 4: Categorization Logic
*   **Action:** 
    *   **Up:** Monotonic increase (positive derivative over all stages).
    *   **Down:** Monotonic decrease (negative derivative over all stages).
    *   **Transient:** Significant peak/valley (derivative changes sign).
    *   **Constant:** Non-significant LR test p-value.

---

### Expected Output
1.  **Summary Table:** A CSV mapping each marker gene to its temporal dynamic category (e.g., *Cux2*: "Up", *Gad1*: "Constant").
2.  **Visualization:** A series of smoothed line plots (e.g., `ggplot2` or `seaborn`) displaying the expression trajectories, grouped by lineage, highlighting the four defined dynamic classes.

---

### Troubleshooting
*   **Issue: Batch Effect.** If the imaging pipeline is run at different times, the expression counts may be biased. 
    *   *Solution:* Apply batch correction (e.g., `ComBat-seq`) prior to GAM fitting.
*   **Issue: Sparse Data.** If genes are detected in too few cells per developmental stage.
    *   *Solution:* Use `Scran` or `Seurat` to normalize by sequencing depth and aggregate counts into pseudobulks per cluster per stage.
*   **Issue: Code Missing.** If the `analysis/` scripts are missing from the repo.
    *   *Solution:* You must build these using `tradeSeq` (R/Bioconductor), which is the industry standard for modeling gene expression trajectories across time.