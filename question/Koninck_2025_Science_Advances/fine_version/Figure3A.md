I want to identify structural connectivity (SC) network modules through a hierarchical consensus algorithm based on the iterative Louvain algorithm for maximization of modularity. Use SC_matrix_directed_terminals_expanded.npy and  PROCESS_DATA_DIR/Figure1_excluded_regions.npy for analysis and visualization. Before data analysis, check the SC matrix if it contain those regions in the Figure1_excluded_regions.npy, remove relevant columns and rows of these regions from it.

Analysis Pipeline
1. Data Loading & exclusions
  - Load the directed SC matrix from SC_matrix_directed_terminals_expanded.npy.
  - Load the excluded regions index array from PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  - Remove excluded regions from the directed SC matrix if not excluded.
2. Consensus Clustering by a consensus modularity maximization algorithm. 
  - Apply the consensus modularity maximization algorithm by using the function  compute_coassignment_probability.
  - Generate an ensemble of 10,000 node partitions, varying the resolution parameter γ from 0.7 to 2.2.
  - Do not subtract the mean of the null model co-assignment matrix.
  - Save the co-assignment probability matrix to PROCESS_DATA_DIR/Figure3_coassignment_matrix_SC.npy.
3. Use hierarchical clustering (Ward’s linkage) on the co-assignment matrix of SC. 
  - Convert the co-assignment probabilities into distances using D=1−C.
  - Perform hierarchical clustering on D using Ward's linkage (scipy.cluster.hierarchy.linkage) to obtain the linkage matrix Z.
  - Cut the dendrogram to extract a partition with 4 modules by using fcluster.
4. Generate the reordered co-assignment matrix by intra-module label reordering
  - Reorder the cluster IDs (1 to 4) based on the physical anterior-posterior position of the regions.
  - Calculate the 33rd percentile index of the nodes in each cluster (assuming nodes are ordered spatially) and assign label 1 to the most anterior cluster and label 4 to the most posterior. This ensures consistent color mapping.

Visualization Specification:
1. Create a figure with two axes: a main square axis for the matrix and a separate axis to its left for the dendrogram.
2. Dendrogram (Left Axis):
  - Use scipy.cluster.hierarchy.dendrogram on the linkage matrix Z.
  - Set orientation='left' (root on the right, leaves on the left facing the matrix).
  - Define the color threshold just above the 4-module cut to color the four main branches.
  - Assigned 4 color (purple, cyan, light yellow-green, and red) to the reversed list of the 4 modules.
  - Style the branches above the threshold with black lines and a line width of 0.5.
  - Hide all axis spines, ticks, and labels.
3. Matrix (Main Axis):
  -  Reorder the rows and columns of the reordered co-assignment matrix using the reversed order of the dendrogram leaves.
  - Plot the reordered co-assignment matrix using imshow with cmap='gray'.
  - Highlight the representative hierarchical level with 4 modules. For each module, use the same color as in the dendrogram.
  - Remove x and y axis ticks.
  - Add a horizontal colorbar labeled "Coass. prob."