To investigate the influence of gene expression on larval zebrafish FC, a dataset of spatially resolved gene expression markers is applied. Here, I want to visualize the regional expression level of all genes.
Visualization Specifications:
- Dataset Identification & Loading:
  - Load gene_expression.npy (variable expression) and PROCESS_DATA_DIR/Figure1_excluded_regions.npy (variable excluded).
- Data Processing:
  - Remove the regions (columns) specified in excluded from the expression data (axis 1).
  - Apply z-score normalization to the expression data along axis 0 to account for signal spatial heterogeneity (e.g., Z-axis attenuation).
- Plotting:
  - Initialize a figure with size (12, 6) and DPI 900.
  - Create a custom colormap (variable cmap2) that transitions from white ([1, 1, 1]) to black ([0, 0, 0]).
  - Generate a heatmap using the transpose of the processed expression matrix (expression.T).
  - Set the colormap to the custom white-to-black map.
  - Set the value range for the heatmap with vmin=-1 and vmax=4.
  - Set the aspect ratio to 'auto'.
  - Turn off all axis ticks and labels (axis('off')).