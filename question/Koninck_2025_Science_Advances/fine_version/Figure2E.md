I want to address how physical connectivity predicts correlated activity by comparing the node degrees of the structural connectivity (SC) and functional connectivity (FC) networks spatially. Visualize the these node degrees in the brain atlas. Use SC_matrix_undirected_terminals_expanded.npyand PROCESS_DATA_DIR/Figure1_FC_matrix.npy for analysis and visualization. Zebrafish brain atlas and regional information are in the atlas folder. Before data analysis, check these connectivity matrices if they contain those regions in the PROCESS_DATA_DIR/Figure1_excluded_regions.npy, remove relevant columns and rows of these regions from them.
Analysis Pipeline:
1. Data Loading & preprocess
  - Load the SC matrix: SC_matrix_undirected_terminals_expanded.npy.
  - Load the FC matrix: PROCESS_DATA_DIR/Figure1_FC_matrix.npy.
  - Load the ID list of excluded regions: PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  - Check the SC and FC matrices if they contain those regions in the PROCESS_DATA_DIR/Figure1_excluded_regions.npy, remove relevant columns and rows of these regions from them.
2. Compute the weighted structural degree for each node by summing the edge weights of its corresponding row in the processed SC matrix. Save the resulting SC degree vector as PROCESS_DATA_DIR/Figure2_Node_degree_SC.npy.
3. Compute the weighted functional degree for each node by summing the rows of the processed FC matrix. Save the resulting degree vector as PROCESS_DATA_DIR/Figure2_Node_degree_FC.npy.
Visualization Specification:
1. Load and Prepare Data
  - Load the computed degree files: Figure2_Node_degree_SC.npy and Figure2_Node_degree_FC.npy in PROCESS_DATA_DIR.
  - Z-score both degree vectors independently before plotting to normalize the color mapping.
  - Load the left and right region centroids from the MapzebrainAtlas class.
  - Filter the centroids by removing the indices listed in PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
2. Panel layout & Background Setup
  1. Display the top (horizontal, XY) view of atlas projection image, using imshow with cmap='binary' and aspect='equal'.
  2. Remove axis labels and ticks.
3. Plotting nodes encoded by node degree values (Scatter Overlay)
  1. Color the markers of the left region centroids according to the z‑scored SC node degrees.
  2. Color the markers of the right region centroids according to the z‑scored FC node degrees.
  3. Set the maker edge in black and the maker size to 55.
  4. Use a blue‑to‑white (low-to-high) colormap (flipping cmap = 'Blues') with color limits in [-3 2].
4. Annotations:
  1. Place a “Structural” label below the left‑brain node map.
  2. Place a “Functional” label below the right‑brain node map.
  3. Add a colorbar (without ticks) positioned vertically near the center of the left side of the figure. Label the color bar “Weighted degree”. Avoid overlaying on the altas projection image. 