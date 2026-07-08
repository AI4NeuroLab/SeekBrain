 I want to figure out whether structural properties collectively contribute to functional connectivity (FC) through the correlation analysis of the PC1 of structural predictors and the FC matrix. Use PROCESS_DATA_DIR/Figure1_FC_matrix.npy and PROCESS_DATA_DIR/Figure2_SC_predictor_PC1.npy for analysis and visualization. Before data analysis, check these connectivity matrices if they contain those regions in the Figure1_excluded_regions.npy in PROCESS_DATA_DIR, remove relevant columns and rows of these regions from them.

Analysis pipeline:
1. Load data and preprocessing
  - Load the FC matrix from PROCESS_DATA_DIR/Figure1_FC_matrix.npy.
  - Load the PC1 matrix from PROCESS_DATA_DIR/Figure2_SC_predictor_PC1.npy.
  - Load the excluded regions index array from PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  - Remove excluded regions from connectivity matrices if not excluded.
2. Calculate the Pearson correlation between the half matrices of the structural PC1 and the FC without excluded regions. Use the upper triangles without the diagonal.
3. Fit a linear regression (first‑order polynomial) between the structural PC1 and FC. Use the upper triangles without the diagonal.

For visualization:
1. Plot a scatter plot with the upper-triangle PC1 matrix on the x‑axis and the upper-triangle FC matrix on the y‑axis, representing each brain region as a transparent black point.
2. Plot the best‑fit line in medium violet‑red on the scatter plot.
3. Simplify the plot appearance by removing the top and right spines, and label the axes as “Structural PC1” (x‑axis) and “FC” (y‑axis).
4. Text Pearson r in medium violet‑red in the upper‑left corner of the plot.