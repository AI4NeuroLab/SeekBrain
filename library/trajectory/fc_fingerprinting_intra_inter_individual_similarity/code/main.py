import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import mannwhitneyu

# Environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ROOT_DIR = "/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data/dataverse_files"

# Ensure output directories exist
os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# Load FC matrices for both time points
fc_6dpf_path = os.path.join(ROOT_DIR, "Files", "FC_matrices_fingerprinting_6dpf.npy")
fc_7dpf_path = os.path.join(ROOT_DIR, "Files", "FC_matrices_fingerprinting_7dpf.npy")

fc_6dpf = np.load(fc_6dpf_path)  # Shape: (n_larvae, n_regions, n_regions)
fc_7dpf = np.load(fc_7dpf_path)  # Shape: (n_larvae, n_regions, n_regions)

# Validate shapes
assert fc_6dpf.shape == fc_7dpf.shape, "FC matrices must have the same shape"
n_larvae = fc_6dpf.shape[0]

# Vectorize upper triangle of each FC matrix (excluding diagonal)
def vectorize_upper_triangle(matrix):
    """Extract upper triangle values (excluding diagonal) as 1D vector."""
    n = matrix.shape[0]
    upper_indices = np.triu_indices(n, k=1)
    return matrix[upper_indices]

# Vectorize FC matrices
fc_6dpf_vectors = np.array([vectorize_upper_triangle(fc_6dpf[i]) for i in range(n_larvae)])
fc_7dpf_vectors = np.array([vectorize_upper_triangle(fc_7dpf[i]) for i in range(n_larvae)])

# Compute similarity matrix: correlation between day 6 and day 7 vectors
similarity_matrix = np.zeros((n_larvae, n_larvae))
for i in range(n_larvae):
    for j in range(n_larvae):
        vec_6 = fc_6dpf_vectors[i]
        vec_7 = fc_7dpf_vectors[j]
        
        # Remove NaNs
        valid_mask = np.isfinite(vec_6) & np.isfinite(vec_7)
        if valid_mask.sum() >= 3:
            corr = np.corrcoef(vec_6[valid_mask], vec_7[valid_mask])[0, 1]
            similarity_matrix[i, j] = corr
        else:
            similarity_matrix[i, j] = np.nan

# Symmetrize the similarity matrix
symmetric_similarity = (similarity_matrix + similarity_matrix.T) / 2

# Save symmetric similarity matrix
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_fingerprinting.npy"), symmetric_similarity)

# Extract intra-individual similarity (diagonal)
intra_similarity = np.diag(symmetric_similarity)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_fingerprinting_SameLarva.npy"), intra_similarity)

# Extract inter-individual similarity (upper triangle excluding diagonal)
upper_indices = np.triu_indices(n_larvae, k=1)
inter_similarity = symmetric_similarity[upper_indices]
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_fingerprinting_DiffLarva.npy"), inter_similarity)

# Remove NaN values for statistics and visualization
intra_clean = intra_similarity[np.isfinite(intra_similarity)]
inter_clean = inter_similarity[np.isfinite(inter_similarity)]

# Statistical test: Mann-Whitney U test
stat, pval = mannwhitneyu(intra_clean, inter_clean, alternative='two-sided')

# Create visualization
fig, ax = plt.subplots(figsize=(3, 5))

# Add jittered scatter plots
np.random.seed(42)
jitter_intra = 0.5 + np.random.normal(0, 0.02, len(intra_clean))
jitter_inter = 1.0 + np.random.normal(0, 0.02, len(inter_clean))

ax.scatter(jitter_intra, intra_clean, s=20, alpha=0.6, color='blue', edgecolors='none')
ax.scatter(jitter_inter, inter_clean, s=20, alpha=0.6, color='red', edgecolors='none')

# Add boxplots
ax.boxplot(
    [intra_clean],
    positions=[0.5],
    widths=0.2,
    patch_artist=True,
    showfliers=False,
    whis=[0, 100],
    medianprops=dict(color='black', linewidth=1.5),
    boxprops=dict(facecolor='none', edgecolor='blue', linewidth=1.2),
    whiskerprops=dict(color='blue', linewidth=1.2),
    capprops=dict(color='blue', linewidth=1.2)
)

ax.boxplot(
    [inter_clean],
    positions=[1.0],
    widths=0.2,
    patch_artist=True,
    showfliers=False,
    whis=[0, 100],
    medianprops=dict(color='black', linewidth=1.5),
    boxprops=dict(facecolor='none', edgecolor='red', linewidth=1.2),
    whiskerprops=dict(color='red', linewidth=1.2),
    capprops=dict(color='red', linewidth=1.2)
)

# Set axis properties
ax.set_xlim(0.2, 1.3)
ax.set_ylim(0.6, 0.85)
ax.set_yticks(np.arange(0.6, 0.86, 0.05))
ax.set_ylabel("FC similarity", fontsize=12)

# Set x-axis labels with newlines to prevent overlap
ax.set_xticks([0.5, 1.0])
ax.set_xticklabels(["intra-\nindividual", "inter-\nindividual"], fontsize=10)
ax.tick_params(axis='x', which='both', length=0)

# Add statistical annotation
y_line = 0.83
y_text = 0.832
ax.plot([0.5, 1.0], [y_line, y_line], 'k-', linewidth=1)
ax.text(0.75, y_text, f'p={pval:.2e}\nMann-Whitney U', 
        ha='center', va='bottom', fontsize=9)

plt.tight_layout()

# Save figure
fig.savefig(os.path.join(SAVE_DIR, "figure_refine.png"), dpi=300, bbox_inches='tight')
plt.close()

# Save statistics to JSON
statistics = {
    "intra_individual": {
        "n": int(len(intra_clean)),
        "mean": float(np.mean(intra_clean)),
        "std": float(np.std(intra_clean))
    },
    "inter_individual": {
        "n": int(len(inter_clean)),
        "mean": float(np.mean(inter_clean)),
        "std": float(np.std(inter_clean))
    },
    "statistical_test": {
        "method": "Mann-Whitney U test",
        "p_value": float(pval)
    }
}

with open(os.path.join(SAVE_DIR, "statistics.json"), 'w') as f:
    json.dump(statistics, f, indent=2)
