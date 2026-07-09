import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import zscore

# Add library path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")
from zebrafish_Ca_utils import MapzebrainAtlas

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# STEP 1: Data Loading & Robust Preprocessing
# ============================================================================

# Load SC matrix
sc_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy")
SC = np.load(sc_path)

# Load FC matrix
fc_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
FC = np.load(fc_path)

# Load excluded regions indices
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path).astype(int)

print(f"Original SC shape: {SC.shape}")
print(f"Original FC shape: {FC.shape}")
print(f"Excluded regions indices: {excluded_regions}")

# Create mask for original 70-region atlas
n_original = 70
keep_mask = np.ones(n_original, dtype=bool)
keep_mask[excluded_regions] = False
n_filtered = np.sum(keep_mask)

# Filter SC matrix (SC is expected to be full 70x70)
if SC.shape[0] == n_original:
    SC_filtered = SC[keep_mask][:, keep_mask]
    print(f"Filtered SC matrix from {SC.shape} to {SC_filtered.shape}")
else:
    print(f"Warning: SC matrix shape {SC.shape} does not match expected {n_original}. Using as is.")
    SC_filtered = SC

# Filter FC matrix (Robust Check: Only filter if it hasn't been filtered yet)
if FC.shape[0] == n_original:
    FC_filtered = FC[keep_mask][:, keep_mask]
    print(f"Filtered FC matrix from {FC.shape} to {FC_filtered.shape}")
elif FC.shape[0] == n_filtered:
    FC_filtered = FC
    print(f"FC matrix appears already filtered ({FC.shape}). Skipping removal.")
else:
    print(f"Warning: FC matrix shape {FC.shape} matches neither original nor filtered expectations. Using as is.")
    FC_filtered = FC

# Verify alignment
assert SC_filtered.shape == FC_filtered.shape, "SC and FC shapes must match after preprocessing."

# ============================================================================
# STEP 2: Compute Node Degrees
# ============================================================================

# SC Degree: Sum of edge weights (rows)
SC_degree = np.sum(SC_filtered, axis=1)

# FC Degree: Sum of rows (using absolute values to represent connection strength)
# Zero out diagonal to avoid self-correlation bias if present
FC_temp = FC_filtered.copy()
np.fill_diagonal(FC_temp, 0)
FC_degree = np.sum(np.abs(FC_temp), axis=1)

# Handle potential NaNs
SC_degree = np.nan_to_num(SC_degree)
FC_degree = np.nan_to_num(FC_degree)

# Save degree vectors
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_Node_degree_SC.npy"), SC_degree)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_Node_degree_FC.npy"), FC_degree)

# ============================================================================
# STEP 3: Atlas Preparation & Visualization
# ============================================================================

# Initialize atlas
atlas = MapzebrainAtlas(ATLAS_PATH)
xy_projection = atlas.XYprojection

# Prepare Centroids
left_centroids = atlas.regionCentroids['left']   # Original: 70
right_centroids = atlas.regionCentroids['right'] # Original: 70
all_centroids = np.concatenate([left_centroids, right_centroids], axis=0)

# Adjust Y-coordinate for display
all_centroids[:, 1] = 974 - all_centroids[:, 1]

# Create bilateral exclusion mask for centroids
# 140 total regions: 0-69 (Left), 70-139 (Right)
bilateral_keep_mask = np.ones(len(all_centroids), dtype=bool)
bilateral_keep_mask[excluded_regions] = False             # Remove from Left
bilateral_keep_mask[n_original + excluded_regions] = False # Remove from Right

# Filter centroids
centroids_filtered = all_centroids[bilateral_keep_mask]
n_per_hemi = n_filtered # 65
left_centroids_filtered = centroids_filtered[:n_per_hemi]
right_centroids_filtered = centroids_filtered[n_per_hemi:]

# Z-score Normalization
SC_z = zscore(SC_degree)
FC_z = zscore(FC_degree)

# Setup Figure
fig, ax = plt.subplots(figsize=(10, 8), dpi=300)

# 1. Background
ax.imshow(xy_projection, cmap='binary', aspect='equal')
ax.axis('off')

# 2. Scatter Plots
# Colormap: Blue-to-White (Low-to-High) -> Inverted Blues
cmap = plt.cm.Blues_r 

# Left Brain -> Structural (SC)
sc_scatter = ax.scatter(
    left_centroids_filtered[:, 0], left_centroids_filtered[:, 1],
    c=SC_z, cmap=cmap, vmin=-3, vmax=2,
    s=55, edgecolors='black', linewidth=1.0
)

# Right Brain -> Functional (FC)
fc_scatter = ax.scatter(
    right_centroids_filtered[:, 0], right_centroids_filtered[:, 1],
    c=FC_z, cmap=cmap, vmin=-3, vmax=2,
    s=55, edgecolors='black', linewidth=1.0
)

# 3. Annotations
# Use axes coordinates (0 to 1) for robust text placement below the image
ax.text(0.25, -0.05, "Structural", transform=ax.transAxes,
        ha='center', va='top', fontsize=14, fontweight='bold', color='black')

ax.text(0.75, -0.05, "Functional", transform=ax.transAxes,
        ha='center', va='top', fontsize=14, fontweight='bold', color='black')

# 4. Colorbar
# Position: Near center-left, vertical
cbar_ax = fig.add_axes([0.05, 0.35, 0.02, 0.3]) # [x, y, width, height]
cbar = plt.colorbar(sc_scatter, cax=cbar_ax, orientation='vertical')
cbar.set_label("Weighted degree", rotation=90, labelpad=10, fontsize=12)
cbar.set_ticks([]) # Remove ticks

# Save
plt.tight_layout() # This might warn with add_axes, but usually helps with main plot
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
# Using bbox_inches='tight' ensures the text outside axes is included
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"Figure saved to {figure_path}")
