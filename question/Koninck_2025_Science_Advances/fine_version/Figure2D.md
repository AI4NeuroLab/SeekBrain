I want to quantify how the existence and directionality of structural connections affect functional connectivity (FC) values by comparing the FC values among different structural connection categories. Use SC_matrix_directed_terminals_expanded.npy and PROCESS_DATA_DIR/Figure1_FC_matrices.npy for analysis. Zebrafish atlas and regional information are in the atlas folder. Before data analysis, check these connectivity network matrices if they contain those regions inPROCESS_DATA_DIR/Figure1_excluded_regions.npy, remove relevant columns and rows of these regions from them first.
For analysis:
1. Data Loading and Preprocessing:
  1. Load the directed structural connectivity (SC) matrix from SC_matrix_directed_terminals_expanded.npy.
  2. Load the excluded regions list from PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  3. Remove the rows and columns corresponding to the excluded regions from the directed SC matrix.
  4. Load the FC matrices from PROCESS_DATA_DIR/Figure1_FC_matrices.npy.
2. Structural Connection Categorization
  1. Binarize the processed directed SC matrix (set values > 0 to 1, others to 0).
  2. Calculate the connection category matrix by adding the binary matrix to its transpose, yielding in three categories for each node pair. 0, unconnected (no SC between regions); 1, unidirectional (only one direction present); 2, bidirectional (both directions present).
  3. Save this matrix to PROCESS_DATA_DIR/Figure2_number_of_connections.npy.
3. Functional Connectivity Distribution Analysis
  1. Define the upper triangle indices (without the diagonal) for the node pairs.
  2. Iterate through each individual FC network in FC matrices.
  3. Extract FC values corresponding to the three structural categories defined by the connection category matrix (using the same upper triangle indices).
  4. Accumulate the values into three separate arrays. 
  5. Flatten each array and remove any zero values.
  6. Save the FC values for each category toFigure2_Directionality_Corr_Bidirection.npy, Figure2_Directionality_Corr_Unidirection.npy, and Figure2_Directionality_Corr_Unconnect.npy in PROCESS_DATA_DIR, separately.
4. Perform a one-way ANOVA test among the three categories, and report the F and P values.
For visualization:
1. Arrange the figure so that the matrix plot is placed on the top and the density distribution plot is placed below it, aligned vertically.
2. Top Panel: Structural Connection Matrix
  - Load the connection category matrix.
  - Mask the upper triangle of the matrix (including the diagonal) so that only the lower triangle is visible.
  - Display the masked matrix using imshow with cmap='gray'. This will map the values as follows: 0 (Unconnected), Black; 1 (Unidirectional), Gray; 2 (Bidirectional), White.
  - In the upper-right area of the matrix (outside the lower triangle), add a legend indicating the three connection types, using the colors applied above.
  - Hide the top and right spines. Remove all x and y ticks and labels.
3. Bottom Panel: FC Density Distributions
  - Load the FC values for each category.
  - Plot a smoothed histogram (using Gaussian filtering with sigma=20 on interpolated data) for each category: Unconnected, Black ; Unidirectional, Gray; Bidirectional, White.
  - Axis Styling: Hide top and right spines. Set the x-axis label to “Edge strength (FC)”. Set the y-axis label to “Density”.
  - Indicate the result of the one-way ANOVA test among curve peaks using horizontal bars and asterisks to mark p-values. *P < 0.05; **P < 0.01; ***P < 0.001; ****P < 0.0001.