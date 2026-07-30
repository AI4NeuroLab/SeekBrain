import os
import sys
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
import json

# Add shared toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ATLAS_PATH = os.getenv("ATLAS_PATH")

# Ensure output directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# 1. Load and Prepare Data
# ============================================================================

# Load the group-averaged FC matrix
fc_matrix_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
fc_matrix = np.load(fc_matrix_path)
print(f"Loaded FC matrix with shape: {fc_matrix.shape}")

# Load excluded regions
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path).astype(int)
print(f"Loaded {len(excluded_regions)} excluded regions: {excluded_regions}")

# Load atlas
atlas = MapzebrainAtlas(ATLAS_PATH)

# Extract centroids for left and right hemispheres
centroids_left = atlas.centroids['left']
centroids_right = atlas.centroids['right']
num_regions_per_hemisphere = centroids_left.shape[0]

print(f"Regions per hemisphere: {num_regions_per_hemisphere}")
print(f"FC matrix represents {fc_matrix.shape[0]} regions (expected: after exclusions per hemisphere)")

# Concatenate left and right hemisphere centroids
centroids_full = np.concatenate([centroids_left, centroids_right], axis=0)
print(f"Full centroids shape: {centroids_full.shape}")

# Adjust y-coordinates to match image orientation
TOP_VIEW_Y_MAX = 974
centroids_full[:, 1] = TOP_VIEW_Y_MAX - centroids_full[:, 1]

# Create bilateral FC matrix by tiling (this creates a 2x2 block matrix)
# FC matrix is already per-hemisphere with exclusions applied
fc_bilateral = np.tile(fc_matrix, (2, 2))
print(f"Bilateral FC matrix shape: {fc_bilateral.shape}")

# Now we need to remove excluded regions from BOTH centroids and FC matrix
# The excluded_regions indices refer to the original atlas region IDs (0-69 per hemisphere)
# We need to construct the mask for the bilateral centroid array

# Build exclusion mask for bilateral centroids (left + right)
excluded_indices_left = excluded_regions[excluded_regions < num_regions_per_hemisphere]
excluded_indices_right = excluded_regions[excluded_regions < num_regions_per_hemisphere] + num_regions_per_hemisphere

# Combine both
excluded_indices_bilateral = np.concatenate([excluded_indices_left, excluded_indices_right])

keep_mask = np.ones(centroids_full.shape[0], dtype=bool)
keep_mask[excluded_indices_bilateral] = False
centroids_filtered = centroids_full[keep_mask].copy()
print(f"Filtered centroids shape: {centroids_filtered.shape}")

# The FC matrix should already have the correct dimensions after tiling
# Verify dimensions match
assert fc_bilateral.shape[0] == centroids_filtered.shape[0], \
    f"Dimension mismatch: FC bilateral {fc_bilateral.shape[0]} vs filtered centroids {centroids_filtered.shape[0]}"

fc_bilateral_filtered = fc_bilateral.copy()
print(f"Using bilateral FC matrix shape: {fc_bilateral_filtered.shape}")

# ============================================================================
# 2. Panel Layout
# ============================================================================

fig = plt.figure(figsize=(8, 6))

# Create two axes: Top view (60% width), Side view (40% width)
ax_top = fig.add_axes([0.05, 0.1, 0.54, 0.8])  # [left, bottom, width, height]
ax_side = fig.add_axes([0.62, 0.1, 0.36, 0.8])

# ============================================================================
# 3. Top View (Horizontal / XY)
# ============================================================================

# Display background atlas XY projection
ax_top.imshow(atlas.XYprojection, cmap='binary', aspect='equal')

# Extract top view coordinates (X, Y)
centroids_top = centroids_filtered[:, [0, 1]]

# Prepare edges: Extract upper triangle (no diagonal) from bilateral FC matrix
n_nodes = fc_bilateral_filtered.shape[0]
edges = []
for i in range(n_nodes):
    for j in range(i + 1, n_nodes):
        weight = fc_bilateral_filtered[i, j]
        if not np.isnan(weight) and weight != 0:
            edges.append((i, j, weight))

print(f"Total edges (upper triangle, non-zero): {len(edges)}")

# Filter bottom quartile edges
edges_filtered = []
if len(edges) > 0:
    weights = np.array([w for (_, _, w) in edges])
    threshold = np.percentile(weights, 25)
    edges_filtered = [(i, j, w) for (i, j, w) in edges if w >= threshold]
    
    # Sort edges by weight (stronger on top)
    edges_filtered.sort(key=lambda x: x[2])
    
    print(f"Edges after 25th percentile filter: {len(edges_filtered)}")
    
    # Create line segments for edges
    segments = []
    edge_weights = []
    for i, j, w in edges_filtered:
        segments.append([centroids_top[i], centroids_top[j]])
        edge_weights.append(w)
    
    # Create LineCollection
    edge_weights = np.array(edge_weights)
    lc = LineCollection(
        segments,
        array=edge_weights,
        cmap='Reds',
        linewidths=0.5,
        alpha=0.7,
        zorder=1
    )
    lc.set_clim(0.2, 0.9)
    ax_top.add_collection(lc)

# Plot nodes
ax_top.scatter(
    centroids_top[:, 0],
    centroids_top[:, 1],
    color='white',
    edgecolor='black',
    s=10,
    linewidths=0.5,
    zorder=10
)

# Set axis limits
ax_top.set_xlim([65, 505])
ax_top.set_ylim([850, 50])
ax_top.axis('off')

# Add annotation
ax_top.text(0.05, 0.95, 'Top', transform=ax_top.transAxes,
            fontsize=14, fontweight='bold', va='top', ha='left', color='black')

# ============================================================================
# 4. Side View (Sagittal / XZ)
# ============================================================================

# Transform centroids for side view: invert Z-coordinate
SIDE_VIEW_Z_MAX = 359
centroids_side = centroids_filtered[:, [2, 1]].copy()  # Use Z and Y
centroids_side[:, 0] = SIDE_VIEW_Z_MAX - centroids_side[:, 0]  # Invert Z

# Display rotated atlas XZ projection (rotate 90 degrees clockwise)
ax_side.imshow(np.rot90(atlas.XZprojection, k=3), cmap='binary', aspect='equal')

# Create line segments for side view using same bilateral FC matrix
segments_side = []
edge_weights_side = []
for i, j, w in edges_filtered:
    segments_side.append([centroids_side[i], centroids_side[j]])
    edge_weights_side.append(w)

if len(segments_side) > 0:
    edge_weights_side = np.array(edge_weights_side)
    lc_side = LineCollection(
        segments_side,
        array=edge_weights_side,
        cmap='Reds',
        linewidths=0.5,
        alpha=0.7,
        zorder=1
    )
    lc_side.set_clim(0.2, 0.9)
    ax_side.add_collection(lc_side)

# Plot nodes for side view
ax_side.scatter(
    centroids_side[:, 0],
    centroids_side[:, 1],
    color='white',
    edgecolor='black',
    s=10,
    linewidths=0.5,
    zorder=10
)

# Set axis limits
ax_side.set_xlim([40, 359])
ax_side.set_ylim([850, 50])
ax_side.axis('off')

# Add annotation
ax_side.text(0.95, 0.95, 'Side', transform=ax_side.transAxes,
             fontsize=14, fontweight='bold', va='top', ha='right', color='black')

# ============================================================================
# Save Figure
# ============================================================================

figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()
print(f"Figure saved to {figure_path}")

# ============================================================================
# Compute and Save Statistics
# ============================================================================

weights = np.array([w for (_, _, w) in edges]) if len(edges) > 0 else np.array([])

statistics = {
    "n_regions_original": int(centroids_full.shape[0]),
    "n_regions_excluded": int(len(excluded_indices_bilateral)),
    "n_regions_per_hemisphere": int(num_regions_per_hemisphere),
    "n_regions_filtered": int(centroids_filtered.shape[0]),
    "fc_matrix_shape_original": list(fc_matrix.shape),
    "fc_matrix_shape_bilateral": list(fc_bilateral.shape),
    "fc_matrix_shape_filtered": list(fc_bilateral_filtered.shape),
    "n_edges_total": int(len(edges)),
    "n_edges_above_25th_percentile": int(len(edges_filtered)),
    "edge_weight_statistics": {
        "min": float(np.min(weights)) if len(weights) > 0 else None,
        "max": float(np.max(weights)) if len(weights) > 0 else None,
        "mean": float(np.mean(weights)) if len(weights) > 0 else None,
        "median": float(np.median(weights)) if len(weights) > 0 else None,
        "percentile_25": float(np.percentile(weights, 25)) if len(weights) > 0 else None,
        "percentile_75": float(np.percentile(weights, 75)) if len(weights) > 0 else None,
    },
    "spatial_extent": {
        "top_view_x_range": [65, 505],
        "top_view_y_range": [50, 850],
        "side_view_x_range": [40, 359],
        "side_view_y_range": [50, 850],
    },
    "centroid_statistics": {
        "x_mean": float(np.mean(centroids_filtered[:, 0])),
        "x_std": float(np.std(centroids_filtered[:, 0])),
        "y_mean": float(np.mean(centroids_filtered[:, 1])),
        "y_std": float(np.std(centroids_filtered[:, 1])),
        "z_mean": float(np.mean(centroids_filtered[:, 2])),
        "z_std": float(np.std(centroids_filtered[:, 2])),
    },
    "network_summary": {
        "description": "Functional connectivity network visualized on zebrafish brain atlas",
        "edges_displayed": "Top 75% by connection strength",
        "colormap": "Reds",
        "colormap_range": [0.2, 0.9]
    }
}

statistics_path = os.path.join(SAVE_DIR, "statistics.json")
with open(statistics_path, 'w') as f:
    json.dump(statistics, f, indent=2)
print(f"Statistics saved to {statistics_path}")
