I want to address how physical connectivity predicts correlated activity through the correlation analysis between the structural connectivity (SC) and the functional connectivity (FC). Use SC_matrix_undirected_terminals_expanded.npy and PROCESS_DATA_DIR/Figure1_FC_matrix.npy for analysis and visualization. Use PROCESS_DATA_DIR/Figure1_excluded_regions.npy to identify regions to exclude.
For analysis：
1. Load the undirected SC matrix and the FC matrix.
2. Remove the rows and columns corresponding to the excluded regions from the SC matrix to match the dimensions of the FC matrix.
3. Calculate the Pearson correlation coefficient between the elements of the upper triangles (excluding the diagonal) of the processed SC and FC matrices.
For visualization：
1. Normalize the SC and FC matrices separately by dividing each matrix by its Euclidean norm (L2 norm) before combining them into the composite view.
2. Construct a composite matrix where the lower triangle (excluding diagonal) displays the normalized SC and the upper triangle (excluding diagonal) displays the normalized FC. Avoid the white upper triangle in visualization.
3. Display the a composite matrix, using imshow with aspect = 'equal'. Use a blue-to-white colormap (flipping cmap = 'Blues'). Add a color bar (without ticks) on the right side of the matrix, and label it “Normalized weight”. 
4. Draw a white line (linewidth=2) along the main diagonal of the matrix.
5. Annotations
  1. Avoid texting inside the matrix itself.
  2. Show tick labels only at the 1 and last region ID along the left side of the matrix, and add the y-axis label "Brain regions".
  3. Add a text label "Functional connectivity" aligned to the right near the upper-right corner.
  4. Add a text label "Structural connectivity" aligned to the left near the lower-left corner.