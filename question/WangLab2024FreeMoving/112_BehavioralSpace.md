Analyze the WangLab2024FreeMoving dataset to deconstruct hunting behavior in larval zebrafish. Use the bout_tail_series and tail_angles to construct a 3D behavioral space via PCA dimensionality reduction, DTW pairwise distance computation, Affinity Propagation micro-clustering, and Isomap nonlinear embedding. Save the behavioral space coordinates and exemplar-to-bout mappings for use in subsequent SVD analysis and bout type clustering.

# Input sources/files from PROCESS_DATA_DIR
- tail_angles: dict: fish_id → (N_frames × 50) — for PCA fitting across all bout frames
- bout_tail_series: list of (T_i × 50) arrays per bout — for projecting into PC space and DTW
- bout_indices: list of bout metadata dicts
- bout_to_fish_map: DataFrame for provenance tracking

# Key operations
- Normalize tail kinematics across all bout frames (subtract mean, divide by standard deviation) and perform Principal Component Analysis (PCA), retaining the first 3 principal components to create "eigenfish" postural modes.
- Calculate the pairwise distance between every bout using Dynamic Time Warping (DTW) with a 10 ms warping window, ignoring left/right polarity by aligning trajectories twice and keeping the minimum distance.
- Perform Affinity Propagation micro-clustering using the median negative DTW distance to identify representative bout exemplars.
- Construct a nearest-neighbors graph of the exemplars and apply Isomap embedding to map them into a 3D behavioral space.

# Key result variables to save in PROCESS_DATA_DIR
- eigenfish: (3 × 50) array for visualization
- explained_variance_ratio: (3,1) array
- bout_pc_trajectories: list contains each (T_i × 3), indexed by bout_id
- exemplar_ids: array of bout_ids selected as exemplars (N_exemplars,1)
- cluster_membership: mapping all bouts to their micro-cluster
- dtw_exemplar_matrix: (N_exemplars × N_exemplars) symmetric matrix
- behavioral_space_coords: (N_exemplars × 3) array
- isomap_model
- isomap_eigenvalues
- isomap_reconstruction_error	
- bout_to_exemplar_map: DataFrame's bout_id → exemplar_id → (iso_dim1, iso_dim2, iso_dim3), for mapping every bout into behavioral space

# Visualizations
- PCA: explained variance barplot (cumulative); eigenfish tail shapes for PC1–3; example bout trajectories through 3D PC space
- Isomap: eigenvalue scree plot + reconstruction error plot with elbow at 3
- Behavioral space: 3D scatter of exemplars colored by position (hue-lightness cylinder); 2D projections (dim1 vs dim2, dim1 vs dim3); annotated with representative bout tail kinematics at different regions
- Kernel density estimation over first two isomap dimensions
