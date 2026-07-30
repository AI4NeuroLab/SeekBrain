import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr

# Add shared toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure output directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# 1. Load Data & Preprocess
# ============================================================================
# Load functional connectivity matrices
fc_matrices_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrices.npy")
fc_matrices = np.load(fc_matrices_path, allow_pickle=True)

# Replace NaN values with 0
fc_matrices = np.nan_to_num(fc_matrices, nan=0.0)

# Get number of larvae and create identifiers
n_larvae = fc_matrices.shape[0]
fish_ids = [f"Fish {i+1}" for i in range(n_larvae)]

print(f"Loaded {n_larvae} FC matrices with shape {fc_matrices.shape}")

# ============================================================================
# 2. Compute Initial Network Similarity
# ============================================================================
# Extract upper triangle (excluding diagonal) for each FC matrix
def vectorize_upper_triangle(matrix, k=1):
    """Extract upper triangle of matrix as 1D vector."""
    n = matrix.shape[0]
    iu = np.triu_indices(n, k=k)
    return matrix[iu].astype(float)

# Vectorize each FC matrix
fc_vectors = []
for i in range(n_larvae):
    vec = vectorize_upper_triangle(fc_matrices[i], k=1)
    fc_vectors.append(vec)

fc_vectors = np.array(fc_vectors)

# Compute pairwise Pearson correlation between larvae
initial_similarity_matrix = np.zeros((n_larvae, n_larvae))
for i in range(n_larvae):
    for j in range(n_larvae):
        # Filter out non-finite values
        vec_i = fc_vectors[i]
        vec_j = fc_vectors[j]
        valid_mask = np.isfinite(vec_i) & np.isfinite(vec_j)
        
        if valid_mask.sum() >= 3:
            r, _ = pearsonr(vec_i[valid_mask], vec_j[valid_mask])
            initial_similarity_matrix[i, j] = r
        else:
            initial_similarity_matrix[i, j] = np.nan

print("Computed initial network similarity matrix")

# ============================================================================
# 3. Order the Network Similarity Matrix
# ============================================================================
# Calculate mean similarity for each larva (row mean)
mean_similarity = np.nanmean(initial_similarity_matrix, axis=1)

# Sort indices by mean similarity in descending order
sorted_indices = np.argsort(mean_similarity)[::-1]

# Reorder fish IDs
ordered_fish_ids = [fish_ids[i] for i in sorted_indices]

# Save ordered fish IDs
ordered_fish_ids_array = np.array(ordered_fish_ids)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_network_similarity_larvaID.npy"), 
        ordered_fish_ids_array)

print(f"Saved ordered fish IDs to {PROCESS_DATA_DIR}")

# ============================================================================
# 4. Recalculate Ordered Network Similarity Matrix
# ============================================================================
# Reorder similarity matrix rows and columns
ordered_similarity_matrix = initial_similarity_matrix[sorted_indices, :][:, sorted_indices]

# Save ordered similarity matrix
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_network_similarity_across_larvae.npy"),
        ordered_similarity_matrix)

print(f"Saved ordered similarity matrix to {PROCESS_DATA_DIR}")

# ============================================================================
# 5. Compute Statistics
# ============================================================================
# Calculate average Pearson's r across all larvae (excluding diagonal)
mask = ~np.eye(n_larvae, dtype=bool)
valid_correlations = ordered_similarity_matrix[mask]
valid_correlations = valid_correlations[np.isfinite(valid_correlations)]

average_r = np.mean(valid_correlations)
std_r = np.std(valid_correlations)
min_r = np.min(valid_correlations)
max_r = np.max(valid_correlations)
median_r = np.median(valid_correlations)

print(f"Average Pearson's r across larvae: {average_r:.4f}")
print(f"Standard deviation: {std_r:.4f}")
print(f"Range: [{min_r:.4f}, {max_r:.4f}]")

# Save statistics to JSON
statistics = {
    "n_larvae": int(n_larvae),
    "average_pearson_r": float(average_r),
    "std_pearson_r": float(std_r),
    "min_pearson_r": float(min_r),
    "max_pearson_r": float(max_r),
    "median_pearson_r": float(median_r),
    "n_valid_comparisons": int(len(valid_correlations)),
    "percentile_25": float(np.percentile(valid_correlations, 25)),
    "percentile_75": float(np.percentile(valid_correlations, 75))
}

with open(os.path.join(SAVE_DIR, "statistics.json"), "w") as f:
    json.dump(statistics, f, indent=2)

print(f"Saved statistics to {SAVE_DIR}/statistics.json")

# ============================================================================
# 6. Visualization
# ============================================================================
# Create figure
fig, ax = plt.subplots(figsize=(8, 7))

# Create lower triangle mask (show lower triangle + diagonal)
mask_upper = np.triu(np.ones_like(ordered_similarity_matrix, dtype=bool), k=1)
plot_matrix = ordered_similarity_matrix.copy()
plot_matrix[mask_upper] = np.nan

# Plot heatmap
im = ax.imshow(plot_matrix, cmap='Reds', vmin=0.25, vmax=0.80, aspect='auto')

# Add colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("FC similarity", rotation=270, labelpad=20)

# Set ticks and labels
tick_positions = np.arange(n_larvae)
ax.set_xticks(tick_positions)
ax.set_yticks(tick_positions)

# Create numeric labels for ordered fish
ordered_fish_numbers = [str(sorted_indices[i] + 1) for i in range(n_larvae)]
ax.set_xticklabels(ordered_fish_numbers, fontsize=8)
ax.set_yticklabels(ordered_fish_numbers, fontsize=8)

# Add axis labels
ax.set_ylabel("Larvae", fontsize=12)
ax.set_xlabel("Larvae", fontsize=12)

# Remove standard ticks and spines
ax.tick_params(which='both', length=0)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Add title
ax.set_title(f"FC Network Similarity Across Larvae (n={n_larvae})", 
             fontsize=14, pad=15)

plt.tight_layout()

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"Saved figure to {figure_path}")
print("Analysis complete!")
