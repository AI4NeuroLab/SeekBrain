I want to figure out whether structural properties collectively contribute to functional connectivity (FC) by analyzing their accumulative explained variance. UseSC_matrix_directed_terminals_expanded.npy, SC_matrix_undirected_terminals_expanded.npy, and PROCESS_DATA_DIR/Figure1_FC_matrix.npy for analysis. Zebrafish brain atlas and regional information are in the atlas folder. Before data analysis, check these connectivity matrices if they contain those regions in PROCESS_DATA_DIR/Figure1_excluded_regions.npy , remove relevant columns and rows of these regions from them.

Analysis pipeline:
1. Load data and preprocessing
  - Load the FC matrix from PROCESS_DATA_DIR/Figure1_FC_matrix.npy.
  - Load the directed SC matrix from SC_matrix_directed_terminals_expanded.npy.
  - Load the undirected SC matrix from SC_matrix_undirected_terminals_expanded.npy.
  - Load the zebrafish brain atlas through MapzebrainAtlas and compute inter-regional distances.
  - Load the excluded regions index array from PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  - Remove excluded regions from connectivity matrices and centroids.
2. Compute structural predictors from SC
  1. From zebrafish_Ca_utils_predictors_xps import *. ** Force using this**
  2. Instantiate the predictor model using the directed and undirected SC matrices and the inter-regional distances, passing the excluded regions if not excluded. Use the class Predictors.
3. Inter-predictor Correlations: Calculate the correlations between predictors. Compute and print the mean and standard deviation of these inter-predictor correlations.
4. PCA Analysis: Extract the first 10 principal components (PCs) of the predictors using sklearn.decomposition.PCA.
5. Save Results: Save the explained variance ratios of the components to PROCESS_DATA_DIR/Figure2_SC_predictor_PCA_expvar.npy.

Visualization Specification:
1. Set figsize=(5, 4).
2. Plot the relative explained variance (per‑component ratio) of the first 10 PCs as a medium violet‑red line with point markers, with the x‑axis showing PC index (1 and 10).
3. Plot the cumulative explained variance of the first 10 PCs as a black line with point markers on the same axes.
4. Explicitly annotate the explained variance of PC1 by adding a text label near the first point of the relative explained variance curve, indicating its numerical value.
5. Add the label “Ratio” near the upper‑right part of the relative explained variance curve to indicate that this curve represents the per‑component explained variance ratio.
6. Add the label “Cumulative” near the lower‑right part of the cumulative explained variance curve to indicate that this curve represents cumulative explained variance.
7. Label the x‑axis as “Principal component #”.
8. Label the y‑axis as “Explained variance”.
9. Set the y-axis range to [-0.05 1.05].
10. Remove the top and right plot spines for a cleaner appearance.