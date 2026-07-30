import os
import sys
import numpy as np
import matplotlib.pyplot as plt
import json

# Add toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script

# Get environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# Step 1: Load data
# Load module labels from co-assignment matrix
module_labels_path = os.path.join(PROCESS_DATA_DIR, "Figure3_coassignment_matrix_SC_4module_ordered.npy")
module_labels = np.load(module_labels_path)

# Load undirected SC matrix
sc_matrix_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy")
sc_matrix = np.load(sc_matrix_path)

# Load excluded regions
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path).astype(int)

print(f"Original SC matrix shape: {sc_matrix.shape}")
print(f"Module labels shape: {module_labels.shape}")
print(f"Number of excluded regions: {len(excluded_regions)}")

# Step 2: Remove excluded regions from SC matrix
# Create mask for valid regions based on SC matrix dimensions
n_regions_sc = sc_matrix.shape[0]
valid_mask_sc = np.ones(n_regions_sc, dtype=bool)
valid_mask_sc[excluded_regions] = False

# Apply exclusions to SC matrix (remove rows and columns)
sc_matrix_filtered = sc_matrix[valid_mask_sc][:, valid_mask_sc]

# Step 2b: Handle module labels dimension mismatch
# The module labels are already filtered (65 elements) while SC matrix is 70x70
# We need to check if module_labels corresponds to the filtered SC matrix already
if len(module_labels) == sc_matrix_filtered.shape[0]:
    # Module labels are already aligned with filtered SC matrix
    module_labels_filtered = module_labels
    print(f"Module labels already filtered, using directly: {len(module_labels_filtered)} labels")
elif len(module_labels) == n_regions_sc:
    # Module labels need filtering
    module_labels_filtered = module_labels[valid_mask_sc]
    print(f"Filtered module labels: {len(module_labels_filtered)} labels")
else:
    raise ValueError(
        f"Module labels dimension ({len(module_labels)}) doesn't match "
        f"SC matrix ({n_regions_sc}) or filtered SC matrix ({sc_matrix_filtered.shape[0]})"
    )

# Validation checks
assert sc_matrix_filtered.shape[0] == sc_matrix_filtered.shape[1], \
    "SC matrix must be square after filtering"
assert sc_matrix_filtered.shape[0] == len(module_labels_filtered), \
    f"Matrix dimensions ({sc_matrix_filtered.shape[0]}) must match module labels ({len(module_labels_filtered)})"
assert not np.any(np.isnan(sc_matrix_filtered)), \
    "SC matrix should not contain NaN values"
assert not np.any(np.isinf(sc_matrix_filtered)), \
    "SC matrix should not contain Inf values"

print(f"Filtered SC matrix shape: {sc_matrix_filtered.shape}")
print(f"Filtered module labels shape: {len(module_labels_filtered)}")

# Step 3: Calculate element-wise square of the undirected SC matrix
sc_matrix_squared = sc_matrix_filtered ** 2

# Step 4: Sort matrix by module labels for visualization
sort_idx = np.argsort(module_labels_filtered)
sorted_matrix = sc_matrix_squared[sort_idx][:, sort_idx]
sorted_labels = module_labels_filtered[sort_idx]

# Find boundaries between modules
unique_modules = np.unique(sorted_labels)
n_modules = len(unique_modules)
module_boundaries = []
current_pos = 0
for module in unique_modules:
    module_size = np.sum(sorted_labels == module)
    module_boundaries.append((current_pos, current_pos + module_size))
    current_pos += module_size

print(f"Number of modules: {n_modules}")
print(f"Module boundaries: {module_boundaries}")

# Step 5: Create figure and plot
fig, ax = plt.subplots(figsize=(8, 8), dpi=300)

# Plot the squared SC matrix
im = ax.imshow(sorted_matrix, cmap='Purples', aspect='equal', interpolation='nearest')

# Draw thick black boxes around the 4 modules
for start, end in module_boundaries:
    rect = plt.Rectangle(
        (start - 0.5, start - 0.5), 
        end - start, 
        end - start,
        linewidth=3, 
        edgecolor='black', 
        facecolor='none'
    )
    ax.add_patch(rect)

# Add horizontal colorbar
cbar = plt.colorbar(im, ax=ax, orientation='horizontal', fraction=0.046, pad=0.08)
cbar.set_label('SC^2', fontsize=12)

# Hide x and y axis ticks and labels
ax.set_xticks([])
ax.set_yticks([])
ax.set_xticklabels([])
ax.set_yticklabels([])

# Set aspect to square
ax.set_aspect('equal')

plt.tight_layout()

# Save figure
output_figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(output_figure_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"Figure saved to: {output_figure_path}")

# Step 6: Collect and save statistics
statistics = {
    "original_matrix_shape": list(sc_matrix.shape),
    "n_excluded_regions": int(len(excluded_regions)),
    "filtered_matrix_shape": list(sc_matrix_filtered.shape),
    "n_modules": int(n_modules),
    "module_labels": [int(mod) for mod in unique_modules],
    "regions_per_module": {
        int(mod): int(np.sum(module_labels_filtered == mod)) 
        for mod in unique_modules
    },
    "sc_squared_statistics": {
        "min": float(np.min(sc_matrix_squared)),
        "max": float(np.max(sc_matrix_squared)),
        "mean": float(np.mean(sc_matrix_squared)),
        "median": float(np.median(sc_matrix_squared)),
        "std": float(np.std(sc_matrix_squared)),
        "percentile_25": float(np.percentile(sc_matrix_squared, 25)),
        "percentile_75": float(np.percentile(sc_matrix_squared, 75)),
        "percentile_90": float(np.percentile(sc_matrix_squared, 90)),
        "percentile_95": float(np.percentile(sc_matrix_squared, 95))
    },
    "module_boundaries": [(int(start), int(end)) for start, end in module_boundaries]
}

# Save statistics to JSON
statistics_path = os.path.join(SAVE_DIR, "statistics.json")
with open(statistics_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"Statistics saved to: {statistics_path}")
print("Processing complete.")
