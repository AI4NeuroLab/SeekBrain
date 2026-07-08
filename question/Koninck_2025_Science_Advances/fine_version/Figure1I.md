I want to evaluate whether individual larvae could be identified by conducting two separate imaging sessions in the same group of larvae 24 hours apart. Use FC_matrices_fingerprinting_6dpf.npy and FC_matrices_fingerprinting_7dpf.npy for analysis. 
Analysis pipeline: 
1. Load the functional connectivity matrices for the two time points from FC_matrices_fingerprinting_6dpf.npy and FC_matrices_fingerprinting_7dpf.npy.
2. Compute the FC similarity matrix across larvae between different days by computing the Pearson correlation between the upper triangle of these FC matrices (excluding the diagonal). 
3. Create the symmetric FC similarity matrix by averaging the correlation in both temporal directions for each pair. Save the symmetric similarity matrix in PROCESS_DATA_DIR/Figure1_FC_fingerprinting.npy.
4. Extract the diagonal values of the symmetric similarity matrix (representing intra-individual similarity) and save them in PROCESS_DATA_DIR/Figure1_FC_fingerprinting_SameLarva.npy.
5. Extract the upper triangular values (excluding the diagonal) of the symmetric similarity matrix (representing inter-individual similarity) and save them in PROCESS_DATA_DIR/Figure1_FC_fingerprinting_DiffLarva.npy.
For visualization:
1. Set figsize=(3, 5).
2. Visualize the intra- and inter-individual similarity data using boxplots overlaid on jittered scatter plots at positions x=0.5 (intra) and x=1.0 (inter).
3. For the boxplot, no fill with the whisker ranging from min to max data points.
4. Set group labels with "intra-individual" and "inter-individual " on the x-axis. Remove x-axis ticks and labels.
5. Set the y-axis limits and ticks to range from 0.6 to 0.85. Label the y-axis with "FC similarity". 
6. Label the P-value and statistical method for comparing the intra- and inter-individual groups.