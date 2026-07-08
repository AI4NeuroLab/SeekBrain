To analyze the spatial distribution of neuronal activity, we need to map the somatic locations of individual neurons from 22 zebrafish onto the zebrafish brain atlas, providing statistical description of total neuronal number per fish (mean ± SD) in the report. Visualize an example larva's mapped neurons in the regional projection background. Use each larva's data.hdf5 file for analysis. Zebrafish atlas and regional information is in the atlas folder.
For analysis:
1. Initialize Atlas: Load the zebrafish brain atlas through MapzebrainAtlas.
2. Calculate Neuronal Counts:
  - Load data.hdf5 of each fish and calculate the total number of neurons in each brain region.
  - Aggregate these counts into a matrix (Regions × Datasets) and save as PROCESS_DATA_DIR/Figure1_N_neurons_per_region.npy.
3. Define Exclusion Criteria:
  - Exclude neurons located in specific regions based on the following rules:
    - Region 10 (Retina) is always excluded.
    - Any region that does not have at least 25 sampled neurons in at least 50% of the datasets is excluded.
  - Save the IDs of excluded regions to PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
4. Statistical Reporting: Calculate and print the average number of neurons per fish (mean ± SD) considering only the included regions.
5. Generate Region Projections:
  - For the Top view: Iterate through all regions (excluding retina), retrieve the region mask (orientation='vertical'), calculate its mean projection along the first axis, and accumulate these into a composite top projection image. Save the top regional projection in PROCESS_DATA_DIR/Figure1_projection_regions_top.npy.
  - For the Side view: Perform a similar process but calculate the mean projection along the third axis. Save the side regional projection in PROCESS_DATA_DIR/Figure1_projection_regions_side.npy.
For visualization:
1. Load Data:
  - Load the top and side regional projections in PROCESS_DATA_DIR.
  - Select the 2nd dataset in the dataset list (representative larva). Load its neuronal centroids and region labels, removing those neuronal centroids belonging to the excluded regions (listed in PROCESS_DATA_DIR/Figure1_excluded_regions.npy). Filter neurons that have no region assignment (unlabeled neurons).
2. Panel Layout & Setup Colors:
  1. Set figsize=(8, 6).
  2. Create two axes within the overall figure. Top view occupying 60% width, Side view occupying 40% width, matched height.
  3. Generate a color palette of 11 evenly spaced hues (saturation=65, value=90). Repeat this palette to cover all active regions.
3. Plot Top View (Horizontal/XY):
  - Plot the top view of the region projection as the background using imshow with cmap='binary', aspect='equal', and origin='lower'. Ensure the region projection is visible.
  - Overlay the neuronal centroids (without retina) as a scatter plot. Color them by their regional label using the generated palette.
  - Set limits: x-axis [65, 505], y-axis [850, 50]. Turn axis frame and ticks off.
4. Plot Side View (Sagittal/XZ):
  - Plot the side veiw of the region projection map as the background. First, rotate the side projection image 90 degrees clockwise. Then, use imshow  with cmap='binary', aspect='equal', and origin='lower'. Ensure the region projection is visible.
  - Prepare centroids (without retina) for the side view. Invert the z-coordinate of neuronal centroids to match the rotated view. Use these transformed coordinates (inverted z, y) for plotting.
  - Overlay the neuronal centroids with the transformed coordinates. Color them by their regional label using the generated palette. Use the same visual parameters (color, size, alpha) as the Top View.
  - Set limits: x-axis [40, 359], y-axis [850, 50]. Turn axis frame and ticks off.