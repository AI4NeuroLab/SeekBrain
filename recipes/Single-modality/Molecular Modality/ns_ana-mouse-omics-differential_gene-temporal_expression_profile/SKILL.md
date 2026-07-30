---
name: ns_ana-mouse-omics-differential_gene-temporal_expression_profile
description: Quantifies and visualizes differential gene expression across cortical cell subclasses between pre- and post-eye-opening developmental stages using pseudobulk statistical methods.
triggers:
- How do gene expression profiles change in cortical subclasses after eye-opening?
- Generate volcano plots for developmental DGE across cell types
- Calculate log2 fold-change for genes regulated by sensory experience
- Perform subclass-specific differential expression analysis between P7 and P14
- Summarize upregulated and downregulated genes across cortical developmental windows
tags:
- transcriptomics
- single-cell
- differential-expression
- developmental-biology
- pseudobulk
- data-visualization
version: '1.0'
---

# Subclass-Specific Differential Gene Expression Analysis for Cortical Development

This recipe provides a systematic approach to quantifying and visualizing differential gene expression (DGE) in the mouse visual cortex across pre- and post-eye-opening developmental windows (e.g., P7 vs. P14). By utilizing a pseudobulk approach—which aggregates single-cell counts by subclass and biological replicate—the analysis mitigates the risk of pseudoreplication and ensures that statistical power is robust across diverse cell types, including neurons and non-neuronal cells.

The workflow calculates log2 fold changes and adjusted p-values, then produces summary bar charts and volcano plots that expose subclass-specific developmental shifts.

## When to use this

Use this recipe to compare gene expression between developmental stages within predefined cortical subclasses using biological-replicate pseudobulk counts. Do not use it when replicate identity is missing or when individual cells would be treated as independent replicates.

## Scientific context

Developmental regulation in the visual cortex is characterized by rapid transcriptomic changes following eye opening. Understanding these changes requires comparing specific time points (P7 vs. P14) while accounting for the heterogeneity of cell subclasses (e.g., L2/3 IT, L4, Pvalb+).

## Preconditions

*   R (v4.0+)
*   `DESeq2` or `MAST` (statistical modeling)
*   `scuttle` (for `aggregateAcrossCells`)
*   `ggplot2` (visualization)
*   `tidyverse` (data manipulation)

## Inputs and outputs

1. Normalized count matrix (e.g., `data/processed/seurat_object.rds`).
2. Metadata containing `cell_id`, `cell_subclass`, `developmental_stage`, and `animal_id`.
3. Configuration file defining significance thresholds (`config/dge_params.yaml`).

*   `results/dge/deseq_results_subclass.rds`: Statistical results per gene/subclass.
*   Faceted volcano plots (PDF) showing log2FC vs. -log10(p-adj).
*   Stacked bar chart (PDF) showing total upregulated vs. downregulated genes per subclass.

## Procedure

1. **Pseudobulk Aggregation:** Convert single-cell expression matrices into sample-level pseudobulk by summing counts for each gene within each `cell_subclass` and `animal_id`.
2. **DGE Modeling:** Apply a statistical framework (MAST or DESeq2) to model the difference between developmental stages, treating `animal_id` as a covariate to account for biological replicates.
3. **Filtering:** Apply standardized thresholds, typically $|\text{log}_2\text{FC}| > 0.5$ or $1.0$ and FDR-corrected $p < 0.05$.

The analysis follows a "split-apply-combine" pattern:
1. Subsets data by `cell_subclass`.
2. Aggregates cells to the level of `animal_id` (pseudobulk) to prevent false positives from over-representing individual cells.
3. Computes fold-change and significance for each gene relative to the `developmental_stage` covariate.
4. (Assumption) Subclasses with fewer than 50 cells are excluded from the analysis to maintain statistical power.

1. Execute `src/utils/pseudobulk_helper.R` to collapse data into a pseudobulk matrix grouped by `cell_subclass` and `animal_id`.
2. Run `analysis/04_differential_expression.R` to perform the linear model fit per subclass using the aggregated pseudobulk data.
3. Filter results based on thresholds in `config/dge_params.yaml` (FDR < 0.05, |LFC| > 0.5).
4. Run `scripts/plotting/plot_volcano_summary.R` to generate faceted volcano plots and count summaries.

## Expected results

*   Identification of subclass-specific gene modules that are significantly upregulated or downregulated post-eye-opening.
*   Volcano plots showing the relationship between effect size (LFC) and significance (-log10(p-adj)) for each subclass.
*   Summary tables/bar charts displaying the counts of DEGs per subclass.

*   Check that the total number of cells per subclass/sample is > 50.
*   Verify that `animal_id` was included in the design formula to avoid pseudoreplication.

## Pitfalls

*   **Pseudoreplication:** Never use raw single-cell level data directly for DGE if replicates exist; always aggregate by sample.
*   **Thresholding:** The $|\text{log}_2\text{FC}| > 0.5$ threshold is a recommendation; verify it matches the study-specific requirements.
*   **Balance:** If one cell type is significantly larger than others, downsampling is required to prevent bias in the DGE analysis.

## Bundled files

- `scripts/run_analysis.py`: Run the analysis workflow.
- `scripts/utils.py`: Shared analysis utilities.

## Usage

```bash
# Run pseudobulk aggregation and DGE analysis
Rscript analysis/04_differential_expression.R --config config/dge_params.yaml

# Generate the visualization
Rscript scripts/plotting/plot_volcano_summary.R --input results/dge/deseq_results_subclass.rds
```
