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
from zebrafish_Ca_utils_predictors_xps import Predictors

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
print(f"Loaded FC matrix: {FC_matrix.shape}")

# Load directed SC matrix
sc_dir_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_directed_terminals_expanded.npy")
SC_directed = np.load(sc_dir_path, allow_pickle=True).astype(float)
print(f"Loaded directed SC matrix: {SC_directed.shape}")

# Load undirected SC matrix
sc_und_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy")
SC_undirected = np.load(sc_und_path, allow_pickle=True).astype(float)
print(f"Loaded undirected SC matrix: {SC_undirected.shape}")

# Load excluded regions
excluded_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_path, allow_pickle=True).astype(int)
print(f"Loaded excluded regions: {len(excluded_regions)} regions -> {excluded_regions}")

# Load atlas and compute inter-regional distances
atlas = MapzebrainAtlas(ATLAS_PATH)
left_centroids = np.asarray(atlas.regionCentroids["left"], dtype=float)
right_centroids = np.asarray(atlas.regionCentroids["right"], dtype=float)
centroids = 0.5 * (left_centroids + right_centroids)

# Compute Euclidean distance matrix
distance_matrix = squareform(pdist(centroids, metric="euclidean"))
np.fill_diagonal(distance_matrix, 0.0)
print(f"Computed distance matrix: {distance_matrix.shape}")

# Remove excluded regions from SC and distance matrices
# FC_matrix is already filtered (65x65), so we only filter SC and distance
def remove_excluded(matrix, excluded_indices):
    """Remove rows and columns corresponding to excluded indices."""
    mask = np.ones(matrix.shape[0], dtype=bool)
    for idx in excluded_indices:
        if 0 <= idx < matrix.shape[0]:
            mask[idx] = False
    return matrix[mask][:, mask]

SC_directed_filtered = remove_excluded(SC_directed, excluded_regions)
SC_undirected_filtered = remove_excluded(SC_undirected, excluded_regions)
distance_matrix_filtered = remove_excluded(distance_matrix, excluded_regions)

print(f"After exclusion - FC: {FC_matrix.shape}, SC_dir: {SC_directed_filtered.shape}, SC_und: {SC_undirected_filtered.shape}, Dist: {distance_matrix_filtered.shape}")

# Validate dimensions match
assert FC_matrix.shape == SC_directed_filtered.shape == SC_undirected_filtered.shape == distance_matrix_filtered.shape, \
    f"Matrix dimensions mismatch: FC={FC_matrix.shape}, SC_dir={SC_directed_filtered.shape}, SC_und={SC_undirected_filtered.shape}, Dist={distance_matrix_filtered.shape}"

n_regions = FC_matrix.shape[0]

# ============================================================================
# 2. Compute Structural Predictors
# ============================================================================

# Instantiate predictor model
model = Predictors(SC_directed_filtered, SC_undirected_filtered, distance_matrix_filtered)

# Compute structural predictors using directed SC
model.compute_predictors(directed=True)
print(f"Computed predictors shape: {model.predictors.shape}")

# Validate predictor output
assert model.predictors is not None and model.predictors.size > 0, "Predictors matrix is empty"

# ============================================================================
# 3. Extract First 10 Principal Components
# ============================================================================

pca = PCA(n_components=10)
pca_result = pca.fit_transform(model.predictors)
print(f"PCA result shape: {pca_result.shape}")
print(f"Explained variance ratio: {pca.explained_variance_ratio_}")

# ============================================================================
# 4. Calculate PC1 Matrix
# ============================================================================

PC1 = pca_result[:, 0]  # First principal component

# Reshape PC1 into square matrix
PC1_matrix = PC1.reshape(n_regions, n_regions)
np.fill_diagonal(PC1_matrix, 0.0)

# Extract upper triangles for correlation
upper_indices = np.triu_indices(n_regions, k=1)
PC1_upper = PC1_matrix[upper_indices]
FC_upper = FC_matrix[upper_indices]

# Calculate Pearson correlation
valid_mask = np.isfinite(PC1_upper) & np.isfinite(FC_upper)
PC1_upper_clean = PC1_upper[valid_mask]
FC_upper_clean = FC_upper[valid_mask]

assert len(PC1_upper_clean) > 10, f"Insufficient valid edges for correlation: {len(PC1_upper_clean)}"

corr_coef, corr_pval = pearsonr(PC1_upper_clean, FC_upper_clean)
print(f"Initial correlation: r={corr_coef:.4f}, p={corr_pval:.4e}")

# Multiply PC1 matrix by sign of correlation to ensure positive orientation
PC1_matrix = PC1_matrix * np.sign(corr_coef)

# Recalculate correlation after sign flip
PC1_upper = PC1_matrix[upper_indices]
PC1_upper_clean = PC1_upper[valid_mask]
corr_coef_final, corr_pval_final = pearsonr(PC1_upper_clean, FC_upper_clean)
print(f"Final correlation after sign adjustment: r={corr_coef_final:.4f}, p={corr_pval_final:.4e}")

# Ensure final correlation is positive or zero
assert corr_coef_final >= 0, f"Final correlation is negative: {corr_coef_final}"

# Save PC1 matrix
pc1_save_path = os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_PC1.npy")
np.save(pc1_save_path, PC1_matrix)
print(f"Saved PC1 matrix to {pc1_save_path}")

# ============================================================================
# 5. Final Correlation Statistics
# ============================================================================

print(f"\n=== Final Correlation Statistics ===")
print(f"Pearson r: {corr_coef_final:.4f}")
print(f"P-value: {corr_pval_final:.4e}")
print(f"Number of edges: {len(PC1_upper_clean)}")

# ============================================================================
# 6. Create Composite Visualization
# ============================================================================

# Normalize PC1 and FC matrices to [0, 1]
def normalize_matrix(mat):
    mat_copy = mat.copy()
    finite_mask = np.isfinite(mat_copy)
    if not finite_mask.any():
        return np.zeros_like(mat_copy)
    min_val = np.nanmin(mat_copy[finite_mask])
    max_val = np.nanmax(mat_copy[finite_mask])
    if max_val - min_val < 1e-12:
        return np.zeros_like(mat_copy)
    normalized = (mat_copy - min_val) / (max_val - min_val)
    normalized[~finite_mask] = 0.0
    return normalized

PC1_normalized = normalize_matrix(PC1_matrix)
FC_normalized = normalize_matrix(FC_matrix)

# Create composite matrix: Lower triangle = PC1, Upper triangle = FC
composite = np.zeros_like(PC1_normalized)
lower_indices = np.tril_indices(n_regions, k=-1)
composite[lower_indices] = PC1_normalized[lower_indices]  # Lower triangle: PC1
composite[upper_indices] = FC_normalized[upper_indices]    # Upper triangle: FC

# Plot
fig, ax = plt.subplots(figsize=(6, 5.5), dpi=300)

# Use inverted Blues colormap
im = ax.imshow(composite, cmap='Blues_r', aspect='equal', origin='upper')

# Add colorbar without ticks
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("Normalized weight", rotation=270, labelpad=20)
cbar.set_ticks([])

# Draw white diagonal line
ax.plot([0, n_regions-1], [0, n_regions-1], color='white', linewidth=5, solid_capstyle='butt')

# Tick labels only at 1 and last region ID
ax.set_yticks([0, n_regions-1])
ax.set_yticklabels(['1', str(n_regions)])
ax.set_ylabel("Brain regions")
ax.set_xticks([])

# Text annotations
ax.text(n_regions * 0.75, n_regions * 0.15, "Functional connectivity", 
        ha='right', va='top', fontsize=10, color='black')
ax.text(n_regions * 0.15, n_regions * 0.75, "Structural PC1", 
        ha='left', va='bottom', fontsize=10, color='black')

plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, "figure.png"), dpi=300, bbox_inches='tight')
plt.close()

print(f"✅ Figure saved to {os.path.join(SAVE_DIR, 'figure.png')}")

# ============================================================================
# 7. Save Statistics
# ============================================================================

statistics = {
    "n_regions_after_exclusion": int(n_regions),
    "n_excluded_regions": int(len(excluded_regions)),
    "n_edges_analyzed": int(len(PC1_upper_clean)),
    "pearson_r": float(corr_coef_final),
    "pearson_p_value": float(corr_pval_final),
    "PC1_mean": float(np.nanmean(PC1_matrix)),
    "PC1_std": float(np.nanstd(PC1_matrix)),
    "PC1_median": float(np.nanmedian(PC1_matrix)),
    "PC1_min": float(np.nanmin(PC1_matrix)),
    "PC1_max": float(np.nanmax(PC1_matrix)),
    "FC_mean": float(np.nanmean(FC_matrix)),
    "FC_std": float(np.nanstd(FC_matrix)),
    "FC_median": float(np.nanmedian(FC_matrix)),
    "FC_min": float(np.nanmin(FC_matrix)),
    "FC_max": float(np.nanmax(FC_matrix)),
    "pca_explained_variance_PC1": float(pca.explained_variance_ratio_[0]),
    "pca_explained_variance_total_10PCs": float(np.sum(pca.explained_variance_ratio_))
}

stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"✅ Statistics saved to {stats_path}")
print("\nAll done.")
