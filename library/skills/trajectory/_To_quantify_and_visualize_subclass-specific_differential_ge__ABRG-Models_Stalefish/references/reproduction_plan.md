# Reproduction Plan for _To_quantify_and_visualize_subclass-specific_differential_ge

To address the research question regarding subclass-specific differential gene expression (DGE) in the developing mouse visual cortex, you must transition from the provided spatial imaging codebase to a standard single-cell bioinformatics workflow.

### Prerequisites
1.  **Software Environment:** R (version 4.0+) with `Seurat` installed, or Python (3.8+) with `Scanpy`.
2.  **Data Source:** A curated single-cell count matrix (e.g., from *Hrvatin et al., 2018*) containing raw UMI counts.
3.  **Metadata File:** A CSV/RDS file mapping every cell barcode to:
    *   `cell_subclass`: (e.g., L2/3 IT, Pvalb, Vip, etc.)
    *   `age`: (P7, P8, ..., P15)
    *   `age_bin`: A custom factor collapsing ages into "P7-P10" and "P11-P15".

---

### Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference (Conceptual) | Input/Output | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Loading & Filtering** | QC methods section | `Seurat::CreateSeuratObject` | Raw counts -> Filtered Seurat Object | `nCount_RNA`, `nFeature_RNA` thresholds | Check library size vs. age |
| **2** | **Metadata Partitioning** | Methods: "Defining developmental bins" | `Idents(obj) <- "subclass"` | Subsetted Seurat objects | `age_bin` levels | Confirm grouping size > 10 cells |
| **3** | **Differential Expression** | Methods: "DGE Analysis" | `Seurat::FindMarkers` | DE tables per subclass | `test.use = "wilcox"`, `only.pos = FALSE` | Check distribution of p-values |
| **4** | **Quantification** | Results: "Transcriptional shifts" | `dplyr::filter` | Count of Up/Down genes | `p_val_adj < 0.05`, `abs(log2FC) > 0.5` | Sum of rows per subclass |
| **5** | **Visualization** | Figure 3/4: Volcano/Dot plots | `ggplot2::geom_point` | Volcano Plots (Age A vs Age B) | Threshold cutoffs | Visual symmetry in LFC |

#### Detailed Execution Steps:
1.  **Normalization:** Use `NormalizeData(object, normalization.method = "LogNormalize")`. This is essential to account for varying sequencing depths across different age samples.
2.  **Differential Analysis (Per Subclass):** Loop through unique levels of the `cell_subclass` variable.
    *   Use `FindMarkers(object, group.by = "age_bin", ident.1 = "P11-P15", ident.2 = "P7-P10")`. 
    *   *Note:* Ensure you use the same normalization for all subclasses to allow for accurate LFC comparison.
3.  **Visualization:** Generate a **Volcano Plot** for each subclass. The X-axis represents `avg_log2FC`, and the Y-axis represents `-log10(p_val_adj)`. Highlight genes that meet the significance thresholds.

---

### Expected Output
*   **A Summary Table (CSV):** Containing `Gene_Symbol`, `Subclass`, `avg_log2FC`, `p_val_adj`, and `Direction` (Up/Down).
*   **Visualizations:** A multi-panel figure where each facet is a `Subclass`, showing a volcano plot demonstrating the magnitude and statistical significance of the shift from P7–P10 to P11–P15.
*   **Quantification Summary:** A bar plot showing the total number of genes significantly up- or down-regulated per subclass.

---

### Troubleshooting
*   **The "Batch Effect" Problem:** If P7-P10 samples and P11-P15 samples were sequenced in different batches, include `batch` as a latent variable in the `FindMarkers` function (e.g., `latent.vars = "batch"`) to avoid identifying technical artifacts as DEGs.
*   **Zero Variance in Small Subclasses:** For rare cell types (e.g., specific GABAergic interneuron subsets), the Wilcoxon test may fail. Ensure you have at least 10–20 cells per age bin per subclass. If not, consider merging related subclasses.
*   **Normalization Mismatch:** Do not use the `Stalefish` code’s spatial normalization (which is image-based); stick strictly to transcriptomic-based normalization (LogNormalize or SCTransform) to avoid introducing spatial bias into single-cell data.