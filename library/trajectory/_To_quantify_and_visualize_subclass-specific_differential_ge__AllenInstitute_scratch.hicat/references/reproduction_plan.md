# Reproduction Plan for _To_quantify_and_visualize_subclass-specific_differential_ge

To reproduce the subclass-specific differential gene expression (DGE) analysis between pre- and post-eye-opening windows, follow this standardized workflow derived from the *Hrvatin et al.* (2018) methodology.

---

## Prerequisites
*   **Data:** Raw count matrix (UMI counts) and metadata (`cell_id`, `subclass`, `animal_id`, `age_group` [P7 vs. P14]).
*   **Environment:** R (v4.0+), `Seurat` (or `SingleCellExperiment`), `DESeq2` or `edgeR`, and `ggplot2`.
*   **Dependency:** `scuttle` (for `aggregateAcrossCells`).

---

## Step-by-Step Procedure

| Step | Action | Paper/Code Reference | Input | Parameters | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Pseudobulk Aggregation** | Aggregate counts by `subclass` + `animal_id`. | Method: "Pseudobulk aggregation" | Count matrix | `by=c("subclass", "animal_id")` | `SummarizedExperiment` object |
| **2. DGE Modeling** | Fit model with `animal_id` as random effect or blocking factor. | Paper: "Linear mixed-effects model" | Pseudobulk counts | `design = ~age_group + animal_id` | `DESeqDataSet` object |
| **3. Thresholding** | Apply significance and magnitude cutoffs. | Paper: "FDR < 0.05, \|LFC\| > 0.5" | Results table | `padj < 0.05`, `abs(log2FC) > 0.5` | Filtered gene list |
| **4. Quantifying** | Count Upregulated vs Downregulated genes per subclass. | Analysis: "Summary Tables" | Filtered list | `group_by(subclass, direction)` | `tibble` of counts |
| **5. Visualization** | Generate faceted volcano plots per subclass. | Visualization: "Volcano plots" | DGE statistics | `aes(x=log2FC, y=-log10(padj))` | Faceted PDF |

### Validation per step:
1.  **Aggregation:** Ensure each sample has at least 50 cells contributing to the pseudobulk; discard low-cell samples to avoid extreme LFC bias.
2.  **Modeling:** Verify that `DESeq2` returns a non-zero number of degrees of freedom. Check for convergence errors.
3.  **Thresholding:** Inspect the distribution of log-fold changes to ensure the threshold (e.g., 0.5) isn't excluding all genes due to low variance.
4.  **Visualization:** Use `geom_vline` and `geom_hline` to overlay the paper’s specific threshold criteria on the plots.

---

## Expected Output
*   **Statistical Table:** A master CSV file containing `gene_id`, `subclass`, `log2FoldChange`, `padj`, and `regulation_status` (Up/Down/NS).
*   **Summary Visualization:** A faceted volcano plot (one facet per subclass) showing gene density.
*   **Summary Bar Plot:** A stacked bar chart showing total counts of Up vs. Down genes, ordered by the intensity of the transcriptomic shift.

---

## Troubleshooting
*   **Problem: "Zero or very few DEGs identified."**
    *   *Solution:* The `log2FC` threshold might be too aggressive for your normalization method. Verify that counts were CPM-normalized or modeled via `DESeq2` (which handles library size internally).
*   **Problem: "Sample batch effects masking developmental signal."**
    *   *Solution:* Ensure `animal_id` or `batch` is included in the model design formula. If variance persists, use `sva::ComBat-seq` on the pseudobulk matrix *before* running `DESeq2`.
*   **Problem: "Subclass-specific DEGs seem biologically implausible."**
    *   *Solution:* Check if cells were subsampled. If one subclass has 5,000 cells and another has 200, the DGE power will be unbalanced. Downsample the larger clusters to match the size of the smaller clusters.
*   **Problem: "Pseudoreplication warnings."**
    *   *Solution:* Do **not** use `Seurat::FindMarkers` on raw cells. Always use the `aggregateAcrossCells` approach to calculate DGE per animal; otherwise, the "significance" is technically based on cell-to-cell variance, not biological-replicate-to-biological-replicate variance.