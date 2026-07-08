I want to figure out whether structural properties collectively contribute to functional connectivity (FC) through the correlation analysis of the PC1 of structural predictors and the FC matrix. UseSC_matrix_directed_terminals_expanded.npy, SC_matrix_undirected_terminals_expanded.npy, and PROCESS_DATA_DIR/Figure1_FC_matrix.npy for analysis. Zebrafish brain atlas and regional information are in the atlas folder. Before data analysis, check these connectivity matrices if they contain those regions in PROCESS_DATA_DIR/Figure1_excluded_regions.npy , remove relevant columns and rows of these regions from them.
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
5. Save Results: Save the explained variance ratios of the components to PROCESS_DATA_DIR/Figure2_SC_predictor_PC1.npy.
6. Correlation analysis: Calculate the Pearson correlation between the half matrices of the structural PC1 matrix and the FC matrix after excluding specific regions. Use the upper triangles without the diagonal.
Visualization Specification:
1. Normalize the structural PC1 and FC matrices separately by dividing each matrix by its Euclidean norm (L2 norm) before combining them into the composite view.
2. Construct a composite matrix where the lower triangle (excluding diagonal) displays the normalized PC1 and the upper triangle (excluding diagonal) displays the normalized FC. Avoid the white upper triangle in visualization.
3. Display the a composite matrix, using imshow with aspect = 'equal'. Use a blue-to-white colormap (flipping cmap = 'Blues'). Add a color bar (without ticks) on the right side of the matrix, and label it “Normalized weight”. 
4. Draw a white line (linewidth=5) along the main diagonal of the matrix.
5. Annotations
  1. Avoid texting inside the matrix itself.
  2. Show tick labels only at the 1 and last region ID along the left side of the matrix, and add the y-axis label "Brain regions".
  3. Add a text label "Functional connectivity" aligned to the right near the upper-right corner.
  4. Add a text label "Structural PC1" aligned to the left near the lower-left corner.