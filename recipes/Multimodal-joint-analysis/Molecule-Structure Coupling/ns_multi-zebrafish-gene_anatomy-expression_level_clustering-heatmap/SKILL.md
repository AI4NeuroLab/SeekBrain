---
name: "ns_multi-zebrafish-gene_anatomy-expression_level_clustering-heatmap"
description: "This recipe generates a heatmap visualization of spatially resolved gene expression markers across brain regions in larval zebrafish. It loads a pre-computed gene expression matrix, excludes specified brain regions, normalizes expression values via z-scoring across genes per region, and produces a publication-quality heatmap. The white-to-black color gradient highlights genes that are highly and specifically expressed in particular brain regions, enabling researchers to identify spatial expression patterns relevant to functional connectivity studies."
triggers:
- "Analyze zebrafish gene expression heatmap"
- "Generate zebrafish gene expression heatmap outputs"
- "Apply the ns_multi-zebrafish-gene_anatomy-expression_level_clustering-heatmap recipe"
tags:
- "zebrafish"
- "gene"
- "anatomy"
- "expression"
- "level"
version: "1.0"
---

# Zebrafish Gene Expression Heatmap

This recipe generates a heatmap visualization of spatially resolved gene expression markers across brain regions in larval zebrafish. It loads a pre-computed gene expression matrix, excludes specified brain regions, normalizes expression values via z-scoring across genes per region, and produces a publication-quality heatmap. The white-to-black color gradient highlights genes that are highly and specifically expressed in particular brain regions, enabling researchers to identify spatial expression patterns relevant to functional connectivity studies.

## When to use this

Use this recipe to compare standardized regional expression profiles across genes and reveal groups of regions with similar patterns in a clustered heatmap. Do not use it when raw expression magnitude, rather than relative within-gene pattern, is the quantity of interest.

## Scientific context

Derived from a larval zebrafish functional connectivity and gene expression analysis pipeline investigating the influence of spatially resolved gene expression on brain-wide functional connectivity patterns.

## Preconditions

- `numpy` — array loading and manipulation
- `scipy.stats.zscore` — z-score normalization
- `matplotlib.pyplot` — heatmap plotting and figure generation
- `json` — saving statistics output
- Zebrafish calcium imaging utility modules (optional, from shared toolkit)

## Inputs and outputs

- **gene_expression.npy**: A 2D NumPy array of shape `(n_genes, n_regions)` containing regional expression levels for all genes.
- **Figure1_excluded_regions.npy**: A 1D NumPy array of integer indices specifying brain regions to exclude from the visualization (e.g., regions with unreliable data or outside the area of interest).

- **Heatmap figure** (PNG, 300 DPI): A wide-format (18×3 inches) heatmap showing z-scored gene expression with brain regions on the Y-axis and genes on the X-axis. Uses a `gray_r` (white-to-black) colormap with color range [-1, 4]. Includes a vertical colorbar labeled "Expression (z-scored)" and minimal axis annotations (only start/end IDs).
- **statistics.json**: A JSON file containing key metadata including the number of genes, original and kept region counts, excluded region IDs, per-gene mean and standard deviation of raw expression, and overall mean/std of the normalized expression matrix.

## Procedure

1. **Load data**: Read the gene expression matrix `(n_genes, n_regions)` from `gene_expression.npy` and the excluded region indices from `Figure1_excluded_regions.npy`.
2. **Remove excluded regions**: Create a boolean mask over all region indices, setting excluded region indices to `False`. Filter columns of the expression matrix to retain only non-excluded regions.
3. **Z-score normalization**: Apply z-score normalization along axis 0 (across genes) independently for each remaining region (column). This accounts for spatial heterogeneity in signal intensity across brain regions. Replace any resulting NaN values (from zero-variance regions) with 0.
4. **Transpose**: Transpose the normalized matrix from `(n_genes, n_regions_kept)` to `(n_regions_kept, n_genes)` for heatmap display with regions on the Y-axis and genes on the X-axis.
5. **Plot heatmap**: Use `matplotlib.pyplot.imshow` with `aspect='auto'`, `cmap='gray_r'`, `vmin=-1`, `vmax=4`. Add a vertical colorbar labeled "Expression (z-scored)".
6. **Style axes**: Label X-axis as "Genes" and Y-axis as "Brain regions". Show only start (1) and end tick labels. Remove tick marks and axis spines for a clean appearance.
7. **Save outputs**: Export the figure as a high-resolution PNG and save computed statistics as JSON.

## Key parameters

| Parameter | Value | Description |
|---|---|---|
| Figure size | `(18, 3)` | Wide-format figure dimensions in inches |
| Aspect ratio | `'auto'` | Stretch image to fill axes |
| Colormap | `'gray_r'` | White-to-black gradient (flipped gray) |
| Color range (vmin, vmax) | `(-1, 4)` | Clips z-scored expression for contrast |
| Z-score axis | `axis=0` | Normalize across genes within each region |
| NaN handling | Replace with `0.0` | For regions with zero standard deviation |
| DPI | `300` | Output image resolution |
| Colorbar orientation | `'vertical'` | Placed alongside the heatmap |

## Pitfalls

- The z-score normalization assumes gene expression values follow an approximately normal distribution per region; highly skewed distributions may produce misleading z-scores.
- Regions with zero variance across all genes will produce NaN z-scores, which are replaced with 0 — these regions carry no information in the visualization.
- The fixed color range [-1, 4] is optimized for this specific dataset; other datasets may require adjustment to avoid clipping or loss of contrast.
- Gene and region ordering is inherited from the input file and is not sorted or clustered — applying hierarchical clustering before visualization could reveal additional structure.
- The visualization does not display individual gene or region names; only numeric start/end IDs are shown.

## Usage

```bash
python scripts/main.py
```
