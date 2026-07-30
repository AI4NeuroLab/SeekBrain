import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch

# Add shared toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ATLAS_PATH = os.getenv("ATLAS_PATH")

# Ensure output directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# Define module colors (purple, cyan, pale yellow, red)
MODULE_COLORS = {
    1: '#8A2BE2',  # Purple
    2: '#00CED1',  # Cyan
    3: '#F0E68C',  # Pale yellow
    4: '#FF0000'   # Red
}

# 1. Load Data
# Load module labels from reordered co-assignment matrix
module_labels_path = os.path.join(PROCESS_DATA_DIR, "Figure3_coassignment_matrix_SC_4module_ordered.npy")
module_labels = np.load(module_labels_path)

# Load excluded regions (these are single hemisphere IDs)
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path).astype(int)

# Initialize Atlas
atlas = MapzebrainAtlas(ATLAS_PATH)

# 2. Prepare Centroids
# Load left and right centroids
left_centroids = atlas.centroids['left']  # Shape: (N_regions, 3)
right_centroids = atlas.centroids['right']  # Shape: (N_regions, 3)

N_regions_per_hemisphere = left_centroids.shape[0]

# Concatenate to form bilateral centroids
bilateral_centroids = np.concatenate([left_centroids, right_centroids], axis=0)  # Shape: (2*N_regions, 3)

# Adjust y-coordinates to match image orientation (flip y-axis)
bilateral_centroids[:, 1] = 974 - bilateral_centroids[:, 1]

# Create exclusion mask for bilateral removal (both hemispheres)
# The excluded_regions are single hemisphere IDs, so we need to exclude both left and right
exclusion_mask = np.ones(bilateral_centroids.shape[0], dtype=bool)
for region_id in excluded_regions:
    if region_id < N_regions_per_hemisphere:
        exclusion_mask[region_id] = False  # Left hemisphere
        exclusion_mask[region_id + N_regions_per_hemisphere] = False  # Right hemisphere

# Apply exclusion mask
filtered_centroids = bilateral_centroids[exclusion_mask]

# 3. Validation and Alignment
# The module_labels should correspond to single-hemisphere regions (after exclusions)
# If module_labels has N entries, we expect N regions per hemisphere after exclusion
# Total filtered_centroids should be 2*N (bilateral)

N_labels = len(module_labels)
expected_bilateral_count = N_labels * 2

print(f"Module labels count: {N_labels}")
print(f"Filtered centroids count: {len(filtered_centroids)}")
print(f"Expected bilateral count: {expected_bilateral_count}")

# If there's a mismatch, the module labels are for single hemisphere only
# We need to duplicate module labels for bilateral visualization
if len(filtered_centroids) == expected_bilateral_count:
    # Double the module labels for bilateral visualization
    bilateral_module_labels = np.concatenate([module_labels, module_labels])
else:
    # If still mismatch, check if module_labels already bilateral
    if len(filtered_centroids) == N_labels:
        bilateral_module_labels = module_labels
    else:
        raise ValueError(f"Cannot align centroids ({len(filtered_centroids)}) with module labels ({N_labels})")

# Final validation
assert len(filtered_centroids) == len(bilateral_module_labels), \
    f"Final mismatch: {len(filtered_centroids)} centroids vs {len(bilateral_module_labels)} labels"

# Prepare colors for scatter plot
colors = [MODULE_COLORS[label] for label in bilateral_module_labels]

# 4. Load Atlas Projection Images
XY_projection = atlas.XYprojection
XZ_projection = atlas.XZprojection

# 5. Create Figure Layout
fig = plt.figure(figsize=(8, 6))
# Top view: 60% width, Side view: 40% width
ax_top = fig.add_axes([0.05, 0.1, 0.5, 0.8])  # [left, bottom, width, height]
ax_side = fig.add_axes([0.6, 0.1, 0.35, 0.8])

# 6. Plot Top View (XY)
ax_top.imshow(XY_projection, cmap='binary', aspect='equal')
ax_top.scatter(
    filtered_centroids[:, 0],
    filtered_centroids[:, 1],
    c=colors,
    s=60,
    alpha=0.8,
    edgecolors='black',
    linewidths=1
)
ax_top.set_xlim([65, 505])
ax_top.set_ylim([850, 50])  # Inverted y-axis
ax_top.axis('off')
ax_top.text(70, 840, 'Top', fontsize=14, color='black', va='top', ha='left')

# 7. Plot Side View (XZ)
# Transform centroids for side view: use (inverted_Z, Y) coordinates
# Invert Z-coordinate to match rotated view
side_centroids = np.zeros((filtered_centroids.shape[0], 2))
side_centroids[:, 0] = 359 - filtered_centroids[:, 2]  # Inverted Z
side_centroids[:, 1] = filtered_centroids[:, 1]  # Y

# Rotate XZ projection 90 degrees clockwise (k=3 means 270 degrees counterclockwise = 90 clockwise)
XZ_rotated = np.rot90(XZ_projection, k=3)

ax_side.imshow(XZ_rotated, cmap='binary', aspect='equal')
ax_side.scatter(
    side_centroids[:, 0],
    side_centroids[:, 1],
    c=colors,
    s=60,
    alpha=0.8,
    edgecolors='black',
    linewidths=1
)
ax_side.set_xlim([40, 359])
ax_side.set_ylim([850, 50])  # Matching Top View's vertical extent
ax_side.axis('off')
ax_side.text(45, 840, 'Side', fontsize=14, color='black', va='top', ha='left')

# 8. Add Custom Legend in Side View (top-right corner)
legend_x = 310
legend_y = 100
ax_side.text(legend_x, legend_y, 'Modules', fontsize=12, color='black', 
             va='top', ha='left', weight='bold')
for i, module_num in enumerate([1, 2, 3, 4]):
    y_offset = legend_y + 30 + i * 25
    ax_side.text(legend_x + 10, y_offset, str(module_num), 
                fontsize=11, color=MODULE_COLORS[module_num], 
                va='center', ha='left', weight='bold')

# 9. Add A-P Directional Arrow between panels
# Arrow position: between the two panels, near the bottom
arrow_x = 0.555  # Figure coordinates
arrow_y_bottom = 0.15
arrow_y_top = 0.25

arrow = FancyArrowPatch(
    (arrow_x, arrow_y_bottom), (arrow_x, arrow_y_top),
    transform=fig.transFigure,
    arrowstyle='<->',
    color='black',
    linewidth=2,
    mutation_scale=15
)
fig.patches.append(arrow)

# Add A and P labels
fig.text(arrow_x - 0.01, arrow_y_top + 0.01, 'A', fontsize=12, 
         color='black', ha='right', va='bottom', weight='bold')
fig.text(arrow_x - 0.01, arrow_y_bottom - 0.01, 'P', fontsize=12, 
         color='black', ha='right', va='top', weight='bold')

# Save figure
output_path = os.path.join(SAVE_DIR, 'figure.png')
plt.savefig(output_path, dpi=300, bbox_inches='tight')
plt.close()

# 10. Save Statistics
statistics = {
    "total_regions_before_exclusion": bilateral_centroids.shape[0],
    "excluded_regions_count": len(excluded_regions) * 2,  # Bilateral
    "total_regions_after_exclusion": len(filtered_centroids),
    "module_labels_input_count": int(N_labels),
    "bilateral_module_labels_count": int(len(bilateral_module_labels)),
    "module_counts": {
        "module_1": int(np.sum(bilateral_module_labels == 1)),
        "module_2": int(np.sum(bilateral_module_labels == 2)),
        "module_3": int(np.sum(bilateral_module_labels == 3)),
        "module_4": int(np.sum(bilateral_module_labels == 4))
    },
    "module_percentages": {
        "module_1": float(np.sum(bilateral_module_labels == 1) / len(bilateral_module_labels) * 100),
        "module_2": float(np.sum(bilateral_module_labels == 2) / len(bilateral_module_labels) * 100),
        "module_3": float(np.sum(bilateral_module_labels == 3) / len(bilateral_module_labels) * 100),
        "module_4": float(np.sum(bilateral_module_labels == 4) / len(bilateral_module_labels) * 100)
    },
    "centroid_ranges": {
        "x_range": [float(filtered_centroids[:, 0].min()), float(filtered_centroids[:, 0].max())],
        "y_range": [float(filtered_centroids[:, 1].min()), float(filtered_centroids[:, 1].max())],
        "z_range": [float(filtered_centroids[:, 2].min()), float(filtered_centroids[:, 2].max())]
    },
    "validation": {
        "centroids_match_labels": len(filtered_centroids) == len(bilateral_module_labels),
        "is_bilateral": len(filtered_centroids) == expected_bilateral_count
    }
}

stats_path = os.path.join(SAVE_DIR, 'statistics.json')
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"✅ Figure saved to {output_path}")
print(f"✅ Statistics saved to {stats_path}")
