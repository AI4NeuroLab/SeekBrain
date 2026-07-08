To investigate the influence of gene expression on larval zebrafish FC, a dataset of spatially resolved gene expression markers is applied. Here, I want to visualize the regional expression level of five example genes in space.
Visualization Specifications:
1. Data Processing:
  - Load gene_expression.npy. Load PROCESS_DATA_DIR/Figure1_excluded_regions.npy as the exclusion mask.
  - Filter the expression matrix by removing columns corresponding to the excluded regions.
  - Normalize the expression matrix using Z-score standardization along the gene axis (axis 0).
  - Generate the gene name list in /mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data/HCRtiff, and save the name list in PROCESS_DATA_DIR/Figure7_gene_names.npy.
  - Load the gene name list from PROCESS_DATA_DIR/Figure7_gene_names.npy. Locate the indices for the five example genes: 'tbr1b', 'lhx9', 'zic1', 'otpa', 'nefma'.
2. Atlas & Centroids Preparation:
  - Initialize the MapzebrainAtlas.
  - Construct the plotting centroids: Concatenate left and right region centroids.
  - Invert the Y-axis coordinates (y = 974 - y).
  - Remove centroids corresponding to the excluded regions (ensure indices align with the filtered expression matrix).
3. Image Generation (Raw Projection):
  - For each of the 5 genes, identify the corresponding raw image file in the HCRtiff folder.
  - Load the stack and compute the Top Projection: Calculate the 95th percentile along the Z-axis (optionally downsampling Z-slices by 2).
  - Create a composite image for each gene:
    - Background: Atlas XY projection (Color: Dark Gray [0.25, 0.25, 0.25]).
    - Foreground: Gene Top Projection (Color: Cyan [72/255, 184/255, 208/255]).
4. Plotting:
  - Generate a figure with 5 pairs of axes (one pair per gene).
  - Left Panel (Raw Expression):
    - Display the composite image (Atlas + Gene Projection).
    - Set view limits: X [65, 505], Y [850, 50].
  - Right Panel (Regional Quantification):
    - Create a scatter plot using the prepared centroids.
    - Map the marker color (c) to the Z-scored expression values of the specific gene.
    - Use a custom colormap transitioning from White to Cyan.
    - Marker style: Size (s) = 5, Edge color = 'black', Line width = 0.25.
    - Set view limits: X [65, 505], Y [850, 50].