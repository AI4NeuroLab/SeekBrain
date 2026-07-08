I want to identify structural connectivity (SC) network modules through a hierarchical consensus algorithm based on the iterative Louvain algorithm for maximization of modularity. The core experimental data are SC_matrix_directed_terminals_expanded.npy, zebrafish brain atlas and regional information in the atlas folder, and the Figure1_excluded_regions.npy in the PROCESS_DATA_DIR folder. 
1. Apply a consensus modularity maximization algorithm to generate a co-assignment probability matrix. 
  1. Import the function compute_coassignment_probability.
  2. Load the SC matrix after excluding specific brain regions  listed in Figure1_excluded_regions.npy (both rows and columns corresponding to these regions are removed). 
  3. Generate an ensemble of 10,000 node partitions, varying the resolution parameter γ from 0.7 to 2.2.
  4. Compute the co-assignment (consensus) matrix C, whose entries cij indicate the empirical probability that nodes i and j are assigned to the same module across the 10,000 partitions.
2. Use hierarchical clustering (Ward’s linkage) on the co-assignment matrix of SC. 
  1. Import scipy.cluster.hierarchy.linkage and  scipy.cluster.hierarchy.fcluster.
  2. Convert high coassignment probabilities into small distances  using the transformation, D = 1 − C, and apply Ward’s linkage on the distance matrix D to obtain a hierarchical clustering (linkage matrix Z).
  3. Use fcluster with the maxclust criterion on Z to extract a partition with 4 modules. This yields a module label for each node.
For visualization:
1. Reorder and plot the co-assignment matrix of SC.
  1. Reorder the rows and columns of the co-assignment matrix C according to the common node ordering derived from the hierarchical clustering. 
  2. Plot the elementwise square of the reordered co-assignment matrix to enhance the contrast of high co-assignment probabilities.
  3. Using a white-to-purple colormap (cmap='Purples'), with values constrained to the range [0, 1].
  4. Add a horizontal colorbar labeled “SC^2”.
  5. Use a square aspect ratio so that each matrix element is plotted as a square pixel and the main diagonal runs cleanly from the upper-left to the lower-right corner.
  6. Draw a black border around the entire matrix to emphasize the outline of the heatmap.
  7. Draw a black border around the matrix and use a square aspect ratio so that pixels appear as squares and the main diagonal runs cleanly from the top left to the bottom right.
  8. Do not display any axis ticks or axis labels on the matrix axes (i.e., hide x and y ticks and labels), so that only the matrix itself is visible.
2. Highlight the representative hierarchical level with 4 modules. 
  1. Using the 4-module partition of the reordered co-assignment matrix, draw black boxes along the diagonal (with plot_matrix_communities or an equivalent function) to outline the block-diagonal structure corresponding to the four modules.
  2. Set the line widths of these module boxes thicker than the default gridline widths, ensuring that the module boundaries are clearly visible.