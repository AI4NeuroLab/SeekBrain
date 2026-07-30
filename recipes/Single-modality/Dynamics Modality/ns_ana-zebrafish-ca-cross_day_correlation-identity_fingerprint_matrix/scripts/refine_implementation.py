import os
import sys
import numpy as np
import matplotlib.pyplot as plt
import json

# Add library path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *

# Get environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure output directories exist
os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# =========================================================================
# 1. Load FC matrices for 6dpf and 7dpf
# =========================================================================
fc_6dpf_path = os.path.join(ZEBRAFISH_PATH, "Files", "FC_matrices_fingerprinting_6dpf.npy")
fc_7dpf_path = os.path.join(ZEBRAFISH_PATH, "Files", "FC_matrices_fingerprinting_7dpf.npy")

fc_6dpf = np.load(fc_6dpf_path, allow_pickle=False)  # Shape: [N_subjects, N_regions, N_regions]
fc_7dpf = np.load(fc_7dpf_path, allow_pickle=False)  # Shape: [N_subjects, N_regions, N_regions]

# Validation: ensure same number of subjects
N_subjects = fc_6dpf.shape[0]
assert fc_6dpf.shape[0] == fc_7dpf.shape[0], "Mismatch in number of subjects between 6dpf and 7dpf"
assert fc_6dpf.shape[1] == fc_6dpf.shape[2], "FC matrix must be square"
assert fc_7dpf.shape[1] == fc_7dpf.shape[2], "FC matrix must be square"

N_regions = fc_6dpf.shape[1]

# =========================================================================
# 2. Vectorize upper triangular components (exclude diagonal)
# =========================================================================
def vectorize_upper_triangle(matrix, k=1):
    """Extract upper triangle (excluding diagonal) as 1D vector."""
    iu = np.triu_indices(matrix.shape[0], k=k)
    return matrix[iu].astype(float)

# Vectorize each FC matrix
fc_6dpf_vectors = np.array([vectorize_upper_triangle(fc_6dpf[i], k=1) for i in range(N_subjects)])
fc_7dpf_vectors = np.array([vectorize_upper_triangle(fc_7dpf[i], k=1) for i in range(N_subjects)])

# =========================================================================
# 3. Compute similarity matrix (Pearson correlation between 6dpf and 7dpf)
# =========================================================================
def safe_corrcoef(vec_a, vec_b):
    """Compute Pearson correlation handling NaNs."""
    mask = np.isfinite(vec_a) & np.isfinite(vec_b)
    if mask.sum() < 3:
        return np.nan
    return np.corrcoef(vec_a[mask], vec_b[mask])[0, 1]

# Build correlation matrix: rows = 6dpf subjects, cols = 7dpf subjects
similarity_matrix = np.zeros((N_subjects, N_subjects), dtype=float)
for i in range(N_subjects):
    for j in range(N_subjects):
        similarity_matrix[i, j] = safe_corrcoef(fc_6dpf_vectors[i], fc_7dpf_vectors[j])

# =========================================================================
# 4. Create symmetric matrix by averaging correlation in both directions
# =========================================================================
symmetric_similarity = 0.5 * (similarity_matrix + similarity_matrix.T)

# Validation: check symmetry
assert np.allclose(symmetric_similarity, symmetric_similarity.T, rtol=1e-5, atol=1e-8), \
    "Symmetric similarity matrix is not symmetric"

# Save the symmetric similarity matrix
output_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_fingerprinting.npy")
np.save(output_path, symmetric_similarity)

# =========================================================================
# 5. Identify maximal similarity on each row (for asterisks)
# =========================================================================
max_indices = np.argmax(symmetric_similarity, axis=1)

# =========================================================================
# 6. Visualization: Plot symmetric FC similarity matrix
# =========================================================================
fig, ax = plt.subplots(figsize=(6, 5))

# Plot heatmap
im = ax.imshow(symmetric_similarity, cmap='Reds', vmin=0.60, vmax=0.85, aspect='equal')

# Colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("FC similarity", fontsize=12)

# Add white asterisks at max similarity positions for each row
for row_idx in range(N_subjects):
    col_idx = max_indices[row_idx]
    ax.text(col_idx, row_idx, '*', color='white', fontsize=14, 
            ha='center', va='center', fontweight='bold')

# Axis labels and ticks
fish_ids = np.arange(1, N_subjects + 1)
ax.set_xticks(np.arange(N_subjects))
ax.set_yticks(np.arange(N_subjects))
ax.set_xticklabels(fish_ids, fontsize=10)
ax.set_yticklabels(fish_ids, fontsize=10)
ax.set_ylabel("Larvae", fontsize=12)
ax.set_xlabel("Larvae", fontsize=12)

plt.tight_layout()

# Save figure (refined name)
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=300)
plt.close()

# =========================================================================
# 7. Compute and save statistics
# =========================================================================
# Diagonal values: same fish across days (within-fish similarity)
within_fish_similarity = np.diag(symmetric_similarity)

# Off-diagonal values: different fish (between-fish similarity)
off_diag_mask = ~np.eye(N_subjects, dtype=bool)
between_fish_similarity = symmetric_similarity[off_diag_mask]
between_fish_similarity = between_fish_similarity[np.isfinite(between_fish_similarity)]

# Compute statistics
stats = {
    "n_subjects": int(N_subjects),
    "n_regions": int(N_regions),
    "within_fish_similarity": {
        "mean": float(np.nanmean(within_fish_similarity)),
        "std": float(np.nanstd(within_fish_similarity)),
        "median": float(np.nanmedian(within_fish_similarity)),
        "min": float(np.nanmin(within_fish_similarity)),
        "max": float(np.nanmax(within_fish_similarity)),
        "values": within_fish_similarity.tolist()
    },
    "between_fish_similarity": {
        "mean": float(np.nanmean(between_fish_similarity)),
        "std": float(np.nanstd(between_fish_similarity)),
        "median": float(np.nanmedian(between_fish_similarity)),
        "min": float(np.nanmin(between_fish_similarity)),
        "max": float(np.nanmax(between_fish_similarity)),
        "n_values": int(len(between_fish_similarity))
    },
    "diagonal_accuracy": {
        "correct_identifications": int(np.sum(max_indices == np.arange(N_subjects))),
        "accuracy": float(np.mean(max_indices == np.arange(N_subjects)))
    },
    "similarity_matrix_range": {
        "min": float(np.nanmin(symmetric_similarity)),
        "max": float(np.nanmax(symmetric_similarity)),
        "mean": float(np.nanmean(symmetric_similarity)),
        "std": float(np.nanstd(symmetric_similarity))
    }
}

# Save statistics to JSON
stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(stats, f, indent=2)

print(f"✅ Figure saved to: {figure_path}")
print(f"✅ Symmetric similarity matrix saved to: {output_path}")
print(f"✅ Statistics saved to: {stats_path}")
print(f"Number of subjects: {N_subjects}")
print(f"Within-fish similarity (mean±std): {stats['within_fish_similarity']['mean']:.3f}±{stats['within_fish_similarity']['std']:.3f}")
print(f"Between-fish similarity (mean±std): {stats['between_fish_similarity']['mean']:.3f}±{stats['between_fish_similarity']['std']:.3f}")
print(f"Identification accuracy: {stats['diagonal_accuracy']['accuracy']*100:.1f}%")
