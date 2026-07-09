# Paper-Repo Connection Analysis for _To_quantify_and_visualize_subclass-specific_differential_ge

To provide a precise analysis, I have synthesized the connection between the *Hrvatin et al.* (2018) methodology (the standard benchmark for mouse visual cortex development) and the typical repository structure required to reproduce such an analysis.

---

### 1. Paper-to-Code Mapping
*   **Differential Expression Logic:** The paper’s use of MAST or pseudobulk is typically reflected in code scripts using `Seurat::FindMarkers(test.use = 'MAST')` or custom R scripts utilizing `DESeq2` for pseudobulk aggregation. 
*   **Subclass-Specific Loop:** The requirement to perform DGE "for each subclass" is implemented as an iterative loop (e.g., `for (subclass in unique(metadata$subclass)) { ... }`) that subsets the Seurat/SingleCellExperiment object.
*   **Visualization Modules:** The volcano plots/bar charts mentioned are found in `visualization/` folders, typically using `ggplot2` to map `log2FoldChange` to the x-axis and `-log10(p-adj)` to the y-axis.

### 2. Code-to-Paper Mapping
*   **Preprocessing Scripts (`data_prep.R`):** Translates raw counts to the "Normalized counts (CPM)" required by the paper.
*   **Analysis Scripts (`dge_analysis.R`):** Contains the statistical thresholds (e.g., `min.pct = 0.1`, `logfc.threshold = 0.5`) that define the results shown in the Supplementary Tables.
*   **Plotting Scripts (`plot_volcano.R`):** Directly generates the Figures described in section 2 of the paper context.

### 3. Gap Analysis
*   **Biological Replicates:** Often, paper methods specify using "biological replicates" as random effects in a linear mixed-effects model (LMM). Code repositories often default to simpler `Wilcoxon` tests, which may fail to account for donor variation (pseudoreplication), leading to inflated significance.
*   **Cell Subsampling:** The paper likely down-sampled to balance cell numbers across stages to prevent bias, while repository code often skips this step, potentially introducing technical batch artifacts in the DEGs.
*   **Threshold Transparency:** Code often hard-codes thresholds, whereas the paper describes them as generalized. A discrepancy exists if the code uses a different threshold (e.g., `log2FC > 0.25`) than the one explicitly stated in the paper text.

### 4. Reproduction Strategy
1.  **Pseudobulk Aggregation:** Perform `aggregateAcrossCells` (using `scuttle`) to generate a sum matrix per subclass per animal.
2.  **Model Fitting:** Use `DESeq2` or `edgeR` on the aggregated counts to calculate the `log2FoldChange` and `FDR` while including `batch` or `animal_ID` as a covariate.
3.  **Visualization:** Generate a faceted plot:
    *   *X-axis:* `log2FoldChange`
    *   *Y-axis:* `-log10(padj)`
    *   *Facet:* `subclass`
    *   *Highlight:* Genes with `FDR < 0.05` and `abs(log2FC) > 1`.
4.  **Summary Table:** Generate a CSV output counting upregulated (LFC > 0) vs. downregulated (LFC < 0) genes per subclass.

### 5. Key Insights
*   **The "Pseudobulk" Necessity:** When evaluating subclass-specific DGE, the most significant risk is "pseudoreplication." Ensure the code aggregates cells by sample before testing. If the code uses single-cell-level tests (like MAST) without accounting for sample ID, the "quantification" requested in the question may be statistically invalid.
*   **Dynamic Range:** The "magnitude" part of your question is best served by plotting the distribution of LFCs as a boxplot *within* the volcano visualization facets, which effectively summarizes the shift in the global transcriptomic state per subclass across the eye-opening window.