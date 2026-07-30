import os
import sys
import numpy as np
import matplotlib.pyplot as plt
import matplotlib as mpl
from matplotlib.patches import Rectangle
from scipy.cluster.hierarchy import linkage, fcluster, dendrogram
from scipy.spatial.distance import squareform
import json

# Import shared utilities
sys.path.append("<data-root>")
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *

# Environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

statistics = {}

# ============================================================================
# 1. Data Loading & Exclusions
# ============================================================================
print("Loading SC matrix and exclusion list...")
sc_matrix_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_directed_terminals_expanded.npy")
SC_matrix = np.load(sc_matrix_path)

excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path).astype(int)

# Remove excluded regions
num_regions = SC_matrix.shape[0]
keep_mask = np.ones(num_regions, dtype=bool)
keep_mask[excluded_regions] = False
SC_matrix_filtered = SC_matrix[keep_mask][:, keep_mask]

# ============================================================================
# 2. Consensus Clustering
# ============================================================================
print("Computing co-assignment probability matrix...")
coassignment_matrix = compute_coassignment_probability(
    SC_matrix_filtered,
    N_iters=10000,
    gamma_min=0.7,
    gamma_max=2.2,
    threshold=False
)
# Fix: Ensure diagonal is 1.0
np.fill_diagonal(coassignment_matrix, 1.0)

save_path_coass = os.path.join(PROCESS_DATA_DIR, "Figure3_coassignment_matrix_SC.npy")
np.save(save_path_coass, coassignment_matrix)

# ============================================================================
# 3. Hierarchical Clustering
# ============================================================================
print("Performing hierarchical clustering...")
D = 1 - coassignment_matrix
D[D < 0] = 0
D_condensed = squareform(D, checks=False)
Z = linkage(D_condensed, method='ward')

n_clusters = 4
communities = fcluster(Z, t=n_clusters, criterion='maxclust')

save_path_comm = os.path.join(PROCESS_DATA_DIR, "Figure3_coassignment_matrix_SC_4module.npy")
np.save(save_path_comm, communities)

# ============================================================================
# 4. Reorder Modules (Anterior-Posterior)
# ============================================================================
print("Reordering modules...")
communities_ordered = reorder_clusters_anteroposterior(communities)

save_path_ordered = os.path.join(PROCESS_DATA_DIR, "Figure3_coassignment_matrix_SC_4module_ordered.npy")
np.save(save_path_ordered, communities_ordered)

# ============================================================================
# 5. Visualization
# ============================================================================
print("Creating visualization...")
fig = plt.figure(figsize=(10, 8))

ax_dendro = fig.add_axes([0.05, 0.15, 0.15, 0.7])
ax_matrix = fig.add_axes([0.25, 0.15, 0.6, 0.7])
ax_cbar = fig.add_axes([0.87, 0.15, 0.02, 0.7])

# Color Setup: Map Module ID -> Color
# Assuming communities_ordered uses IDs 1..4
module_ids = np.sort(np.unique(communities_ordered))
colors_hex = ['red', '#ADFF2F', 'cyan', '#9370DB'] # Red, Light Yellow-Green, Cyan, Purple
color_map = {m_id: col for m_id, col in zip(module_ids, colors_hex)}

# Define custom link color function for dendrogram
# Map each leaf to its module color, and nodes to color if children match
n_leaves = len(communities_ordered)
link_colors = {}
for i in range(n_leaves):
    link_colors[i] = color_map.get(communities_ordered[i], 'black')

for i, (c1, c2, _, _) in enumerate(Z):
    idx = n_leaves + i
    col1 = link_colors.get(int(c1))
    col2 = link_colors.get(int(c2))
    if col1 == col2 and col1 is not None:
        link_colors[idx] = col1
    else:
        link_colors[idx] = None # Mixed/Black

def link_color_func(k):
    return link_colors.get(k) if link_colors.get(k) is not None else 'black'

# Plot Dendrogram (Left Axis)
# orientation='left' puts root on right, leaves on left.
dend_data = dendrogram(
    Z,
    ax=ax_dendro,
    orientation='left',
    link_color_func=link_color_func,
    above_threshold_color='black',
    no_labels=True
)

# Style Dendrogram
ax_dendro.axis('off')
# Set line width for all lines (specifically requested 0.5 for black lines)
plt.setp(ax_dendro.lines, linewidth=0.5)
# Invert Y-axis so leaf 0 is at the top, matching matrix row 0
ax_dendro.invert_yaxis()

# Reorder Matrix and Communities based on Dendrogram Leaves
leaves = dend_data['leaves']
matrix_reordered = coassignment_matrix[leaves][:, leaves]
communities_reordered = communities_ordered[leaves]

# Plot Matrix (Main Axis)
im = ax_matrix.imshow(matrix_reordered, cmap='gray', aspect='auto', vmin=0, vmax=1)
ax_matrix.axis('off')

# Draw Thick Boxes
# Identify contiguous blocks of modules in the reordered list
current_module = communities_reordered[0]
start_idx = 0
for i, mod_id in enumerate(communities_reordered):
    if mod_id != current_module:
        # Draw box for previous block
        size = i - start_idx
        rect = Rectangle(
            (start_idx - 0.5, start_idx - 0.5), size, size,
            linewidth=2.5, edgecolor=color_map.get(current_module, 'black'), facecolor='none'
        )
        ax_matrix.add_patch(rect)
        
        current_module = mod_id
        start_idx = i

# Draw last box
size = len(communities_reordered) - start_idx
rect = Rectangle(
    (start_idx - 0.5, start_idx - 0.5), size, size,
    linewidth=2.5, edgecolor=color_map.get(current_module, 'black'), facecolor='none'
)
ax_matrix.add_patch(rect)

# Add Colorbar
cbar = plt.colorbar(im, cax=ax_cbar)
cbar.set_label('Coass. prob.', rotation=270, labelpad=15)

# Save
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
print(f"Figure saved to {figure_path}")
