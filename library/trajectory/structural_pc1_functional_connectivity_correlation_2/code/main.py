import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr

# Add library to path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Create save directory if needed
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# 1. Load data
# ============================================================================
print("Loading data...")

# Load FC matrix
fc_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
fc_matrix = np.load(fc_path).astype(float)
print(f"Loaded FC matrix: {fc_matrix.shape}")

# Load PC1 matrix
pc1_path = os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_PC1.npy")
pc1_matrix = np.load(pc1_path).astype(float)
print(f"Loaded PC1 matrix: {pc1_matrix.shape}")

# Load excluded regions
excluded_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_path).astype(int)
print(f"Loaded excluded regions: {excluded_regions}")

# ============================================================================
# 2. Preprocessing - Remove excluded regions
# ============================================================================
print("\nPreprocessing...")

# Both matrices must have the same shape initially
assert fc_matrix.shape == pc1_matrix.shape, \
    f"Input matrices must have same shape: FC {fc_matrix.shape} vs PC1 {pc1_matrix.shape}"

num_regions = fc_matrix.shape[0]

# Filter excluded regions to only valid indices (non-negative and within bounds)
valid_mask_indices = (excluded_regions >= 0) & (excluded_regions < num_regions)
excluded_regions_valid = excluded_regions[valid_mask_indices]

if len(excluded_regions_valid) < len(excluded_regions):
    print(f"Warning: Ignored {len(excluded_regions) - len(excluded_regions_valid)} invalid excluded indices.")

# Create mask for regions to keep
keep_mask = np.ones(num_regions, dtype=bool)
keep_mask[excluded_regions_valid] = False

# Apply mask to both matrices (remove rows and columns)
fc_filtered = fc_matrix[keep_mask][:, keep_mask]
pc1_filtered = pc1_matrix[keep_mask][:, keep_mask]

print(f"FC matrix after filtering: {fc_filtered.shape}")
print(f"PC1 matrix after filtering: {pc1_filtered.shape}")

# Validate shapes match
assert fc_filtered.shape == pc1_filtered.shape, \
    f"Shape mismatch: FC {fc_filtered.shape} vs PC1 {pc1_filtered.shape}"

# ============================================================================
# 3. Extract upper triangles (without diagonal)
# ============================================================================
print("\nExtracting upper triangles...")

n_regions = fc_filtered.shape[0]
# k=1 excludes the diagonal, extracting valid edges
upper_indices = np.triu_indices(n_regions, k=1)

fc_upper = fc_filtered[upper_indices]
pc1_upper = pc1_filtered[upper_indices]

print(f"Number of edges (upper triangle): {len(fc_upper)}")

# Remove any NaN or Inf values
valid_mask = np.isfinite(fc_upper) & np.isfinite(pc1_upper)
fc_values = fc_upper[valid_mask]
pc1_values = pc1_upper[valid_mask]

print(f"Number of valid edges after filtering: {len(fc_values)}")

if len(fc_values) < 3:
    raise ValueError("Insufficient valid data points for correlation analysis")

# ============================================================================
# 4. Calculate Pearson correlation
# ============================================================================
print("\nCalculating Pearson correlation...")

pearson_r, pearson_p = pearsonr(pc1_values, fc_values)

print(f"Pearson r = {pearson_r:.4f}")
print(f"Pearson p-value = {pearson_p:.4e}")

# ============================================================================
# 5. Fit linear regression (first-order polynomial)
# ============================================================================
print("\nFitting linear regression...")

# First-order polynomial (linear fit)
coefficients = np.polyfit(pc1_values, fc_values, deg=1)
slope = coefficients[0]
intercept = coefficients[1]

print(f"Slope = {slope:.4f}")
print(f"Intercept = {intercept:.4f}")

# Generate line for plotting
x_line = np.linspace(pc1_values.min(), pc1_values.max(), 200)
y_line = slope * x_line + intercept

# ============================================================================
# 6. Create visualization
# ============================================================================
print("\nCreating visualization...")

fig, ax = plt.subplots(figsize=(5, 4), dpi=300)

# Scatter plot with transparent black points
ax.scatter(pc1_values, fc_values, s=5, alpha=0.3, color='black', edgecolors='none')

# Best-fit line in medium violet-red
ax.plot(x_line, y_line, color='mediumvioletred', linewidth=2, label='Best fit')

# Labels
ax.set_xlabel('Structural PC1', fontsize=12)
ax.set_ylabel('FC', fontsize=12)

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Add Pearson r text in upper-left corner in medium violet-red
text_str = f'r = {pearson_r:.3f}'
ax.text(0.05, 0.95, text_str, 
        transform=ax.transAxes,
        fontsize=11,
        color='mediumvioletred',
        verticalalignment='top',
        horizontalalignment='left')

plt.tight_layout()

# Save figure as figure_refine.png
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
print(f"\nFigure saved to: {figure_path}")
plt.close()

# ============================================================================
# 7. Save statistics
# ============================================================================
print("\nSaving statistics...")

statistics = {
    "sample_sizes": {
        "n_regions_original": int(num_regions),
        "n_regions_filtered": int(n_regions),
        "excluded_regions": excluded_regions.tolist(),
        "total_edges_upper_triangle": int(len(fc_upper)),
        "valid_edges_after_filtering": int(len(fc_values))
    },
    "correlation_analysis": {
        "pearson_r": float(pearson_r),
        "pearson_p_value": float(pearson_p),
        "r_squared": float(pearson_r ** 2)
    },
    "linear_regression": {
        "slope": float(slope),
        "intercept": float(intercept),
        "regression_equation": f"FC = {slope:.4f} * PC1 + {intercept:.4f}"
    }
}

# Save to JSON
stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"Statistics saved to: {stats_path}")
