I want to evaluate whether individual larvae could be identified by conducting two separate imaging sessions in the same group of larvae 24 hours apart. Use FC_matrices_fingerprinting_6dpf.npy and FC_matrices_fingerprinting_7dpf.npy for analysis. 
Analysis pipeline: 
1. Load the functional connectivity matrices for the two time points from FC_matrices_fingerprinting_6dpf.npy and FC_matrices_fingerprinting_7dpf.npy.
2. Compute the FC similarity matrix across larvae between different days by computing the Pearson correlation between the upper triangle of these FC matrices (excluding the diagonal). 
3. Create the symmetric FC similarity matrix by averaging the correlation in both temporal directions for each pair. Save the symmetric similarity matrix in PROCESS_DATA_DIR/Figure1_FC_fingerprinting.npy.
Visualization Specification: 
1. Plot the symmetric FC similarity matrix. Use imshow with aspect = 'equal'.
2. Use a white-to-red colormap (cmap = 'Reds' ) and set color axis range as [0.60 0.85]. Add a colorbar and label it "FC similarity".
3. Set the x-axis and y-axis ticks to represent the fish IDs, starting with 1, , and add the y-axis label "Larvae".
4. Use white asterisks ('*') denote maximal similarity values on each row.