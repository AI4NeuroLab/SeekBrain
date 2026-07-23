import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from scipy.ndimage import rotate

# Add toolkit path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")
from zebrafish_Ca_utils import MapzebrainAtlas

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH", "/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data/dataverse_files")
ATLAS_PATH = os.path.join(ZEBRAFISH_PATH, "Atlas")
FILES_PATH = os.path.join(ZEBRAFISH_PATH, "Files")

# Load SC matrix
sc_path = os.path.join(FILES_PATH, "SC_matrix_undirected_terminals_expanded.npy")
SC_matrix = np.load(sc_path)

# Load excluded regions
excluded_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_path).astype(int)

# Load atlas
atlas = MapzebrainAtlas(ATLAS_PATH)

# Get centroids for left and right hemispheres
left_centroids = atlas.centroids['left']
right_centroids = atlas.centroids['right']

# Concatenate left and right centroids
centroids_full = np.concatenate([left_centroids, right_centroids], axis=0)

# Create bilateral SC matrix by tiling
bilateral_SC = np.tile(SC_matrix, (2, 2))

# Remove excluded regions from both centroids and SC matrix
# Excluded regions apply to both hemispheres
n_regions_per_hemisphere = SC_matrix.shape[0]
excluded_bilateral = np.concatenate([excluded_regions, excluded_regions + n_regions_per_hemisphere])

# Create keep mask
keep_mask = np.ones(bilateral_SC.shape[0], dtype=bool)
keep_mask[excluded_bilateral] = False

# Filter centroids and SC matrix
centroids_filtered = centroids_full[keep_mask]
bilateral_SC_filtered = bilateral_SC[keep_mask][:, keep_mask]

# Flip y-coordinate for top view
TOP_VIEW_Y_MAX = 974
centroids_filtered = centroids_filtered.copy()
centroids_filtered[:, 1] = TOP_VIEW_Y_MAX - centroids_filtered[:, 1]

# Validation checks
assert bilateral_SC_filtered.shape[0] == bilateral_SC_filtered.shape[1] == len(centroids_filtered), \
    "Mismatch between SC matrix and centroids dimensions"

# Load atlas projection images
from PIL import Image
xy_img = np.array(Image.open(os.path.join(ATLAS_PATH, "XY_H2BGCaMP6s.tif")))
xz_img = np.array(Image.open(os.path.join(ATLAS_PATH, "XZ_H2BGCaMP6s.tif")))

# Prepare edges for network visualization
# Remove diagonal
bilateral_SC_filtered_no_diag = bilateral_SC_filtered.copy()
np.fill_diagonal(bilateral_SC_filtered_no_diag, 0)

# Get non-zero weights
edges = []
for i in range(bilateral_SC_filtered_no_diag.shape[0]):
    for j in range(i+1, bilateral_SC_filtered_no_diag.shape[0]):
        weight = bilateral_SC_filtered_no_diag[i, j]
        if not np.isnan(weight) and weight > 0:
            edges.append((i, j, float(weight)))

# Calculate bottom quartile threshold
if edges:
    weights = np.array([w for _, _, w in edges])
    threshold = np.percentile(weights, 25)
    
    # Filter edges above bottom quartile
    filtered_edges = [(i, j, w) for i, j, w in edges if w >= threshold]
    
    # Sort by weight for plotting (stronger on top)
    filtered_edges.sort(key=lambda x: x[2])
else:
    filtered_edges = []

# Create figure with custom layout
fig = plt.figure(figsize=(8, 6))

# Create axes: Top view (60% width), Side view (40% width)
ax_top = fig.add_axes([0.05, 0.1, 0.55, 0.85])  # [left, bottom, width, height]
ax_side = fig.add_axes([0.62, 0.1, 0.35, 0.85])

# --- TOP VIEW (XY) ---
ax_top.imshow(xy_img, cmap='binary', aspect='equal', extent=[0, xy_img.shape[1], xy_img.shape[0], 0])

# Draw edges
if filtered_edges:
    edge_positions = []
    edge_weights = []
    for i, j, w in filtered_edges:
        pos_i = centroids_filtered[i][:2]  # x, y
        pos_j = centroids_filtered[j][:2]
        edge_positions.append([pos_i, pos_j])
        edge_weights.append(w)
    
    edge_weights = np.array(edge_weights)
    # Normalize weights to [0, 1] for colormap
    edge_colors = (edge_weights - edge_weights.min()) / (edge_weights.max() - edge_weights.min() + 1e-10)
    
    # Create line collection with Blues_r colormap (flipped Blues)
    lc = LineCollection(edge_positions, array=edge_colors, cmap='Blues_r', 
                        linewidths=0.8, alpha=1.0, zorder=1)
    lc.set_clim(0, 1)
    ax_top.add_collection(lc)

# Draw nodes
ax_top.scatter(centroids_filtered[:, 0], centroids_filtered[:, 1], 
               s=10, facecolors='white', edgecolors='black', linewidths=0.5, zorder=10)

ax_top.set_xlim(65, 505)
ax_top.set_ylim(850, 50)  # Inverted
ax_top.axis('off')

# Add label "Top"
ax_top.text(0.05, 0.95, 'Top', transform=ax_top.transAxes, 
            fontsize=14, fontweight='bold', va='top', ha='left', color='black')

# Add 100 μm scale bar at lower-right
scale_bar_length_um = 100
# Assuming 1 pixel ≈ 0.8 μm (typical for zebrafish atlas)
pixels_per_um = 1 / 0.8
scale_bar_length_pixels = scale_bar_length_um * pixels_per_um

bar_x_start = 480
bar_y = 830
ax_top.plot([bar_x_start, bar_x_start + scale_bar_length_pixels], [bar_y, bar_y], 
            'k-', linewidth=3)
ax_top.text(bar_x_start + scale_bar_length_pixels/2, bar_y - 15, '100 μm', 
            ha='center', va='top', fontsize=10, color='black')

# --- SIDE VIEW (XZ) ---
# Rotate XZ image 90 degrees clockwise
xz_rotated = rotate(xz_img, -90, reshape=True)
ax_side.imshow(xz_rotated, cmap='binary', aspect='equal', extent=[0, xz_rotated.shape[1], xz_rotated.shape[0], 0])

# Transform centroids for side view: invert Z, use Y
SIDE_VIEW_Z_MAX = 359
centroids_side = centroids_filtered.copy()
centroids_side[:, 0] = SIDE_VIEW_Z_MAX - centroids_filtered[:, 2]  # x = -z (inverted)
centroids_side[:, 1] = centroids_filtered[:, 1]  # y = y

# Draw edges (side view)
if filtered_edges:
    edge_positions_side = []
    for i, j, w in filtered_edges:
        pos_i = centroids_side[i][:2]
        pos_j = centroids_side[j][:2]
        edge_positions_side.append([pos_i, pos_j])
    
    lc_side = LineCollection(edge_positions_side, array=edge_colors, cmap='Blues_r', 
                             linewidths=0.8, alpha=1.0, zorder=1)
    lc_side.set_clim(0, 1)
    ax_side.add_collection(lc_side)

# Draw nodes (side view)
ax_side.scatter(centroids_side[:, 0], centroids_side[:, 1], 
                s=10, facecolors='white', edgecolors='black', linewidths=0.5, zorder=10)

ax_side.set_xlim(40, 359)
ax_side.set_ylim(850, 50)  # Match top view vertical extent
ax_side.axis('off')

# Add label "Side"
ax_side.text(0.95, 0.95, 'Side', transform=ax_side.transAxes, 
             fontsize=14, fontweight='bold', va='top', ha='right', color='black')

# Save figure
output_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(output_path, dpi=300, bbox_inches='tight')
plt.close()

# Save statistics
statistics = {
    "total_regions": int(bilateral_SC.shape[0]),
    "excluded_regions": int(len(excluded_bilateral)),
    "filtered_regions": int(len(centroids_filtered)),
    "sc_matrix_shape": list(bilateral_SC_filtered.shape),
    "total_edges": len(edges),
    "filtered_edges_above_25th_percentile": len(filtered_edges),
    "edge_weight_stats": {
        "min": float(weights.min()) if len(weights) > 0 else None,
        "max": float(weights.max()) if len(weights) > 0 else None,
        "mean": float(weights.mean()) if len(weights) > 0 else None,
        "median": float(np.median(weights)) if len(weights) > 0 else None,
        "25th_percentile": float(threshold) if len(weights) > 0 else None
    },
    "centroids_range": {
        "x_min": float(centroids_filtered[:, 0].min()),
        "x_max": float(centroids_filtered[:, 0].max()),
        "y_min": float(centroids_filtered[:, 1].min()),
        "y_max": float(centroids_filtered[:, 1].max()),
        "z_min": float(centroids_filtered[:, 2].min()),
        "z_max": float(centroids_filtered[:, 2].max())
    }
}

stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"Figure saved to {output_path}")
print(f"Statistics saved to {stats_path}")
