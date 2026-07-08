To characterize the similarities of structural connectivity (SC) and functional connectivity (FC) gradients, I focus on the first 50 gradients, whose eigenvalues (i.e., their relative importance) quickly decayed and want to establish an optimal linear mapping between SC and FC gradients.
Analysis Pipeline
1. Dataset Identification & Loading:
  - Load structural connectivity gradients: PROCESS_DATA_DIR/Figure6_SC_gradients.npy (referred to as modes_SC).
  - Load functional connectivity gradients: PROCESS_DATA_DIR/Figure6_FC_gradients.npy (referred to as modes_FC).
  - Define the number of modes to analyze: N_modes = 50.
2. Optimal Linear Mapping:
  - Select the first 50 modes from both SC and FC datasets.
  - Compute Initial Correlations: Calculate a 50x50 matrix of Pearson correlation coefficients between every pair of SC mode i and FC mode j.
  - Cost Matrix Construction: Create a cost matrix defined as 1 - abs(correlation_matrix) to penalize low absolute correlations.
  - Optimization: Apply the linear sum assignment algorithm (Hungarian algorithm) using scipy.optimize.linear_sum_assignment on the cost matrix to find the optimal one-to-one mapping between SC and FC modes that maximizes total similarity.
  - Reorder & Measure: Reorder the FC modes according to the computed mapping indices. Compute the final sorted correlation matrix where the (i, j) entry represents the correlation between SC mode i and the matched FC mode j (which is FC[mapping[j]]).
3. Output Generation:
  - Save the sorted correlation matrix (shape 50x50) to PROCESS_DATA_DIR/Figure6_FC_SC_gradients_correlations.npy.
  - Save the mapping indices (vector of length 50) to PROCESS_DATA_DIR/Figure6_FC_SC_gradients_mapping_indcies.npy.
Visualization Specifications(Correlation Matrix Heatmap):
1. Dataset Identification & Loading:
  - Load the correlation matrix: Figure6_FC_SC_gradients_correlations.npy.
2. Figure Specification:
  - Plot Type: Heatmap / Matrix plot.
  - Data Processing: Take the absolute value of the correlation matrix (np.abs(correlations)).
  - Color Mapping:
    - Colormap: 'Reds'.
    - Value Range: vmin=0.1, vmax=0.5.
  - Axes Formatting:
    - Remove all X and Y ticks (xticks=[], yticks=[]).
    - Hide the top and right spines of the plot frame.
    - Maintain a square aspect ratio.