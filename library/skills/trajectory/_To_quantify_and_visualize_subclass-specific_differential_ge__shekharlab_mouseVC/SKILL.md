---
name: "Subclass-Specific Temporal Differential Gene Expression Analysis"
description: "Quantifies and visualizes gene expression shifts across cortical cell subclasses between pre- and post-eye-opening developmental windows."
triggers:
  - "How do gene expression profiles change in cortical subclasses after eye opening?"
  - "Compare pre vs post eye opening differential gene expression for cell types"
  - "Generate a volcano plot for developmental transcriptomic changes by subclass"
  - "Quantify upregulated and downregulated genes across developmental windows"
  - "Analyze subclass-specific transcriptional trajectories relative to eye-opening"
tags:
  - "transcriptomics"
  - "scRNA-seq"
  - "developmental-neuroscience"
  - "differential-expression"
  - "cortical-atlas"
  - "temporal-dynamics"
version: "1.0"
---

# Skill: Subclass-Specific Differential Gene Expression Analysis Across Developmental Windows

## Overview
This skill focuses on quantifying and visualizing transcriptional shifts in cortical cell subclasses during the critical transition from pre-eye-opening (P7–P10) to post-eye-opening (P14+) developmental stages. By performing pairwise differential gene expression (DGE) tests within each cortical subclass, this approach ensures that observed developmental markers are not confounded by shifts in cell-type composition.

The methodology integrates a longitudinal scRNA-seq atlas by utilizing the statistical infrastructure of the `scanpy` ecosystem. The analysis converts temporal metadata into a binary categorical variable to perform subclass-specific comparisons, resulting in a robust quantification of up- and downregulated gene magnitude and significance.

## Objective
To quantify the magnitude (log2 fold-change) and count of significantly differentially expressed genes (FDR < 0.05, |log2FC| > threshold) per cortical cell subclass to characterize the transcriptional response to the onset of sensory experience.

## Background (from Paper)
### Scientific Context
The transition of cortical development across eye-opening involves large-scale transcriptional remodeling. Excitatory neuron populations, specifically L2/3 IT and L5 ET, often display broader transcriptional shifts compared to inhibitory populations when transitioning from P8 to P14+.

### Methods Description
1. **Temporal Partitioning:** Define distinct developmental windows (Pre: P7–P10; Post: P14+) as a binary variable within the `adata.obs` metadata.
2. **Subclass-Specific Testing:** Perform pairwise DGE tests (Wilcoxon rank-sum or GLM) independently for each annotated subclass to maintain biological granularity.
3. **Statistical Thresholding:** Apply stringent filtering criteria, typically |log2FC| > 1 and FDR < 0.01, to define high-confidence temporal markers.
4. **Aggregation:** Summarize the number of up/downregulated genes per subclass to compare transcriptional dynamism across cell types.

### Expected Results
* **Volcano Plots:** Visual representation of DEGs per subclass showing the skew toward upregulation or downregulation.
* **Summary Bar Charts:** Quantification of the number of significant DEGs per subclass, illustrating which neuronal populations are most affected by eye-opening.
* **Heatmaps:** Hierarchical clustering of the top magnitude DEGs across subclasses.

## Implementation Guidance
### Verified Repository Components
* `2-GlutamatergicAtlas/CollectiveAnalyses.ipynb`: Contains the core `DE()` function logic.
* `2-GlutamatergicAtlas/Harmonized_gluta.ipynb`: Manages integration of P8–P38 time points.
* `2-GlutamatergicAtlas/Initialization/PXX_glut.ipynb`: Required for loading time-point specific `AnnData` objects.

### Conceptual Implementation Plan
The analysis assumes the presence of a harmonized `AnnData` object containing both `Age` and `Subclass` metadata. The implementation requires the creation of a 'DevelopmentalWindow' column, followed by an iterative loop that subsets the `adata` object by subclass, performs a Wilcoxon rank-sum test using `sc.tl.rank_genes_groups`, and aggregates the result summaries into a plotting-ready format. (Assumption: The `DE()` function in the repo must be adapted to return quantitative DataFrames instead of just visualizing via dotplots).

### Dependencies
* `scanpy`, `pandas`, `numpy`, `matplotlib`, `seaborn`

## Structured Prompt
### Input Specification
1. A harmonized `AnnData` object (`.h5ad`) containing integrated glutamatergic cortical data.
2. Metadata columns: `Age` (continuous or categorical) and `Subclass` (or `Type`).

### Processing Steps
1. **Prepare Metadata:** Create a binary `DevelopmentalWindow` column where ages $\le$ 10 are 'Pre' and ages $\ge$ 14 are 'Post'.
2. **Iterate:** For each unique `Subclass` in `adata.obs['Subclass']`:
   - Subset `adata` to current subclass.
   - Run `sc.tl.rank_genes_groups(adata, groupby='DevelopmentalWindow', reference='Pre', method='wilcoxon')`.
   - Extract results using `sc.get.rank_genes_groups_df`.
3. **Filter:** Apply `pvals_adj < 0.05` and `abs(logfoldchanges) > 0.5` (or 1.0) thresholds.
4. **Aggregate:** Count genes where `logfoldchanges > 0` (Up) and `< 0` (Down).
5. **Visualize:** Plot counts as a stacked bar chart and generate volcano plots for each subset.

### Output Specification
1. `CSV` file of all DEGs per subclass including `gene`, `log2FC`, `pvals_adj`.
2. `CSV` summary table of counts (Subclass, Upregulated, Downregulated, Total).
3. A panel of volcano plots (one per subclass).

### Validation Criteria
1. Subclass specificity: Do the results match the unique marker expectations for specific classes?
2. Threshold consistency: Are criteria applied identically across all subclasses?

## File Structure

```
_To_quantify_and_visualize_subclass-specific_differential_ge__shekharlab_mouseVC/
    references/
        matched_files/
            2-GlutamatergicAtlas_CollectiveAnalyses.ipynb
            2-GlutamatergicAtlas_Harmonized_gluta.ipynb
            2-GlutamatergicAtlas_Initialization_P14_glut.ipynb
            2-GlutamatergicAtlas_Initialization_P17_glut.ipynb
            2-GlutamatergicAtlas_Initialization_P21_glut.ipynb
            2-GlutamatergicAtlas_Initialization_P28_glut.ipynb
            2-GlutamatergicAtlas_Initialization_P38_glut.ipynb
            2-GlutamatergicAtlas_Initialization_P8_glut.ipynb
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
* `CollectiveAnalyses.ipynb`: Contains the `DE()` wrapper; used as a template for iterative testing.
* `Harmonized_gluta.ipynb`: Provides the workflow for batch-corrected `adata` objects.

## References Documentation
* Individual PXX_glut.ipynb files: Provide the raw age-specific metadata and expression matrices required for assembly.

## Usage Example
```python
# Create the temporal partition
adata.obs['DevelopmentalWindow'] = ['Pre' if x <= 10 else 'Post' for x in adata.obs['Age']]

# Execute iterative testing
for subclass in adata.obs['Subclass'].unique():
    sub_adata = adata[adata.obs['Subclass'] == subclass]
    sc.tl.rank_genes_groups(sub_adata, groupby='DevelopmentalWindow', reference='Pre')
    # Extract, filter, and save results
```

## Notes & Caveats
* **Pseudoreplication:** For rigorous developmental analysis, ensure that `AnnData` objects are pseudo-bulked (summed by donor/replicate) if samples represent individual animals.
* **Low Cell Counts:** Some subclasses may have insufficient cell counts at P8; enforce a minimum count (e.g., > 30 cells) per condition per subclass.
* **Batch Effects:** Ensure the `adata` object is batch-corrected for 'Age' or 'Batch' if these variables correlate with developmental stage.