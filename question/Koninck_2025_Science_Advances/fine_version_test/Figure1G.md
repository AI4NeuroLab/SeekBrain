I want to address whether the functional connectivity (FC) matrix zbrafish larvae at a similar developmental stage would be stereotyped. UsePROCESS_DATA_DIR/Figure1_FC_matrices.npy for analysis.
Analysis pipeline: 
1. Load Data & preprocess:
  1. Load the functional connectivity matrices from PROCESS_DATA_DIR/Figure1_FC_matrices.npy. Replace any NaN values in the loaded matrices with 0.
  2. Create a list of identifiers for the larvae (e.g., "Fish 1", "Fish 2"...) corresponding to the number of matrices loaded. 
2. Compute the initial network similarity across larvae by computing the Pearson correlation between the upper triangle of these FC matrices (excluding the diagonal). 
3. Ordered the initial network similarity matrix. 
  1. Calculate the mean similarity for each larva (mean of each row in the initial network similarity matrix)
  2. Sort the larvae indices based on this mean value in descending order (from most globally similar to least).
  3. Save ordered fish larva IDs in PROCESS_DATA_DIR/Figure1_FC_network_similarity_larvaID.npy.
4. Recalculate the ordered network similarity matrix across larvae using the reordered list of FC matrices. Save the ordered network similarity matrix in PROCESS_DATA_DIR/Figure1_FC_network_similarity_across_larvae.npy.
5. Compute the average Pearson's r across all larvae and output to the report. 
For visualization:
1. Draw the lower-triangle with the diagonal of the ordered network similarity matrix.
2. Use a white-to-red colormap (cmap = 'Reds') and set color axis range as [0.25 0.80]. Add a color bar on the right side of the matrix, and label it “FC similarity”.
3. Show text labels for the number of the ordered Fish IDs along left and bottom sides of the lower-triangle matrix, and add the y-axis label "Larvae".
4. Remove standard x-axis and y-axis ticks. Hide the top and right spines of the plot. 