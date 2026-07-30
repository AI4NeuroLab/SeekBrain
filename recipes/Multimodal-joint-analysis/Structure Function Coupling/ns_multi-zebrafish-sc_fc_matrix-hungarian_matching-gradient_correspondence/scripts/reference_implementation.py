import os
import sys
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
import json

# Add library path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# =============================================================================
# Utility function from reference code
# =============================================================================
def compute_mode_similarity_matrix(
    modes1: np.ndarray, 
    modes2: np.ndarray, 
    return_mapping: bool = False, 
    method: str = 'pearson'
):
    """
    Computes the similarity matrix between two sets of gradients/modes.
    Uses linear sum assignment to match modes.
    
    Args:
        modes1: First set of modes (N_modes x N_regions).
        modes2: Second set of modes (N_modes x N_regions).
        return_mapping: If True, returns the mapping indices.
        method: 'pearson' or 'spearman'.
    
    Returns:
        Correlation matrix (sorted) and optionally the mapping.
    """
    from scipy.optimize import linear_sum_assignment
    from scipy.stats import pearsonr, spearmanr
    
    N_modes = modes1.shape[0]
    corrs = np.zeros((N_modes, N_modes))
    
    # Initial correlation matrix
    for i in range(N_modes):
        for j in range(N_modes):
            if method == 'pearson':
                corrs[i, j] = pearsonr(modes1[i], modes2[j])[0]
            elif method == 'spearman':
                corrs[i, j] = spearmanr(modes1[i], modes2[j])[0]
    
    # Match modes to maximize similarity
    cost_matrix = 1 - np.abs(corrs)
    _, mapping = linear_sum_assignment(cost_matrix)
    
    # Recompute sorted correlation matrix
    sorted_corrs = np.zeros((N_modes, N_modes))
    for i in range(N_modes):
        for j in range(N_modes):
            if method == 'pearson':
                sorted_corrs[i, j] = pearsonr(modes1[i], modes2[mapping[j]])[0]
            elif method == 'spearman':
                sorted_corrs[i, j] = spearmanr(modes1[i], modes2[mapping[j]])[0]
                
    if return_mapping:
        return sorted_corrs, mapping
    else:
        return sorted_corrs

# =============================================================================
# Load Data
# =============================================================================
print("Loading SC and FC gradients...")
sc_gradients = np.load(os.path.join(PROCESS_DATA_DIR, 'Figure6_SC_gradients.npy'))
fc_gradients = np.load(os.path.join(PROCESS_DATA_DIR, 'Figure6_FC_gradients.npy'))

print(f"SC gradients shape: {sc_gradients.shape}")
print(f"FC gradients shape: {fc_gradients.shape}")

# =============================================================================
# Data Preparation: Select first 50 modes
# =============================================================================
print("Selecting first 50 modes from both SC and FC gradients...")
sc_modes_50 = sc_gradients[:50, :]
fc_modes_50 = fc_gradients[:50, :]

print(f"SC modes (first 50) shape: {sc_modes_50.shape}")
print(f"FC modes (first 50) shape: {fc_modes_50.shape}")

# Validation checks
assert sc_modes_50.shape[0] == 50, f"SC modes should have 50 modes, got {sc_modes_50.shape[0]}"
assert fc_modes_50.shape[0] == 50, f"FC modes should have 50 modes, got {fc_modes_50.shape[0]}"
assert sc_modes_50.shape[1] == fc_modes_50.shape[1], "SC and FC modes must have same number of regions"

# =============================================================================
# Compute Similarity Matrix
# =============================================================================
print("Computing mode similarity matrix...")
correlations, mapping_indices = compute_mode_similarity_matrix(
    sc_modes_50, fc_modes_50, return_mapping=True, method='pearson'
)

print(f"Correlations matrix shape: {correlations.shape}")
print(f"Mapping indices shape: {mapping_indices.shape}")

# Validation: Check correlation values are in valid range
assert correlations.shape == (50, 50), f"Correlation matrix should be 50x50, got {correlations.shape}"
assert np.all(np.abs(correlations) <= 1.0), "Correlation values must be in [-1, 1]"

# =============================================================================
# Save Intermediate Results
# =============================================================================
print("Saving correlation matrix and mapping indices...")
np.save(os.path.join(PROCESS_DATA_DIR, 'Figure6_FC_SC_gradients_correlations.npy'), correlations)
np.save(os.path.join(PROCESS_DATA_DIR, 'Figure6_FC_SC_gradients_mapping_indcies.npy'), mapping_indices)

# =============================================================================
# Prepare for Visualization
# =============================================================================
print("Computing absolute values of correlation matrix...")
abs_correlations = np.abs(correlations)

# =============================================================================
# Compute Statistics
# =============================================================================
statistics = {
    "n_modes": 50,
    "correlation_matrix_shape": list(correlations.shape),
    "correlation_min": float(np.min(correlations)),
    "correlation_max": float(np.max(correlations)),
    "correlation_mean": float(np.mean(correlations)),
    "correlation_std": float(np.std(correlations)),
    "abs_correlation_min": float(np.min(abs_correlations)),
    "abs_correlation_max": float(np.max(abs_correlations)),
    "abs_correlation_mean": float(np.mean(abs_correlations)),
    "abs_correlation_std": float(np.std(abs_correlations)),
    "diagonal_correlations": [float(correlations[i, i]) for i in range(50)],
    "diagonal_mean": float(np.mean([correlations[i, i] for i in range(50)])),
    "diagonal_std": float(np.std([correlations[i, i] for i in range(50)])),
}

# =============================================================================
# Visualization
# =============================================================================
print("Creating visualization...")
fig, ax = plt.subplots(figsize=(5, 5))

# Plot the absolute correlation matrix
im = ax.imshow(abs_correlations, cmap='Reds', aspect='equal')

# Remove all ticks
ax.set_xticks([])
ax.set_yticks([])

# Add axis labels with start and end IDs (starting from 1)
ax.set_ylabel("FC gradients")
ax.set_xlabel("SC gradients")

# Add start and end ID labels for Y-axis (FC gradients)
ax.text(-0.5, 0, '1', ha='right', va='center', fontsize=10)
ax.text(-0.5, 49, '50', ha='right', va='center', fontsize=10)

# Add start and end ID labels for X-axis (SC gradients)
ax.text(0, 50.5, '1', ha='center', va='top', fontsize=10)
ax.text(49, 50.5, '50', ha='center', va='top', fontsize=10)

# Add colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("Gradient similarity |r|", rotation=270, labelpad=20)

plt.tight_layout()

# Save figure
output_path = os.path.join(SAVE_DIR, 'figure.png')
plt.savefig(output_path, dpi=300, bbox_inches='tight')
plt.close()
print(f"Figure saved to {output_path}")

# =============================================================================
# Save Statistics
# =============================================================================
stats_path = os.path.join(SAVE_DIR, 'statistics.json')
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)
print(f"Statistics saved to {stats_path}")

print("Analysis complete!")
