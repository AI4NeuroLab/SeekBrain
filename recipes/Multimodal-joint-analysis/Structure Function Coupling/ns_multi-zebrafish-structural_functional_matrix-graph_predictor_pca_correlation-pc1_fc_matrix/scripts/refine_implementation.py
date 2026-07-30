import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
from sklearn.decomposition import PCA
from scipy.spatial.distance import pdist, squareform

# Add library path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
from zebrafish_Ca_utils_predictors_xps import *

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")

# Create save directory if needed
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# 1. Load Data and Preprocessing
# ============================================================================

# Load FC matrix
fc_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
FC_matrix = np.load(fc_path, allow_pickle=True).astype(float)

# Load SC matrices
sc_dir_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_directed_terminals_expanded.npy")
SC_directed = np.load(sc_dir_path, allow_pickle=True).astype(float)

sc_und_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy")
SC_undirected = np.load(sc_und_path, allow_pickle=True).astype(float)

# Load excluded regions
excluded_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_path, allow_pickle=True).astype(int)

# Load atlas and compute inter-regional distances
atlas = MapzebrainAtlas(ATLAS_PATH)
left_centroids = np.asarray(atlas.regionCentroids["left"], dtype=float)
right_centroids = np.asarray(atlas.regionCentroids["right"], dtype=float)
centroids = 0.5 * (left_centroids + right_centroids)
distance_matrix = squareform(pdist(centroids, metric="euclidean"))
np.fill_diagonal(distance_matrix, 0.0)

# Remove excluded regions
def remove_excluded(matrix, excluded_indices):
    """Remove rows and columns corresponding to excluded indices."""
    if matrix.shape[0] <= len(excluded_indices):
        return matrix
    mask = np.ones(matrix.shape[0], dtype=bool)
    for idx in excluded_indices:
        if 0 <= idx < matrix.shape[0]:
            mask[idx] = False
    return matrix[mask][:, mask]

SC_directed_filtered = remove_excluded(SC_directed, excluded_regions)
SC_undirected_filtered = remove_excluded(SC_undirected, excluded_regions)
distance_matrix_filtered = remove_excluded(distance_matrix, excluded_regions)

# Ensure FC matrix is consistent (filter if dimensions match raw SC)
if FC_matrix.shape[0] != SC_directed_filtered.shape[0]:
    FC_matrix = remove_excluded(FC_matrix, excluded_regions)

assert FC_matrix.shape == SC_directed_filtered.shape == distance_matrix_filtered.shape, \
    f"Matrix dimension mismatch: FC {FC_matrix.shape}, SC {SC_directed_filtered.shape}"

n_regions = FC_matrix.shape[0]

# ============================================================================
# 2. Compute Structural Predictors & PCA
# ============================================================================

# Instantiate predictor model
model = Predictors(SC_directed_filtered, SC_undirected_filtered, distance_matrix_filtered)
model.compute_predictors(directed=True)

# PCA
pca = PCA(n_components=10)
pca_result = pca.fit_transform(model.predictors)
PC1 = pca_result[:, 0]

# Reshape PC1
PC1_matrix = PC1.reshape(n_regions, n_regions)
np.fill_diagonal(PC1_matrix, 0.0)

# ============================================================================
# 3. Calculate Correlation and Orient PC1
# ============================================================================

upper_indices = np.triu_indices(n_regions, k=1)
PC1_upper = PC1_matrix[upper_indices]
FC_upper = FC_matrix[upper_indices]

# Handle NaNs
valid_mask = np.isfinite(PC1_upper) & np.isfinite(FC_upper)
corr_coef, _ = pearsonr(PC1_upper[valid_mask], FC_upper[valid_mask])

# Align PC1 sign
PC1_matrix = PC1_matrix * np.sign(corr_coef)
PC1_upper = PC1_matrix[upper_indices] # Refresh
corr_coef_final, corr_pval_final = pearsonr(PC1_upper[valid_mask], FC_upper[valid_mask])

# Save PC1 matrix
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_PC1.npy"), PC1_matrix)

# ============================================================================
# 4. Visualization
# ============================================================================

def normalize_matrix(mat):
    mat = mat.copy()
    valid = np.isfinite(mat)
    if not valid.any(): return np.zeros_like(mat)
    mn, mx = mat[valid].min(), mat[valid].max()
    if mx - mn < 1e-12: return np.zeros_like(mat)
    mat[valid] = (mat[valid] - mn) / (mx - mn)
    mat[~valid] = 0.0
    return mat

PC1_norm = normalize_matrix(PC1_matrix)
FC_norm = normalize_matrix(FC_matrix)

# Composite matrix: Lower=PC1, Upper=FC
composite = np.zeros((n_regions, n_regions))
lower_indices = np.tril_indices(n_regions, k=-1)
composite[lower_indices] = PC1_norm[lower_indices]
composite[upper_indices] = FC_norm[upper_indices]

fig, ax = plt.subplots(figsize=(6, 5.5), dpi=300)
im = ax.imshow(composite, cmap='Blues_r', aspect='equal', origin='upper')

# Colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("Normalized weight", rotation=270, labelpad=20)
cbar.set_ticks([])

# White diagonal line (extended coverage)
ax.plot([-0.5, n_regions-0.5], [-0.5, n_regions-0.5], color='white', linewidth=5, solid_capstyle='butt')

# Axis labels
ax.set_yticks([0, n_regions-1])
ax.set_yticklabels(['1', str(n_regions)])
ax.set_ylabel("Brain regions")
ax.set_xticks([])

# Annotations (placed outside the matrix to avoid occlusion)
ax.text(1.0, 1.01, "Functional connectivity", transform=ax.transAxes, 
        ha='right', va='bottom', fontsize=10, color='black')
ax.text(0.0, -0.01, "Structural PC1", transform=ax.transAxes, 
        ha='left', va='top', fontsize=10, color='black')

plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, "figure_refine.png"), dpi=300, bbox_inches='tight')
plt.close()

# Save stats
statistics = {
    "pearson_r": float(corr_coef_final),
    "pearson_p_value": float(corr_pval_final)
}
with open(os.path.join(SAVE_DIR, "statistics.json"), 'w') as f:
    json.dump(statistics, f, indent=2)

print("Processing and plotting complete.")
