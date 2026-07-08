I aim to depict the spatial distribution of individual neurons charaterized by their functional responses across all larvae. The core experimental data are in dff.npy, tail_angles.npy, swim_events.npy, correlations_motor.npy, correlations_dark.npy, and correlations_light.npy. 
Analysis pipeline:
1. Dataset Identification & loading: Scan the top-level directory for subject folders. Iterate through the identified datasets. For each fish:
  1. Load the data and region_labels. Exclude region 10 by setting them to 0. Then, define a mask in_brain for cells with non-zero region labels
  2. Load the functional cell indices from correlated_motor.npy, anticorrelated_motor.npy, correlated_dark.npy, and correlated_light.npy. 
  3. Extract the 3D atlas centroids (centroids_atlas) corresponding to these indices, applying the in_brain filter.
  4. Concatenate the centroids and labels across all larvae to create four consolidated arrays: centroids_motor, centroids_antimotor, centroids_dark, and centroids_light.
2. Spatial Statistics: Perform a spatial P-value test (spatial_p_value_test) on each of the four categories using N_shuffles=1000. This calculates the probability that the observed spatial clustering occurred by chance.
3. Output Generation: Save the consolidated centroids (Figure5_centroids_*.npy) and the computed p-values (Figure5_pvalues_*.npy) for all four categories (motor, antimotor, dark, light) into the PROCESS_DATA_DIR directory.
Visualization Specifications:
1. Data Preparation:
  - Load the consolidated centroids and their corresponding p-values.
  - Define a significance threshold of 0.025.
  - For each category (Motor, Antimotor, Dark, Light), filter the centroids to include only those where p < 0.025.
  - Compute the local density (rho) for the filtered centroids using a 3D grid (974x597x359) and a Gaussian filter with sigma=10.
2. Figure Setup:
  - Create a PaperFigure with figsize=(7, 9) and dpi=900.
  - Define a layout with 4 columns (one for each category) and 2 rows (Top view and Side view).
  - Use cmap = 'rainbow' for the scatter plots.
3. Plotting Loop (for Motor, Antimotor, Dark, and Light):
  - Top View (XY Projection):
    - Display the atlas XY projection (atlas.XYprojection) as the background (cmap='gray', vmax=200).
    - Sort the filtered centroids by density (rho).
    - Overlay the centroids as a scatter plot: x-coordinate vs. y-coordinate.
    - Color points by density (rho) using cmap='rainbow', alpha=0.1, s=1.
    - Set limits: x [65, 505], y [850, 50].
  - Side View (XZ Projection):
    - Display the atlas XZ projection (atlas.XZprojection), rotated 270 degrees (np.rot90(..., k=3)), as the background (cmap='gray', vmax=200).
    - Overlay the centroids using transformed coordinates: x = 359 - z, y = y.
    - Color points by density (rho) using cmap='rainbow', alpha=0.1, s=1.
    - Set limits: x [50, 359], y [850, 50].
  - Styling: Remove ticks (set_xticks([]), set_yticks([])) for all axes.