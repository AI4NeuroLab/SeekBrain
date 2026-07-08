I want to obtain the functional connectivity (FC) matrix among brain regions in each fish larva and visualize the average FC matrix across all larvae. The core experimental data are stored in region_series_dff.npy. The IDs of excluded regions are stored in PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
For analysis:
1. Load data across larvae
  1. Iterate over all larvae. For each larva, load the region-averaged ΔF/F₀ time series from its region_series_dff.npy file.
  2. Use only the first 600 time points for subsequent calculation.
2. Temporal smoothing of regional activity
  1. For each larva and each brain region, apply a 1D Gaussian filter along time withsigma = 2 time step.
3. Compute functional connectivity matrices per larva
  1. For each larva, compute the Pearson correlation matrix across regions using the provided function compute_correlation_matrix applied to the smoothed, truncated regional time series.
  2. Stack all individual FC matrices into a single array matrices with shape (n_larvae, n_regions, n_regions).
  3. Remove these excluded regions simultaneously from the row and column dimensions of the stacked FC matrices. The IDs of excluded regions are listed inPROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  4. Save all individual FC matrices (after region exclusion) to
PROCESS_DATA_DIR/Figure1_FC_matrices.npy.
4. Average FC matrix across larvae
  1. Compute the group-average FC matrix (after exclusion), accommodating NaNs from unsampled regions.
  2. Save the group-averaged FC matrix to
PROCESS_DATA_DIR/Figure1_FC_matrix.npy.
For visualization:
1. Create a square figure with figsize=(6, 6).
2. Draw the lower-triangle of the average FC matrix of all larvae (without excluded regions and the diagonal) . Use imshow with aspect='equal'.
3. Use a white-to-red colormap (cmap = 'Reds') and set color axis range as [0.2 0.9]. Add a color bar on the right side of the FC matrix, and label it “FC”.
4. Indicate the brain region index by labeling only the first (top) and the last (bottom) region indices (i.e., show tick labels only at the 1 and bottom-most positions on the y-axis) along left and bottom sides of the lower-triangle matrix. Set the y-axis label with "Brain regions".
5. Add a title label “Average functional connectivity”  and the number of larvae.