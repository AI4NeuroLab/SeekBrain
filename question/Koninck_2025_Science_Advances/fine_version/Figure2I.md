I want to evaluate how structural graph properties (predictors) explain the variance in functional connectivity (FC) relative to the structural connectivity (SC) network itself. UseSC_matrix_directed_terminals_expanded.npy, SC_matrix_undirected_terminals_expanded.npy, and PROCESS_DATA_DIR/Figure1_FC_matrix.npy for analysis. Zebrafish brain atlas and regional information are in the atlas folder. Before data analysis, check these connectivity matrices if they contain those regions in PROCESS_DATA_DIR/Figure1_excluded_regions.npy , remove relevant columns and rows of these regions from them.
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
  3. Compute structural predictors using the directed SC information.
  4. Save SC predictor names in PROCESS_DATA_DIR/Figure2_SC_predictor_names.npy. 
3. Correlate each predictor with FC and compute explained variance
  1. Compute the Pearson correlation between each single structural predictor matrix and the FC matrix using the model method.
  2. Convert these correlations to explained variance (R²) by squaring each correlation.
  3. Save the resulting R² values to PROCESS_DATA_DIR/Figure2_SC_predictor_rsquared_single.npy.
4. Compute baseline explained variance from SC–FC correlation
  1.  Calculate the Pearson correlation between the upper triangle elements (without the diagonal) of the FC matrix and the undirected SC matrix (after removing excluded regions). 
  2. Compute the baseline explained variance (R²) by squaring the undirected SC-FCcorrelation.
  3. Save the baseline explained variance value in PROCESS_DATA_DIR/Figure2_SC_predictor_rsquared_baseline.npy.
5. Calculate the relative explained variance for each predictor by subtracting the baseline R² from the single predictor R².
Visualization specification:
1. Plot a bar chart of these relative explained variance values. Set the bar color to 'black' and bar width to 0.5.
2. Add a horizontal reference line at zero spanning the whole x-axis. Set the line color to 'black' and linewidth to 0.75.
3. Label the x‑axis with predictor names, rotating the labels vertically (90°) for readability and setting an appropriate font size.
4. Adjust the x‑axis limits to include all predictors and some padding on both sides.
5. Remove the top and right plot spines for a cleaner appearance.
6. Label the y‑axis as “△Exp. var.” to indicate change in explained variance.