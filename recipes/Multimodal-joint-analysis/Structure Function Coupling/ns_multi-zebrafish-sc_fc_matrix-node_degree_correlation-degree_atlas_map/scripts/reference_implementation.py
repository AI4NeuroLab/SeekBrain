import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import zscore

# Add library path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# STEP 1: Load and Preprocess Data
# ============================================================================

# Load SC matrix
sc_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy")
SC = np.load(sc_path)

# Load FC matrix
fc_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
FC = np.load(fc_path)

# Load excluded regions
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path).astype(int)

print(f"Original SC shape: {SC.shape}")
print(f"Original FC shape: {FC.shape}")
print(f"Excluded regions: {excluded_regions}")

# The FC matrix is already filtered (65 regions), so we need to align SC to match it
# Create keep mask for SC (70 regions)
keep_mask_sc = np.ones(SC.shape[0], dtype=bool)
keep_mask_sc[excluded_regions] = False

# Filter SC matrix
SC_filtered = SC[keep_mask_sc][:, keep_mask_sc]

# FC is already filtered, so use it as-is
FC_filtered = FC

print(f"Filtered SC shape: {SC_filtered.shape}")
print(f"Filtered FC shape: {FC_filtered.shape}")

# Verify shapes match
assert SC_filtered.shape == FC_filtered.shape, \
    f"Shape mismatch: SC {SC_filtered.shape} vs FC {FC_filtered.shape}"

# ============================================================================
# STEP 2: Compute Node Degrees
# ============================================================================

# Compute weighted structural degree (sum of edge weights per row)
SC_degree = np.sum(SC_filtered, axis=1)

# Compute weighted functional degree (sum of edge weights per row)
# Keep positive AND negative correlations (as per FC analysis patterns)
# Set diagonal to 0 explicitly
FC_filtered_zero_diag = FC_filtered.copy()
np.fill_diagonal(FC_filtered_zero_diag, 0.0)

# Compute sum of absolute values (common pattern for FC degree)
FC_degree = np.sum(np.abs(FC_filtered_zero_diag), axis=1)

# Handle any NaN/Inf values
SC_degree = np.nan_to_num(SC_degree, nan=0.0, posinf=0.0, neginf=0.0)
FC_degree = np.nan_to_num(FC_degree, nan=0.0, posinf=0.0, neginf=0.0)

# Save degree vectors
sc_degree_path = os.path.join(PROCESS_DATA_DIR, "Figure2_Node_degree_SC.npy")
fc_degree_path = os.path.join(PROCESS_DATA_DIR, "Figure2_Node_degree_FC.npy")
np.save(sc_degree_path, SC_degree)
np.save(fc_degree_path, FC_degree)

print(f"SC degree range: [{SC_degree.min():.3f}, {SC_degree.max():.3f}]")
print(f"FC degree range: [{FC_degree.min():.3f}, {FC_degree.max():.3f}]")

# ============================================================================
# STEP 3: Load and Prepare Atlas Data
# ============================================================================

# Initialize atlas
atlas = MapzebrainAtlas(ATLAS_PATH)

# Get centroids for left and right hemispheres
left_centroids = atlas.regionCentroids['left']
right_centroids = atlas.regionCentroids['right']

# Concatenate centroids (70 regions per hemisphere = 140 total)
centroids_all = np.concatenate([left_centroids, right_centroids], axis=0)

# Flip y-coordinate to match atlas projection
centroids_all[:, 1] = 974 - centroids_all[:, 1]

# Create keep mask for bilateral centroids (140 total: 70 left + 70 right)
# The excluded regions apply to both hemispheres
keep_mask_bilateral = np.ones(140, dtype=bool)
keep_mask_bilateral[excluded_regions] = False  # Exclude from left hemisphere
keep_mask_bilateral[70 + excluded_regions] = False  # Exclude from right hemisphere

# Filter centroids by removing excluded regions
centroids_filtered = centroids_all[keep_mask_bilateral]

print(f"Total centroids after filtering: {centroids_filtered.shape[0]}")

# Verify centroid count matches filtered matrices (65 from left + 65 from right = 130)
assert centroids_filtered.shape[0] == 130, \
    f"Expected 130 centroids (65 left + 65 right), got {centroids_filtered.shape[0]}"

# Split centroids into left and right hemispheres
# First 65 are left, next 65 are right
n_regions_filtered = 65
left_centroids_filtered = centroids_filtered[:n_regions_filtered]
right_centroids_filtered = centroids_filtered[n_regions_filtered:]

print(f"Left hemisphere regions: {left_centroids_filtered.shape[0]}")
print(f"Right hemisphere regions: {right_centroids_filtered.shape[0]}")

# ============================================================================
# STEP 4: Z-score Normalization
# ============================================================================

# Z-score normalize both degree vectors independently
# Use ddof=0 for population standard deviation to match typical neuroimaging conventions
SC_degree_zscore = (SC_degree - np.mean(SC_degree)) / (np.std(SC_degree) + 1e-10)
FC_degree_zscore = (FC_degree - np.mean(FC_degree)) / (np.std(FC_degree) + 1e-10)

# Assign SC degree to left hemisphere and FC degree to right hemisphere
SC_degree_left = SC_degree_zscore
FC_degree_right = FC_degree_zscore

print(f"SC degree z-score range: [{SC_degree_zscore.min():.3f}, {SC_degree_zscore.max():.3f}]")
print(f"FC degree z-score range: [{FC_degree_zscore.min():.3f}, {FC_degree_zscore.max():.3f}]")

# Verify z-score properties (relaxed criteria)
assert abs(np.mean(SC_degree_zscore)) < 0.5, "SC z-score mean should be near 0"
assert abs(np.std(SC_degree_zscore) - 1.0) < 0.5, "SC z-score std should be near 1"
assert abs(np.mean(FC_degree_zscore)) < 0.5, "FC z-score mean should be near 0"
assert abs(np.std(FC_degree_zscore) - 1.0) < 0.5, "FC z-score std should be near 1"

# ============================================================================
# STEP 5: Create Visualization
# ============================================================================

fig, ax = plt.subplots(figsize=(10, 8), dpi=300)

# Load and display atlas projection (XY top view)
xy_projection = atlas.XYprojection
ax.imshow(xy_projection, cmap='binary', aspect='equal')
ax.axis('off')

# Create inverted Blues colormap (blue-to-white, low-to-high)
cmap_blues_inverted = plt.cm.Blues_r

# Plot left hemisphere nodes colored by SC degree (structural)
scatter_left = ax.scatter(
    left_centroids_filtered[:, 0],
    left_centroids_filtered[:, 1],
    c=SC_degree_left,
    cmap=cmap_blues_inverted,
    s=55,
    edgecolors='black',
    linewidths=0.5,
    vmin=-3,
    vmax=2,
    zorder=10
)

# Plot right hemisphere nodes colored by FC degree (functional)
scatter_right = ax.scatter(
    right_centroids_filtered[:, 0],
    right_centroids_filtered[:, 1],
    c=FC_degree_right,
    cmap=cmap_blues_inverted,
    s=55,
    edgecolors='black',
    linewidths=0.5,
    vmin=-3,
    vmax=2,
    zorder=10
)

# Add text annotations
fig_height = xy_projection.shape[0]
fig_width = xy_projection.shape[1]

# "Structural" label below left brain
ax.text(
    fig_width * 0.25,
    fig_height * 0.95,
    'Structural',
    ha='center',
    va='top',
    fontsize=14,
    fontweight='bold',
    color='black'
)

# "Functional" label below right brain
ax.text(
    fig_width * 0.75,
    fig_height * 0.95,
    'Functional',
    ha='center',
    va='top',
    fontsize=14,
    fontweight='bold',
    color='black'
)

# Add colorbar on the left side (without ticks, vertical near center-left)
cbar_ax = fig.add_axes([0.05, 0.3, 0.02, 0.4])
cbar = plt.colorbar(scatter_left, cax=cbar_ax, orientation='vertical')
cbar.set_label('Weighted degree', rotation=90, labelpad=10, fontsize=12)
cbar.set_ticks([])

plt.tight_layout()

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"Figure saved to {figure_path}")

# ============================================================================
# STEP 6: Save Statistics
# ============================================================================

statistics = {
    "n_regions_original_SC": int(SC.shape[0]),
    "n_regions_original_FC": int(FC.shape[0]),
    "n_excluded_regions": int(len(excluded_regions)),
    "n_regions_after_filtering": int(SC_filtered.shape[0]),
    "n_left_hemisphere_regions": int(left_centroids_filtered.shape[0]),
    "n_right_hemisphere_regions": int(right_centroids_filtered.shape[0]),
    "SC_degree_mean": float(np.mean(SC_degree)),
    "SC_degree_std": float(np.std(SC_degree)),
    "SC_degree_median": float(np.median(SC_degree)),
    "SC_degree_min": float(np.min(SC_degree)),
    "SC_degree_max": float(np.max(SC_degree)),
    "SC_degree_25th_percentile": float(np.percentile(SC_degree, 25)),
    "SC_degree_75th_percentile": float(np.percentile(SC_degree, 75)),
    "FC_degree_mean": float(np.mean(FC_degree)),
    "FC_degree_std": float(np.std(FC_degree)),
    "FC_degree_median": float(np.median(FC_degree)),
    "FC_degree_min": float(np.min(FC_degree)),
    "FC_degree_max": float(np.max(FC_degree)),
    "FC_degree_25th_percentile": float(np.percentile(FC_degree, 25)),
    "FC_degree_75th_percentile": float(np.percentile(FC_degree, 75)),
    "SC_degree_zscore_mean": float(np.mean(SC_degree_zscore)),
    "SC_degree_zscore_std": float(np.std(SC_degree_zscore)),
    "FC_degree_zscore_mean": float(np.mean(FC_degree_zscore)),
    "FC_degree_zscore_std": float(np.std(FC_degree_zscore)),
    "correlation_SC_FC_degree": float(np.corrcoef(SC_degree, FC_degree)[0, 1])
}

# Save statistics
stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"Statistics saved to {stats_path}")
print("\nKey Statistics:")
print(f"  SC degree: mean={statistics['SC_degree_mean']:.3f}, std={statistics['SC_degree_std']:.3f}")
print(f"  FC degree: mean={statistics['FC_degree_mean']:.3f}, std={statistics['FC_degree_std']:.3f}")
print(f"  SC-FC degree correlation: r={statistics['correlation_SC_FC_degree']:.3f}")
