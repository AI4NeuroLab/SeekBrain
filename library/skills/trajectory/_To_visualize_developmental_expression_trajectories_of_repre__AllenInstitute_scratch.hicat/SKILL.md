---
name: "Developmental Expression Trajectory Visualization and Classification"
description: "Analyzes and visualizes gene expression trends across developmental time points in neural lineages, classifying markers into Up, Transient, Down, or Constant trajectory patterns."
triggers:
  - "How do I plot developmental trajectories for marker genes in mouse visual cortex?"
  - "Categorize gene expression into up-regulated or transient trends during development"
  - "Visualize lineage-specific gene dynamics using smoothed trajectory modeling"
  - "Script to classify scRNA-seq markers as constant or transient over time"
  - "Generate temporal expression heatmaps for excitatory and inhibitory cell lineages"
tags:
  - "scRNA-seq"
  - "trajectory-analysis"
  - "developmental-biology"
  - "gene-expression"
  - "temporal-dynamics"
  - "bioinformatics"
version: "1.0"
---

# Skill: Visualizing Developmental Expression Trajectories of Marker Genes

## Overview
This skill focuses on reconstructing the temporal expression dynamics of marker genes across the major lineages (Excitatory, Inhibitory, and Glial) of the mouse visual cortex during development. It leverages integrated scRNA-seq/snRNA-seq data to map continuous gene expression across the E11.5–P56 developmental window.

The implementation relies on fitting Generalized Additive Models (GAMs) to capture non-linear expression trends. By calculating the derivatives of these fitted splines, marker genes are classified into discrete regulatory categories—Up, Down, Transient Up, or Constant—providing a quantitative framework for comparing developmental programs across disparate cell types.

## Objective
To generate lineage-specific expression trajectory plots for pre-defined marker genes and classify these genes based on their temporal dynamics, ensuring the resulting visualizations align with documented developmental states.

## Background (from Paper)
### Scientific Context
Developmental transcriptomics in the mouse visual cortex reveals distinct phases of maturation. Marker genes within major lineages often exhibit non-monotonic expression changes (e.g., transient peaks) that coincide with critical periods of synaptogenesis and gliogenesis.

### Methods Description
1. **Data Normalization:** Expression matrices are normalized for batch effects, specifically correcting for the integration of embryonic (E-stage) and postnatal (P-stage) data.
2. **Trajectory Modeling:** Smooth expression trends are estimated using Generalized Additive Models (GAMs) with penalized cubic splines to account for time-dependent variance.
3. **Trend Classification:** Based on the derivative of the smoothed spline, genes are assigned to categories: *Up* (monotonic increase), *Down* (monotonic decrease), *Transient* (peak or trough within the time window), or *Constant*.

### Expected Results
The analysis yields faceted plots showing normalized expression vs. developmental time, with color-coded categories highlighting "Transient Up" genes, which typically serve as markers for developmental maturity.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context.

### Conceptual Implementation Plan
The analysis assumes the presence of a cell-metadata file containing `time_point`, `cell_type`, and `lineage` annotations, and a count matrix. 
1. **Model Fitting:** Use `mgcv::gam` in R or `statsmodels.gam` in Python to fit `expression ~ s(time_point, k=4)`. 
2. **Classification:** Define thresholding logic where the sign change of the first derivative $\frac{d}{dt}f(t)$ indicates a transient state. 
3. **Visualization:** Plot the mean expression trend per lineage, using the `ggplot2` framework to facet by lineage and color by assigned category.

### Dependencies
*   **Language:** R (v4.0+) or Python (v3.9+)
*   **Modeling:** `mgcv` (R) or `statsmodels`/`pygam` (Python)
*   **Data Handling:** `Seurat` (R) or `scanpy`/`anndata` (Python)
*   **Visualization:** `ggplot2` (R) or `matplotlib`/`seaborn` (Python)

## Structured Prompt
### Input Specification
1. Integrated expression matrix (e.g., `.rds` or `.h5ad`).
2. Metadata table with columns: `sample_id`, `time_point`, `cell_type`, `lineage`.
3. List of marker genes to analyze.

### Processing Steps
1. **Lineage Filtering:** Subset the expression matrix to isolate the Excitatory, Inhibitory, and Glial lineages.
2. **Spline Fitting:** Perform Z-score normalization of gene expression within each lineage, then fit the GAM for each marker gene across `time_point`.
3. **Dynamic Classification:** Calculate the first derivative of the spline output. Assign "Transient" if the derivative crosses zero within the range of $E11.5–P56$.
4. **Plotting:** Generate multi-faceted plots displaying the smoothed trajectory with 95% confidence intervals.

### Output Specification
*   **Classification Table:** A `.csv` file with columns: `gene_name`, `lineage`, `category`.
*   **Visualization:** A high-resolution figure (PDF/PNG) showing lineage-specific curves.

### Validation Criteria
*   Visual curves should demonstrate high goodness-of-fit ($R^2 > 0.6$).
*   Classified categories must align with the slope of the visual plots.

## File Structure

```
_To_visualize_developmental_expression_trajectories_of_repre__AllenInstitute_scratch.hicat/
    references/
        matched_files/
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
*   `fit_gam.R/py`: Contains the model fitting loop to compute spline coefficients.
*   `trend_classifier.py`: Contains logic to categorize genes based on derivatives of the fitted curve.
*   `plot_lineages.R`: Visualization routines for rendering faceted lineage plots.

## References Documentation
*   `marker_list.csv`: Maps gene symbols to their cell-type annotations.
*   `metadata.csv`: Maps individual cell barcodes to developmental time points and lineage groupings.

## Usage Example
```bash
python run_trajectory_analysis.py --matrix integrated_data.h5ad --markers marker_list.csv --output results/
```

## Notes & Caveats
*   **Scaling:** Always Z-score normalize *within* a lineage. If you normalize across all cells, high-expression glial markers will obscure dynamic trends in neuronal markers.
*   **Complexity (k):** A low `k` (e.g., $k=3$ or $4$) is recommended for developmental data to prevent overfitting noise.
*   **Missing Data:** Ensure that all developmental time points are represented in each lineage; lineages missing broad time ranges may produce unreliable spline fits.