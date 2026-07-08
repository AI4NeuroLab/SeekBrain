I need to identify and visualize high-amplitude co-fluctuation events (moments of synchronized brain-wide activity) fish by fish using a rigorous statistical framework. The core experimental data are stored in PROCESS_DATA_DIR/Figure4_state_matrix.npy. 
Analysis Pipeline:
1. Load the state matrix.
2. Co-fluctuation Calculation (RMS): 
  1. For every time point t, compute the pairwise co-fluctuation matrix (product of Z-scored activity zi(t)⋅zj(t)).
  2. Calculate the Root Mean Square (RMS) of these products across all unique region pairs (upper triangle, excluding diagonal) to obtain a single "co-fluctuation magnitude" trace.
  3. Save RMS in PROCESS_DATA_DIR/Figure4_RMS.npy.
3. Statistical Inference (Null Model & FDR):
  1. Generate Null Distribution: Perform 100 iterations of time-series permutation (e.g., circular shifts) for each region to break spatial correlations while preserving temporal autocorrelation. Compute the RMS for these permuted datasets to build a pooled "Null RMS Distribution." Save the null RMS distribution in PROCESS_DATA_DIR/Figure4_null_RMS_distribution.npy.
  2. Define the significance threshold as the 95th percentile of the null RMS distribution, and save the threshold in PROCESS_DATA_DIR/Figure4_RMS_threshold.npy.
  3. Compute P-values: For each frame in the actual data, calculate an empirical p-value by comparing its RMS value to RMS threshold.
  4. FDR Correction: Apply the Benjamini-Hochberg procedure to correct these p-values for multiple comparisons (Target False Discovery Rate α=0.05).
4. Event Definition (Plateaus):
  1. Identify significant frames where the adjusted p-value is <0.05.
  2. Merge & Split: Group contiguous significant frames into discrete "events" (plateaus). Crucially, ensure that no event spans across two different fish; if a continuous sequence of significant frames crosses a fish boundary, split it into separate events. Use the function find_plateaus by imported.
  3. Event Extraction: For each defined event, calculate the mean neural activity vector across its constituent frames.
  4. Save events in PROCESS_DATA_DIR/Figure4_events_high.npy.
Visualization Specifications:
1. RMS Time Series Plot:
  - Plot the concatenated RMS time series for all fish (X-axis: Time, Y-axis: RMS magnitude).
  - Log Scale: Use a logarithmic scale for the Y-axis.
  - Threshold Line: Draw a horizontal red line indicating the 95th percentile of the Null RMS distribution (as a visual reference).
2. Significance Markers:
  - Add a rug plot or specific markers at the bottom of the graph to highlight the exact timestamps of frames that survived FDR correction (adjusted p<0.05).
3. Additional text: Print the total number of discrete events identified after merging and boundary splitting.