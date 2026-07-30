import os
import sys
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

os.makedirs(SAVE_DIR, exist_ok=True)

# Define module colors (purple, cyan, pale yellow, red)
MODULE_COLORS = {
    1: '#8A2BE2',  # Purple
    2: '#00CED1',  # Cyan
    3: '#F0E68C',  # Pale yellow
    4: '#FF0000'   # Red
}

def run_visualization():
    # 1. Load Data
    # Load module labels
    module_labels_path = os.path.join(PROCESS_DATA_DIR, "Figure3_coassignment_matrix_SC_4module_ordered.npy")
    module_labels = np.load(module_labels_path)

    # Load excluded regions
    excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
    excluded_regions = np.load(excluded_regions_path).astype(int)

    # Initialize Atlas
    atlas = MapzebrainAtlas(ATLAS_PATH)

    # 2. Prepare Centroids
    left_centroids = atlas.centroids['left']
    right_centroids = atlas.centroids['right']
    
    N_regions_per_hemisphere = left_centroids.shape[0]

    # Concatenate to form bilateral centroids
    bilateral_centroids = np.concatenate([left_centroids, right_centroids], axis=0)

    # Adjust y-coordinates to match image orientation (flip y-axis)
    bilateral_centroids[:, 1] = 974 - bilateral_centroids[:, 1]

    # Create exclusion mask for bilateral removal
    exclusion_mask = np.ones(bilateral_centroids.shape[0], dtype=bool)
    for region_id in excluded_regions:
        if region_id < N_regions_per_hemisphere:
            exclusion_mask[region_id] = False
            exclusion_mask[region_id + N_regions_per_hemisphere] = False

    filtered_centroids = bilateral_centroids[exclusion_mask]

    # 3. Prepare Colors
    # Double the module labels for bilateral visualization
    # Ensure lengths match
    if len(module_labels) == len(filtered_centroids) // 2:
        bilateral_module_labels = np.concatenate([module_labels, module_labels])
    elif len(module_labels) == len(filtered_centroids):
        bilateral_module_labels = module_labels
    else:
        # Fallback assumption
        bilateral_module_labels = np.concatenate([module_labels, module_labels])

    bilateral_colors = [MODULE_COLORS[l] for l in bilateral_module_labels]

    # 4. Load Atlas Projection Images
    XY_projection = atlas.XYprojection
    
    # Use YZprojection for Side View (Sagittal) to ensure correct anatomy
    # Fallback to XZ only if YZ is missing, though YZ is standard for side view
    if hasattr(atlas, 'YZprojection'):
        Side_projection_raw = atlas.YZprojection
    else:
        print("Warning: YZprojection not found, falling back to XZprojection.")
        Side_projection_raw = atlas.XZprojection

    # 5. Create Figure Layout
    fig = plt.figure(figsize=(8, 6))
    ax_top = fig.add_axes([0.05, 0.1, 0.5, 0.8])  # [left, bottom, width, height]
    ax_side = fig.add_axes([0.6, 0.1, 0.35, 0.8])

    # 6. Plot Top View (XY)
    ax_top.imshow(XY_projection, cmap='binary', aspect='equal')
    ax_top.scatter(
        filtered_centroids[:, 0],
        filtered_centroids[:, 1],
        c=bilateral_colors,
        s=60,
        alpha=0.8,
        edgecolors='black',
        linewidths=1
    )
    ax_top.set_xlim([65, 505])
    ax_top.set_ylim([850, 50])  # Inverted y-axis
    ax_top.axis('off')
    ax_top.text(70, 840, 'Top', fontsize=14, color='black', va='top', ha='left')

    # 7. Plot Side View (Sagittal)
    # Transform centroids: X_plot = 359 - Z (inverted Z), Y_plot = Y
    side_centroids = np.zeros((filtered_centroids.shape[0], 2))
    side_centroids[:, 0] = 359 - filtered_centroids[:, 2]  # Inverted Z mapped to X axis
    side_centroids[:, 1] = filtered_centroids[:, 1]        # Y (already inverted) mapped to Y axis

    # Rotate Side Projection 90 degrees clockwise
    # YZ Projection: usually (Z, Y). 
    # rot90(k=3) -> (Y, Z_inv). Matches Y-vertical and Z-horizontal.
    Side_rotated = np.rot90(Side_projection_raw, k=3)

    ax_side.imshow(Side_rotated, cmap='binary', aspect='equal')
    ax_side.scatter(
        side_centroids[:, 0],
        side_centroids[:, 1],
        c=bilateral_colors,
        s=60,
        alpha=0.8,
        edgecolors='black',
        linewidths=1
    )
    ax_side.set_xlim([40, 359])
    ax_side.set_ylim([850, 50])  # Matches Top View vertical
    ax_side.axis('off')
    ax_side.text(45, 840, 'Side', fontsize=14, color='black', va='top', ha='left')

    # 8. Add Legend
    legend_x = 310
    legend_y = 100
    ax_side.text(legend_x, legend_y, 'Modules', fontsize=12, color='black', 
                 va='top', ha='left', weight='bold')
    for i, module_num in enumerate([1, 2, 3, 4]):
        # Increased spacing for clarity
        y_offset = legend_y + 30 + i * 30
        ax_side.text(legend_x + 10, y_offset, str(module_num), 
                    fontsize=12, color=MODULE_COLORS[module_num], 
                    va='center', ha='left', weight='bold')

    # 9. Add A-P Arrow
    arrow_x = 0.555
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
    fig.text(arrow_x - 0.01, arrow_y_top + 0.01, 'A', fontsize=12, 
             color='black', ha='right', va='bottom', weight='bold')
    fig.text(arrow_x - 0.01, arrow_y_bottom - 0.01, 'P', fontsize=12, 
             color='black', ha='right', va='top', weight='bold')

    # Save figure
    output_path = os.path.join(SAVE_DIR, 'figure_refine.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure saved to {output_path}")

if __name__ == "__main__":
    run_visualization()
