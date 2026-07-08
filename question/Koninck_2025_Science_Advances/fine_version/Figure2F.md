I want to address how physical connectivity predicts correlated activity by the correlation analysis between the node degrees of the structural connectivity (SC) and functional connectivity (FC) networks spatially. Use SC_matrix_undirected_terminals_expanded.npyand PROCESS_DATA_DIR/Figure1_FC_matrix.npy for analysis and visualization. Zebrafish brain atlas and regional information are in the atlas folder. Before data analysis, check these connectivity matrices if they contain those regions in the PROCESS_DATA_DIR/Figure1_excluded_regions.npy, remove relevant columns and rows of these regions from them.
Analysis Pipeline:
1. Data Loading & preprocess
  - Load the SC matrix: SC_matrix_undirected_terminals_expanded.npy.
  - Load the FC matrix: PROCESS_DATA_DIR/Figure1_FC_matrix.npy.
  - Load the ID list of excluded regions: PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  - Check the SC and FC matrices if they contain those regions in the PROCESS_DATA_DIR/Figure1_excluded_regions.npy, remove relevant columns and rows of these regions from them.
2. Compute the weighted SC degree for each node by summing the edge weights of its corresponding row in the processed SC matrix. Save the resulting SC degree vector as PROCESS_DATA_DIR/Figure2_Node_degree_SC.npy.
3. Compute the weighted FC degree for each node by summing the rows of the processed FC matrix. Save the resulting degree vector as PROCESS_DATA_DIR/Figure2_Node_degree_FC.npy.
4. Compute the Pearson correlation coefficient (r) between the weighted SC and FC node degree vectors.
5. Fit a linear regression (first‑order polynomial) between weighted SC and FC node degrees.
For visualization:
1. Plot a scatter plot with structural weighted degree on the x‑axis and functional weighted degree on the y‑axis, representing each brain region as a black point.
2. Plot the best‑fit line in medium violet-red on the scatter plot.
3. Simplify the plot appearance by removing the top and right spines, and label the axes as “Structural degree” (x‑axis) and “Functional degree” (y‑axis).
4. Display the Pearson r value as text in the upper‑left corner of the plot.