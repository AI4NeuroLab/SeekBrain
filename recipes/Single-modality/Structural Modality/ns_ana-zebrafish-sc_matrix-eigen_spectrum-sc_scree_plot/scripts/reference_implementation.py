import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt

# Add library code to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script

# Import utilities (as per PATH info)
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# Load SC eigenvalues
# ============================================================================
eigenvalues_path = os.path.join(PROCESS_DATA_DIR, "Figure6_SC_eigenvalues.npy")
if not os.path.exists(eigenvalues_path):
    raise FileNotFoundError(f"SC eigenvalues file not found: {eigenvalues_path}")

eigenvalues = np.load(eigenvalues_path, allow_pickle=True).astype(float)

# Validation: ensure it's a 1D array
assert eigenvalues.ndim == 1, f"Expected 1D eigenvalue array, got shape {eigenvalues.shape}"
assert eigenvalues.size >= 50, f"Expected at least 50 eigenvalues, got {eigenvalues.size}"

print(f"✅ Loaded {eigenvalues.size} SC eigenvalues from {eigenvalues_path}")

# ============================================================================
# Prepare data for plotting
# ============================================================================
# Create 1-based index for X-axis
n_eigenvalues = eigenvalues.size
gradient_indices = np.arange(1, n_eigenvalues + 1)

# ============================================================================
# Statistical analysis
# ============================================================================
# Compute key statistics about the eigenvalue decay
statistics = {
    "n_eigenvalues": int(n_eigenvalues),
    "first_eigenvalue": float(eigenvalues[0]),
    "mean_eigenvalue": float(np.mean(eigenvalues)),
    "median_eigenvalue": float(np.median(eigenvalues)),
    "std_eigenvalue": float(np.std(eigenvalues)),
    "min_eigenvalue": float(np.min(eigenvalues)),
    "max_eigenvalue": float(np.max(eigenvalues)),
    "eigenvalue_range": float(np.ptp(eigenvalues)),
}

# Compute percentiles
percentiles = [25, 50, 75, 90, 95]
for p in percentiles:
    statistics[f"p{p}_eigenvalue"] = float(np.percentile(eigenvalues, p))

# Compute decay rate (ratio of first to last)
statistics["decay_ratio_first_to_last"] = float(eigenvalues[0] / eigenvalues[-1]) if eigenvalues[-1] != 0 else np.inf

# Compute the first 10 eigenvalues for detailed inspection
statistics["first_10_eigenvalues"] = eigenvalues[:10].tolist()

# Find the number of eigenvalues needed to capture certain percentages of total variance
cumsum_eigenvalues = np.cumsum(eigenvalues)
total_sum = cumsum_eigenvalues[-1]
for threshold in [50, 80, 90, 95]:
    n_needed = np.searchsorted(cumsum_eigenvalues, threshold / 100.0 * total_sum) + 1
    statistics[f"n_eigenvalues_for_{threshold}pct_variance"] = int(n_needed)

# ============================================================================
# Create figure
# ============================================================================
fig, ax = plt.subplots(figsize=(5, 5))

# Plot line with black color, linewidth 1, marker size 1
ax.plot(
    gradient_indices,
    eigenvalues,
    color='black',
    linewidth=1,
    marker='.',
    markersize=1
)

# Set axis limits and ticks
ax.set_xlim([-1, 51])
ax.set_xticks([1, 50])
ax.set_xlabel("Gradient #")

# Set Y-axis to start at -0.05
y_min = -0.05
y_max = eigenvalues.max() * 1.05  # Add 5% margin at top
ax.set_ylim([y_min, y_max])
ax.set_ylabel("Eigenvalue")

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.tight_layout()
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"✅ Figure saved to {figure_path}")

# ============================================================================
# Save statistics to JSON
# ============================================================================
statistics_path = os.path.join(SAVE_DIR, "statistics.json")
with open(statistics_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"✅ Statistics saved to {statistics_path}")
print(f"Summary: {n_eigenvalues} eigenvalues, first = {eigenvalues[0]:.4f}, mean = {np.mean(eigenvalues):.4f}")
