import os
import sys
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
import json
from scipy.optimize import linear_sum_assignment
from scipy.stats import spearmanr

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# =============================================================================
# Utility function
# =============================================================================
def compute_mode_similarity_matrix(
    modes1: np.ndarray, 
    modes2: np.ndarray, 
    return_mapping: bool = False, 
    method: str = 'pearson'
):
    """
    Computes the similarity matrix between two sets of gradients/modes.
    Rows of output correspond to modes1, Columns correspond to reordered modes2.
    """
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

# =============================================================================
# Data Preparation
# =============================================================================
print("Selecting first 50 modes...")
sc_modes_50 = sc_gradients[:50, :]
fc_modes_50 = fc_gradients[:50, :]

# =============================================================================
# Compute Similarity
# =============================================================================
print("Computing mode similarity matrix...")
# correlations: Rows = SC modes, Cols = FC modes (reordered)
correlations, mapping_indices = compute_mode_similarity_matrix(
    sc_modes_50, fc_modes_50, return_mapping=True, method='pearson'
)

# Save intermediate results
np.save(os.path.join(PROCESS_DATA_DIR, 'Figure6_FC_SC_gradients_correlations.npy'), correlations)
np.save(os.path.join(PROCESS_DATA_DIR, 'Figure6_FC_SC_gradients_mapping_indcies.npy'), mapping_indices)

# =============================================================================
# Prepare Visualization Data
# =============================================================================
# User requested Y-axis = "FC gradients" and X-axis = "SC gradients".
# Current 'correlations' has Rows=SC, Cols=FC.
# We transpose to get Rows=FC, Cols=SC.
matrix_to_plot = np.abs(correlations).T

# =============================================================================
# Visualization
# =============================================================================
print("Creating visualization...")
fig, ax = plt.subplots(figsize=(5, 5))

# Plot the absolute correlation matrix
im = ax.imshow(matrix_to_plot, cmap='Reds', aspect='equal')

# Axis Labels
ax.set_ylabel("FC gradients")
ax.set_xlabel("SC gradients")

# Set start and end ID labels using ticks
# We use standard ticks for positioning but set length to 0 to "remove" the tick marks
ax.set_xticks([0, 49])
ax.set_xticklabels(['1', '50'])
ax.set_yticks([0, 49])
ax.set_yticklabels(['1', '50'])
ax.tick_params(axis='both', which='both', length=0)

# Add colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("Gradient similarity |r|", rotation=270, labelpad=20)

plt.tight_layout()

# Save figure
output_path = os.path.join(SAVE_DIR, 'figure_refine.png')
plt.savefig(output_path, dpi=300, bbox_inches='tight')
plt.close()
print(f"Figure saved to {output_path}")

# =============================================================================
# Save Statistics
# =============================================================================
statistics = {
    "n_modes": 50,
    "correlation_mean": float(np.mean(correlations)),
    "abs_correlation_mean": float(np.mean(np.abs(correlations))),
    "diagonal_mean": float(np.mean([correlations[i, i] for i in range(50)])),
}
stats_path = os.path.join(SAVE_DIR, 'statistics.json')
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print("Analysis complete!")
