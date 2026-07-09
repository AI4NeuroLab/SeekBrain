---
name: "Subclass-Specific Differential Gene Expression Analysis"
description: "Quantifies and visualizes differential gene expression across cortical cell subclasses between defined developmental windows using Seurat-based statistical pipelines."
triggers:
  - "How do I calculate differentially expressed genes between P7-P10 and P11-P15?"
  - "Compare gene expression changes for specific cortical cell subclasses."
  - "Generate a volcano plot for developmental gene shifts in mouse visual cortex."
  - "Perform subclass-specific differential expression analysis across developmental stages."
  - "Quantify upregulated and downregulated genes in cortical cell types."
tags:
  - "scRNA-seq"
  - "differential expression"
  - "mouse visual cortex"
  - "developmental biology"
  - "Seurat"
version: "1.0"
---

# Skill: Quantification and Visualization of Subclass-Specific Differential Gene Expression in Developing Cortex

## Overview
This skill provides a structured methodology to quantify and visualize temporal changes in gene expression across cortical cell subclasses during postnatal development (P7–P10 vs. P11–P15). The analysis focuses on identifying differentially expressed genes (DEGs) within specific cell populations to capture maturation-related transcriptomic shifts.

While the current repository focuses on spatial HDF5 imaging processing (Stalefish), this skill bridges the gap by outlining a transcriptomic pipeline using standard single-cell bioinformatics frameworks (Seurat/Scanpy) required to replicate developmental atlas studies like Hrvatin et al. (2018).

## Objective
To generate a statistical summary of upregulated and downregulated genes and produce volcano plots that characterize the magnitude (log2 fold-change) and significance (adjusted p-value) of expression shifts for each cortical cell subclass between two defined developmental windows.

## Background (from Paper)
### Scientific Context
The transition from P7–P10 to P11–P15 marks a critical period of synaptic refinement and cellular maturation in the mouse visual cortex. Gene expression changes during this window are subclass-specific, reflecting the distinct developmental trajectories of excitatory (e.g., L2/3 IT) and inhibitory (e.g., Pvalb, Vip) neurons.

### Methods Description
1.  **Normalization:** Account for technical variation by applying log-normalization or SCTransform to the raw count matrix.
2.  **Partitioning:** Group cells by `subclass` and then by `age_bin` (P7–P10 vs. P11–P15).
3.  **Statistical Testing:** Use the Wilcoxon Rank Sum test to compare gene expression distributions between age bins within each subclass.
4.  **Correction:** Apply the Benjamini-Hochberg (FDR) procedure to adjust p-values for multiple hypothesis testing.

### Expected Results
*   Identification of stage-specific marker genes or maturation-related genes.
*   Summary tables detailing the count and magnitude of significant DEGs (log2FC > 0.5, adj. p < 0.05).
*   Facetted volcano plots illustrating the expression landscape for each subclass.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context for single-cell transcriptomic differential expression. The existing repository is specialized for spatial image processing and does not contain scRNA-seq objects or DGE testing functions.

### Conceptual Implementation Plan
*Assumption: You possess a normalized scRNA-seq object in Seurat (R) or Scanpy (Python) format.*
1.  Partition the object by subclass using metadata annotations.
2.  Perform pairwise comparisons (`FindMarkers` in R or `rank_genes_groups` in Python) between the P7–P10 and P11–P15 groups for each subset.
3.  Filter results using the strict criteria (FDR < 0.05, |log2FC| > 0.5).
4.  Aggregate counts of significantly up- and downregulated genes to create a summary bar plot.

### Dependencies
*   **R:** `Seurat`, `ggplot2`, `dplyr`, `ComplexHeatmap`
*   **Python:** `scanpy`, `pandas`, `seaborn`, `matplotlib`

## Structured Prompt
### Input Specification
1.  **Raw/Normalized Count Matrix:** Gene-by-cell matrix (e.g., `.h5ad` or `RDS`).
2.  **Metadata:** CSV file with columns: `cell_barcode`, `subclass`, and `age_bin` (P7-P10, P11-P15).

### Processing Steps
1.  **Object Loading:** Import data and verify subclass labels match the expected reference nomenclature.
2.  **Subclass Iteration:** Loop through each unique subclass identifier present in the metadata.
3.  **DGE Analysis:** Run the differential expression test using the `age_bin` as the grouping factor. 
4.  **Thresholding:** Apply a boolean mask to the result dataframe to filter by `abs(log2FC) > 0.5` and `p_val_adj < 0.05`.
5.  **Visualization:** Generate a volcano plot (x = log2FC, y = -log10(p_val_adj)) for each subclass loop.

### Output Specification
*   **`DE_results.csv`:** Master table containing all gene statistics per subclass.
*   **`Volcano_Plots.pdf`:** Facetted figure displaying subclass-specific expression shifts.
*   **`DE_Summary_Stats.csv`:** Count of up/down genes per subclass.

### Validation Criteria
*   Ensure the number of genes identified as DE is proportional to the sequencing depth and cell count of the subclass.
*   Check that the log2FC distribution is centered at zero, indicating non-biased normalization.

## File Structure

```
_To_quantify_and_visualize_subclass-specific_differential_ge__ABRG-Models_Stalefish/
    references/
        matched_files/
            Stalefish_Analysis_Correlations_3.5.21.ipynb
            Stalefish_Analysis_Single_Brain.ipynb
            Stalefish_Combined_Cases_CONTROL.ipynb
            Stalefish_Combined_Cases_P4ENUC_all.ipynb
            allen_plotcolors.py
            allen_retrieve.py
            allen_sebcolour.py
            allen_template_mouse_brain_retrieve_template.py
            misc_paper_figures_Fig_depth_Fig_depth.py
            misc_paper_figures_Fig_depth_sebcolour.py
            misc_plot_contours.py
            reading_python_Fig_depth.py
            reading_python_depth_plots.py
            reading_python_plot_one.py
            reading_python_plot_triplechannel.py
            reading_python_read_example.py
            reading_python_showmap.py
            reading_python_showmap_contours.py
        connection_analysis.md
        paper_context.md
        paper_figure_methods.md
        paper_structured_summary.md
        question.md
        repo_context.md
        repo_file_summaries.md
        repo_overview.md
        reproduction_plan.md
    scripts/
        run_analysis.py
        utils.py
```

## Scripts Documentation
*   **`allen/retrieve.py`**: Used only for fetching metadata, not for DGE.
*   **`Stalefish_Analysis_Single_Brain.ipynb`**: Provides template for modular data processing, though not directly applicable to DGE logic.

## References Documentation
*   **Hrvatin et al., 2018**: Primary reference for defining cortical cell subclasses and the developmental windows specified.

## Usage Example
```r
# Conceptual R example for one subclass
subclass_data <- subset(seurat_obj, idents = "L2/3 IT")
de_results <- FindMarkers(subclass_data, group.by = "age_bin", ident.1 = "P11-P15", ident.2 = "P7-P10")
write.csv(de_results, "L23_IT_DEGs.csv")
```

## Notes & Caveats
*   **Batch Effects:** If samples were collected at different times, use `latent.vars` to include batch as a covariate.
*   **Data Structure:** The provided spatial codebase is incompatible with scRNA-seq objects; do not attempt to import HDF5 spatial files as Seurat objects without prior conversion.
*   **Thresholding:** Adjust log2FC cutoffs based on the sensitivity of the sequencing platform; 0.5 is standard, but higher thresholds may be required for noisier datasets.