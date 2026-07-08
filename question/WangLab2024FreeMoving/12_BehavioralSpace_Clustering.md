Analyze WangLab2024FreeMoving dataset. Use the bout_tail_series and tail_angles to construct a 3D behavioral space via PCA dimensionality reduction, DTW pairwise distance computation, and Isomap nonlinear embedding. Save key results.

# Input sources/files
- all *_timeseries_behavior.pkl files from the subfolders in /mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data/lyx/WangLab2024FreeMoving/Processed_data/Trials_Bout_Accurate/

# Operations
## Step 1 — Bout assembly
### Process Kinematics: 
Linearly interpolate tail_angle_seg1..9 and tip_angle (limit = 3 frames, both directions). 
*Note: Tail segment angles and tip angle are in degrees; heading is in radians.* 
Extract heading, vigor, and per-frame tail likelihood (using tail_mean_likelihood or the mean of likelihood_tail*) without modification. 
Extract the core window for each bout.

### Apply Quality Flags: 
Evaluate the core window and attach +-joined tags (use ok if none apply):
nan_leftover: Interpolation failed to resolve all NaNs → set clustered=False.
low_likelihood: Mean tail likelihood is <0.4 on >20% of frames.
long_duration: Bout duration is >500 ms.

### Save Output: 
Export all bouts (both clustered and flagged) as a list of dictionaries to bouts_qc.pkl. 
Keep non-clustered rows in the list so the next analysis of the 1st-order bout transition can use them to identify sequence breaks.

## Step 2 — Posture PCA
### Filter Data: 
Concatenate tail_segs across all bouts. 
Retain only frames where all 9 segments are finite and the tail likelihood ≥ pca_fit_likelihood_cutoff.
Z-score the 9-D matrix of all valid frames.
### Fit PCA Model: 
Run PCA on the Z-scored matrix with n_components=3 and a suitable value for andom_state.
### Save Output: 
pca_components.npy, 
pca_stats.npy (mean and std), 
pca_explained_variance.npy.

## Step 3 — Preprocessing sign-flip + context padding
### Transform Bouts: 
Apply the PCA to every bout's raw segments. Attach the resulting 3D array to each bout dictionary.
### Calculate Padding: 
Determine the pad length in frames (pad_ms=35).
### Apply Context Pad: 
Re-load and re-interpolate trial data. Extend the bout's core window left (pad_before) and right (pad_after) up to the maximum pad frames. Shrink the pad if it encounters trial-boundary NaNs.
### Filter Residual NaNs: 
If unresolved NaNs remain in the padded window, set clustered=False, append nan_leftover_pad to the quality flags, and exclude the bout from clustering.
### Apply Sign-Flip: 
Find the sign of the maximum absolute PC1 peak in the core window. Multiply pc_traj, tip, and tail_segs (both core and padded) by this sign. This forces a positive PC1 peak while preserving left/right kinematic symmetry for DTW.
### Attach & Report: 
Attach the core and padded features, pad_before, pad_after, and sign_flip scalar to the bout dictionary. 
Report the final counts of clusterable bouts versus those rejected due to pad NaNs.

## Step 4 — Polarity-invariant DTW distance matrix
### Prepare Data: 
Extract the ordered, padded trajectories (pc_traj_pad) for ***all QC-paased clusterable bouts***. Do not reduce the sample size.
### Define DTW Band: 
Calculate the Sakoe-Chiba constraint band in frames (dtw_band_ms=15). 
Set the minimum band size to 1.
### Compute Distance Matrix: 
For every unique pair of bouts, calculate the polarity-invariant Dynamic Time Warping (DTW) distance (adapted from Mearns 2020).
### Parallelize: 
Distribute the pairwise row computations using joblib.Parallel(n_jobs=-1, backend="loky") to maximize throughput.
### Save Output: 
Construct a symmetric float32 matrix with a zero diagonal (shape N x N, where N is the number of clusterable bouts). 
Save to dtw_distance_matrix.npy.

## Step 5 — Isomap embedding
### Fit Embedding: 
Run an Isomap on the precomputed DTW distance matrix using n_neighbors=5 and n_components=20.
### Save Main Embedding: 
Save all 20 dimensions as a float32 array to isomap_embedding.npy. 
Note that the first two dimensions will be used later in Step 7.
### Parameter Sweep for Scree Plot:
Sweep n_components across [2, 3, 5, 10, 15, 20, 30].
Extract the reconstruction_error() at each step and save to isomap_reconstructioerror.npy for downstream scree inspection.

## Step 6 — Ward hierarchical clustering
### Compute Linkage: 
Perform hierarchical clustering on the 20-D Isomap embedding using scipy.cluster.hierarchy.linkage with method="ward". 
Save the output to linkage_matrix.npy.
### Evaluate Silhouettes: 
Calculate Euclidean silhouette scores on the 20-D embedding for cluster counts K=2 through 13. 
Save the resulting curve data to silhouette_scores.npy and silhouette_K_range.npy.
### Extract Clusters: 
Extract 0-indexed cluster labels using fcluster with criterion="maxclust". 
Save K=7 to cluster_labels_K7.npy.
### Calculate Centroids: 
Find the mean 20-D embedding for each of the 7 main clusters. 
Stack these into a 7x20 matrix and save to cluster_centroids.npy.

## Step 7 — Visualization of behavioral space and bout types 
### figure layout: 
Create a 4-row figure.
Row 0 — Behavioral space of all bouts. Set this plot as a square.
Row 1 — Tip Angle of different bout clusters. Generate 1 × K-column panels.
Row 2 — Tail Segments' Kinematic Heatmap. The same layout as in Row 1.
Row 3 — Representative-Bout Skeleton Fan (Tail posture dynamics). As in Row 1.

### Styling: 
Set the Cluster Color Palette as a 9-color hex list starting #E76F51, #2A9D8F, #264653, #F4A261, #8E7DBE, #457B9D, #A8C256, #B5838D, #6D6875, wrapping by index. 
Set the transparency of clean bouts (quality_flag == "ok") → alpha=0.8, for flagged bouts (quality_flag != "ok") → alpha=0.15 (visually de-emphasizing them).

### figure content:
**Row 0 — Behavioral space**
Draw a scatter plot of Isomap Dimension 1 versus Dimension 2, plotting one point per bout. 
Color each bout by its type with the out Color Palette.

**Row 1 — Tip Angle Overlay**
Plot 100 random bouts per cluster with faint traces (cluster color, alpha=0.3) and thick mean line.
Plot the padded tip angle (tip_pad) versus time-from-onset (ms) at alpha=0.22.
Calculate a thick, black, DTW-aligned mean trace from up to 100 core traces.
Share the X-axis limits across all clusters and fix the Y-axis limits to ±100 degrees.

**Row 2 — Tail Segments' Kinematic Heatmap** 
Align every bout's padded tail segments to its onset frame. 
Fill missing values with NaN and compute the nanmean across bouts to create a Time × 9 matrix.
Plot using imshow with cmap="RdBu_r" and clim=(-100, 100).
Invert the Y-axis (ax.set_ylim(1, 0)) so segment 1 (rostral end) is at the top and segment 9 (caudal end) is at the bottom. 
Turn off all spines, and annotate the rostral-to-caudal segment labels only on the first column. 
Put the colorbar of tail angle between the rostral/caudal labels, text in the left side.

**Row 3 — Representative-Bout Skeleton Fan (Tail posture dynamics)**
Select the Representative Bout: Rank the cluster's bouts by their 20-D Euclidean distance to the cluster centroid. From the 10 closest bouts, pick the one with the largest absolute tip peak (|tip_peak|). This ensures the representative reflects the cluster’s actual kinematic signature, rather than just selecting the flattest baseline near the dense center.
Reconstruct the Skeleton of representative bout from seg1 (rostral end) to seg9 (caudal end).
Render Skeleton: Rotate the coordinates 90° so the fish points downward from the origin. Overlay all frames of the bout, coloring them by frame index using the viridis colormap. No temporal subsampling. Use seg1 anchored at origin.
Fix the axes identically across all clusters for visual comparability, aspect="equal", with all axes turned off. 
Add a vertical colorbar of bout time, scaled from 0 to the duration (in ms) of that specific cluster's representative bout.