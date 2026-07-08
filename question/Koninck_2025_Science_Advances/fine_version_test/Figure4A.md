I want to identify and visualize large-amplitude activity patterns across multiple brain regions fish by fish. The core experimental data are stored in region_series_dff_bilateral.npy.
For data loading and preprocessing:
1. Load the region_series_dff_bilateral.npy array (shape [140, time], representing 70 Left + 70 Right regions) for each fish.
2. Smooth: Apply a 1D Gaussian filter (sigma=2) to the time series.
3. Exclude Regions: Identify and remove specific regions from the dataset to ensure quality.
  1. Always exclude region index 10.
  2. Exclude any regions that are not properly sampled (sum is 0) across the stack of all fish.
  3. Apply these exclusions symmetrically (if region i is excluded, exclude i and i+70).
  4. Save the bilateral excluded region indices in PROCESS_DATA_DIR/Figure4_excluded_regions_bilateral.npy
4. Detrend & Normalize: 
  1. Exclude regions listed in Figure4_excluded_regions_bilateral.npy from the bilateral regional time series.
  2. Detrend the remaining time series and convert to ΔF/F using compute_dff_using_minfilter with window=30, sigma1=3, and sigma2=30.
  3. Z-score the resulting traces along the time axis.
5. Concatenated these processed arrays of all fish along the time axis to produce a single 2D “state matrix”, and save it in PROCESS_DATA_DIR/Figure4_state_matrix.npy.
For visualization (Raster Plot):
1. Generate a 2D raster plot of the Z-scored whole-brain neural activity using the state_matrix.
2. Use a "Black/Red → Yellow/White" colormap (cmap='hot'). Constrain the color range to [-3, 3] to represent the Z-scored activity.
3. Y-Axis (Regions)
  1. Draw a horizontal white dashed line at the exact midpoint of the Y-axis (Total Rows / 2) to separate the Left and Right hemispheres (adjusting for the reduced number of regions after exclusion).
  2. Label the top half as "Left" and the bottom half as "Right".
4. X-Axis (Time/Fish):
  1. Draw vertical solid white lines at the boundaries of each fish's dataset to distinguish the 22 distinct panels.
  2. Label the top of each panel with its corresponding Fish ID in white text.
  3. Set the X-axis label as "Imaging Volumes" and label only the start and end indices of the entire matrix.
5. Add a vertical colorbar labeled "Activity (z-scored)".