import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr, linregress

# Add shared toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
DATA_ROOT = os.getenv("ZEBRAFISH_PATH", "<data-root>")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# =============================================================================
# 1. Data Loading & Preprocessing
# =============================================================================

# Load SC matrix (undirected terminals expanded)
sc_path = os.path.join(DATA_ROOT, "Files", "SC_matrix_undirected_terminals_expanded.npy")
if not os.path.exists(sc_path):
    raise FileNotFoundError(f"SC matrix not found at {sc_path}")
sc_matrix = np.load(sc_path, allow_pickle=True).astype(float)
print(f"Loaded SC matrix with shape {sc_matrix.shape}")

# Load FC matrix
fc_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
if not os.path.exists(fc_path):
    raise FileNotFoundError(f"FC matrix not found at {fc_path}")
fc_matrix = np.load(fc_path, allow_pickle=True).astype(float)
print(f"Loaded FC matrix with shape {fc_matrix.shape}")

# Load excluded regions
excluded_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
if not os.path.exists(excluded_path):
    raise FileNotFoundError(f"Excluded regions file not found at {excluded_path}")
excluded_regions = np.load(excluded_path, allow_pickle=True).astype(int)
print(f"Loaded {len(excluded_regions)} excluded regions: {excluded_regions}")

# Remove excluded regions from SC matrix
mask = np.ones(sc_matrix.shape[0], dtype=bool)
mask[excluded_regions] = False
sc_matrix_filtered = sc_matrix[mask][:, mask]
print(f"Filtered SC matrix shape: {sc_matrix_filtered.shape}")

# Remove excluded regions from FC matrix (if needed)
if fc_matrix.shape[0] == sc_matrix.shape[0]:
    fc_matrix_filtered = fc_matrix[mask][:, mask]
    print(f"Filtered FC matrix from {fc_matrix.shape} to {fc_matrix_filtered.shape}")
else:
    fc_matrix_filtered = fc_matrix
    print(f"FC matrix already filtered: {fc_matrix_filtered.shape}")

# Validate that matrices have the same shape
assert sc_matrix_filtered.shape == fc_matrix_filtered.shape, \
    f"Shape mismatch: SC {sc_matrix_filtered.shape} vs FC {fc_matrix_filtered.shape}"
assert sc_matrix_filtered.ndim == 2, "SC matrix must be 2D"
assert sc_matrix_filtered.shape[0] == sc_matrix_filtered.shape[1], "Matrices must be square"

# =============================================================================
# 2. Compute Weighted SC Degree
# =============================================================================

# Zero out diagonals to avoid self-connections
np.fill_diagonal(sc_matrix_filtered, 0.0)
np.fill_diagonal(fc_matrix_filtered, 0.0)

# Compute weighted SC degree (row sums)
sc_degree = np.sum(sc_matrix_filtered, axis=1)
print(f"SC degree shape: {sc_degree.shape}, min: {sc_degree.min():.3f}, max: {sc_degree.max():.3f}")

# Save SC degree
sc_degree_save_path = os.path.join(PROCESS_DATA_DIR, "Figure2_Node_degree_SC.npy")
np.save(sc_degree_save_path, sc_degree)
print(f"Saved SC degree to {sc_degree_save_path}")

# =============================================================================
# 3. Compute Weighted FC Degree
# =============================================================================

# Handle NaN values in FC matrix by replacing with 0
fc_matrix_clean = np.nan_to_num(fc_matrix_filtered, nan=0.0, posinf=0.0, neginf=0.0)
print(f"FC matrix NaN count: {np.sum(np.isnan(fc_matrix_filtered))}, replaced with 0")

# Compute weighted FC degree (row sums) - use positive weights only as per reference
fc_matrix_positive = np.maximum(fc_matrix_clean, 0.0)
fc_degree = np.sum(fc_matrix_positive, axis=1)
print(f"FC degree shape: {fc_degree.shape}, min: {fc_degree.min():.3f}, max: {fc_degree.max():.3f}")

# Save FC degree
fc_degree_save_path = os.path.join(PROCESS_DATA_DIR, "Figure2_Node_degree_FC.npy")
np.save(fc_degree_save_path, fc_degree)
print(f"Saved FC degree to {fc_degree_save_path}")

# Validate degree vectors
assert sc_degree.shape == fc_degree.shape, \
    f"Degree vector shape mismatch: SC {sc_degree.shape} vs FC {fc_degree.shape}"
assert not np.any(np.isnan(sc_degree)), "SC degree contains NaN values"
assert not np.any(np.isnan(fc_degree)), "FC degree contains NaN values after cleaning"
assert not np.any(np.isinf(sc_degree)), "SC degree contains Inf values"
assert not np.any(np.isinf(fc_degree)), "FC degree contains Inf values"

# =============================================================================
# 4. Compute Pearson Correlation
# =============================================================================

pearson_r, pearson_p = pearsonr(sc_degree, fc_degree)
print(f"Pearson correlation: r={pearson_r:.4f}, p={pearson_p:.4e}")

# =============================================================================
# 5. Fit Linear Regression
# =============================================================================

regression_result = linregress(sc_degree, fc_degree)
slope = regression_result.slope
intercept = regression_result.intercept
print(f"Linear regression: slope={slope:.4f}, intercept={intercept:.4f}")

# =============================================================================
# 6. Visualization
# =============================================================================

fig, ax = plt.subplots(figsize=(5, 4), dpi=300)

# Scatter plot: black points
ax.scatter(sc_degree, fc_degree, s=20, color='black', alpha=0.6, edgecolors='none')

# Best-fit line: medium violet-red
x_line = np.linspace(sc_degree.min(), sc_degree.max(), 200)
y_line = intercept + slope * x_line
ax.plot(x_line, y_line, color='mediumvioletred', linewidth=2.5)

# Labels
ax.set_xlabel("Structural degree")
ax.set_ylabel("Functional degree")

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Display Pearson r in upper-left corner
ax.text(0.05, 0.95, f'r = {pearson_r:.3f}', 
        transform=ax.transAxes, fontsize=11, 
        verticalalignment='top', horizontalalignment='left',
        bbox=dict(boxstyle='round', facecolor='white', alpha=0.7))

plt.tight_layout()

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()
print(f"✅ Figure saved to {figure_path}")

# =============================================================================
# 7. Save Statistics to JSON
# =============================================================================

statistics = {
    "n_regions": int(sc_degree.shape[0]),
    "n_excluded_regions": int(len(excluded_regions)),
    "excluded_regions": excluded_regions.tolist(),
    "fc_nan_count_original": int(np.sum(np.isnan(fc_matrix_filtered))),
    "sc_degree_mean": float(np.mean(sc_degree)),
    "sc_degree_std": float(np.std(sc_degree)),
    "sc_degree_median": float(np.median(sc_degree)),
    "sc_degree_min": float(np.min(sc_degree)),
    "sc_degree_max": float(np.max(sc_degree)),
    "sc_degree_25th_percentile": float(np.percentile(sc_degree, 25)),
    "sc_degree_75th_percentile": float(np.percentile(sc_degree, 75)),
    "fc_degree_mean": float(np.mean(fc_degree)),
    "fc_degree_std": float(np.std(fc_degree)),
    "fc_degree_median": float(np.median(fc_degree)),
    "fc_degree_min": float(np.min(fc_degree)),
    "fc_degree_max": float(np.max(fc_degree)),
    "fc_degree_25th_percentile": float(np.percentile(fc_degree, 25)),
    "fc_degree_75th_percentile": float(np.percentile(fc_degree, 75)),
    "pearson_r": float(pearson_r),
    "pearson_p": float(pearson_p),
    "regression_slope": float(slope),
    "regression_intercept": float(intercept),
    "regression_r_squared": float(regression_result.rvalue ** 2),
    "regression_std_err": float(regression_result.stderr)
}

statistics_path = os.path.join(SAVE_DIR, "statistics.json")
with open(statistics_path, 'w') as f:
    json.dump(statistics, f, indent=2)
print(f"✅ Statistics saved to {statistics_path}")

print("\n=== Analysis Complete ===")
print(f"Regions analyzed: {statistics['n_regions']}")
print(f"Pearson r = {pearson_r:.4f} (p = {pearson_p:.4e})")
print(f"Linear fit: y = {slope:.4f}x + {intercept:.4f} (R² = {statistics['regression_r_squared']:.4f})")
