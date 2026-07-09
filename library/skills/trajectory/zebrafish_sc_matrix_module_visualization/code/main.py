import os
import sys
import numpy as np
import matplotlib.pyplot as plt

# Add toolkit to path if external libraries are needed
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")

# Get environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
os.makedirs(SAVE_DIR, exist_ok=True)

def plot_matrix_communities(matrix, labels, ax=None, cmap='Purples', edge_color='black'):
    """
    Visualizes a matrix with community blocks highlighted using a specific style.
    Mimics the expected behavior of the library function if not importable.
    """
    if ax is None:
        ax = plt.gca()
        
    # Sort indices based on module labels to block-diagonalize the matrix
    sort_idx = np.argsort(labels)
    sorted_matrix = matrix[sort_idx][:, sort_idx]
    sorted_labels = labels[sort_idx]
    
    # Plot the heatmap
    im = ax.imshow(sorted_matrix, cmap=cmap, aspect='equal', interpolation='nearest')
    
    # Draw boundaries for modules
    unique_labels = np.unique(sorted_labels)
    current_pos = 0
    for label in unique_labels:
        # Determine the size of the current module
        module_size = np.sum(sorted_labels == label)
        
        # Draw a thick box around the module on the diagonal
        rect = plt.Rectangle(
            (current_pos - 0.5, current_pos - 0.5), 
            module_size, 
            module_size,
            linewidth=3, 
            edgecolor=edge_color, 
            facecolor='none'
        )
        ax.add_patch(rect)
        current_pos += module_size
        
    return im

# --- Step 1: Data Loading ---
# Load undirected SC matrix
sc_matrix_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy")
sc_matrix = np.load(sc_matrix_path)

# Load module labels
module_labels_path = os.path.join(PROCESS_DATA_DIR, "Figure3_coassignment_matrix_SC_4module_ordered.npy")
module_labels = np.load(module_labels_path)

# Load excluded regions
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path).astype(int)

# --- Step 2: Filter Data ---
# Create mask to exclude specific regions
n_regions_sc = sc_matrix.shape[0]
valid_mask = np.ones(n_regions_sc, dtype=bool)
valid_mask[excluded_regions] = False

# Filter SC matrix
sc_matrix_filtered = sc_matrix[valid_mask][:, valid_mask]

# Filter module labels to match the SC matrix dimensions
if len(module_labels) == n_regions_sc:
    module_labels_filtered = module_labels[valid_mask]
elif len(module_labels) == sc_matrix_filtered.shape[0]:
    # Labels already filtered
    module_labels_filtered = module_labels
else:
    raise ValueError(f"Module labels length ({len(module_labels)}) does not align with SC matrix.")

# --- Step 3: Transform Data ---
# Element-wise square to enhance contrast
sc_matrix_squared = sc_matrix_filtered ** 2

# --- Step 4: Visualization ---
fig, ax = plt.subplots(figsize=(8, 8), dpi=300)

# Use the function plot_matrix_communities as requested
im = plot_matrix_communities(
    sc_matrix_squared, 
    module_labels_filtered, 
    ax=ax, 
    cmap='Purples', 
    edge_color='black'
)

# Add horizontal colorbar
cbar = plt.colorbar(im, ax=ax, orientation='horizontal', fraction=0.046, pad=0.08)
cbar.set_label('SC^2', fontsize=12)

# Hide axis ticks and labels
ax.set_xticks([])
ax.set_yticks([])
ax.set_xticklabels([])
ax.set_yticklabels([])

# Save the refined figure
output_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(output_path, bbox_inches='tight', dpi=300)
plt.close()

print(f"Refined figure saved to {output_path}")
