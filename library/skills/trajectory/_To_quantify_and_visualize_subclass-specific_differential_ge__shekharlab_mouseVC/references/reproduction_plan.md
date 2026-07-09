# Reproduction Plan for _To_quantify_and_visualize_subclass-specific_differential_ge

To quantify and visualize subclass-specific differential gene expression (DGE) changes across pre- and post-eye-opening windows, follow this standardized reproduction plan.

---

### Prerequisites
*   **Data Objects:** An `AnnData` object containing integrated glutamatergic cortical cell atlas data.
*   **Environment:** Python environment with `scanpy`, `pandas`, `numpy`, `matplotlib`, and `seaborn`.
*   **Metadata:** `adata.obs` must contain a `Subclass` column and a `Developmental_Stage` column (coded as 'Pre' for P7-P10 and 'Post' for P14+).

---

### Step-by-Step Procedure

| Step | Action | Paper Ref | Code Ref | Input | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Filter & Annotate** | Methods: Temporal Partitioning | `Harmonized_gluta.ipynb` | `adata` | `subset=True` | Ensure all cells have 'Pre' or 'Post' labels |
| **2** | **Iterative DGE** | Methods: GLM/Wilcoxon | `CollectiveAnalyses.ipynb` | `adata` | `groupby='Developmental_Stage'` | Loop over unique `Subclass` categories |
| **3** | **Magnitude Extraction** | Results: DGE Tables | `DE()` function logic | `rank_genes_groups` | `log2FC` threshold | Store results in list of DataFrames |
| **4** | **Summary Stats** | Results: Summary Table | Custom Logic | `deg_results_df` | `FDR < 0.05`, `|log2FC| > 0.5` | Count up/down genes per subclass |
| **5** | **Visualization** | Figures: Volcano/Bar | `sc.pl.dotplot` (Adapt) | DGE DataFrames | `palette`, `figsize` | Plot volcano plots per subclass |

#### Execution Details
1.  **Metadata Preparation:** Add a binary column to `adata.obs`. 
    *   *Code:* `adata.obs['EO_Window'] = adata.obs['Age'].apply(lambda x: 'Pre' if x <= 10 else 'Post')`.
2.  **Differential Testing:** Perform testing within each subclass.
    *   *Code:* Iterate `for sc in adata.obs['Subclass'].unique():` subset `adata`, `sc.tl.rank_genes_groups(..., groupby='EO_Window', reference='Pre')`.
3.  **Thresholding:** Extract results.
    *   *Code:* Use `sc.get.rank_genes_groups_df(adata, group='Post')`. Filter by `pvals_adj < 0.05`.
4.  **Visualization:** Use a stacked bar chart to display counts of up/downregulated genes per subclass.

---

### Expected Output
1.  **Summary Table:** A `CSV` file containing columns: `Subclass`, `Upregulated_Count`, `Downregulated_Count`, `Total_DEGs`.
2.  **Volcano Plot Panel:** A grid of plots (one per subclass) where:
    *   **X-axis:** `log2FoldChange`
    *   **Y-axis:** `-log10(p-value_adjusted)`
    *   **Color:** Highlight genes passing `|log2FC| > 0.5`.
3.  **Global Dotplot:** A summary visualization showing the top 5 upregulated and top 5 downregulated genes for each subclass across the EO window.

---

### Troubleshooting
*   **Issue: Empty Results.** 
    *   *Cause:* Cell counts in specific subclasses might be too low at early time points (P8). 
    *   *Fix:* Implement a minimum cell threshold per subclass (`if count > 50`) before running `rank_genes_groups`.
*   **Issue: Batch Effects.** 
    *   *Cause:* Different ages might have been sequenced at different times. 
    *   *Fix:* Ensure `adata` is integrated (e.g., via `scVI` or `Harmony`) prior to DGE, or include `Batch` as a covariate if using `DESeq2` (pseudo-bulk).
*   **Issue: Computational Overhead.**
    *   *Cause:* Running Wilcoxon on the entire matrix.
    *   *Fix:* Run on `raw` layer or use `sc.pp.subsample` to normalize cell counts per subclass before testing to maintain balance.