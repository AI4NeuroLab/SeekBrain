import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.ticker import FormatStrFormatter, AutoMinorLocator

# Add library code to path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Validate paths
if not PROCESS_DATA_DIR:
    raise ValueError("PROCESS_DATA_DIR environment variable not set")
if not SAVE_DIR:
    raise ValueError("SAVE_DIR environment variable not set")

os.makedirs(SAVE_DIR, exist_ok=True)

# Load FC eigenvalues
eigenvalues_path = os.path.join(PROCESS_DATA_DIR, "Figure6_FC_eigenvalues.npy")
if not os.path.exists(eigenvalues_path):
    raise FileNotFoundError(f"FC eigenvalues file not found: {eigenvalues_path}")

eigenvalues = np.load(eigenvalues_path)

# Ensure eigenvalues is 1D array
if eigenvalues.ndim > 1:
    eigenvalues = eigenvalues.flatten()

# Validate data
assert isinstance(eigenvalues, np.ndarray), "Eigenvalues must be a numpy array"
assert eigenvalues.size >= 50, f"Need at least 50 eigenvalues, got {eigenvalues.size}"

# Create index array starting from 1
n_eigenvalues = eigenvalues.size
gradient_indices = np.arange(1, n_eigenvalues + 1)

# Create figure
fig, ax = plt.subplots(figsize=(5, 5))

# Plot eigenvalues
ax.plot(
    gradient_indices,
    eigenvalues,
    color='black',
    linewidth=1,
    marker='.',
    markersize=1
)

# Set axis limits
ax.set_xlim([-1, 51])
ax.set_ylim(bottom=-0.05)

# Set axis ticks
ax.set_xticks([1, 50])

# Add minor ticks for better readability on X-axis
ax.xaxis.set_minor_locator(AutoMinorLocator())

# Set axis labels with increased font size
ax.set_xlabel("Gradient #", fontsize=14)
ax.set_ylabel("Eigenvalue", fontsize=14)

# Increase tick label size and format Y-axis
ax.tick_params(axis='both', which='major', labelsize=12)
ax.yaxis.set_major_formatter(FormatStrFormatter('%.2f'))

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.tight_layout()
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"✅ Figure saved to {figure_path}")

# Compute statistics for the first 50 eigenvalues
first_50_eigenvalues = eigenvalues[:50]

# Calculate decay metrics
decay_ratio = first_50_eigenvalues[-1] / first_50_eigenvalues[0] if first_50_eigenvalues[0] != 0 else 0
cumulative_sum = np.cumsum(first_50_eigenvalues)
total_variance = cumulative_sum[-1]
explained_variance_ratios = cumulative_sum / total_variance if total_variance > 0 else np.zeros_like(cumulative_sum)

# Find number of gradients explaining 50%, 80%, 90% variance
thresholds = [0.5, 0.8, 0.9]
gradients_for_thresholds = {}
for thresh in thresholds:
    idx = np.where(explained_variance_ratios >= thresh)[0]
    gradients_for_thresholds[f"gradients_for_{int(thresh*100)}pct_variance"] = int(idx[0] + 1) if len(idx) > 0 else n_eigenvalues

# Compile statistics
statistics = {
    "n_eigenvalues": int(n_eigenvalues),
    "first_50_eigenvalues": {
        "mean": float(np.mean(first_50_eigenvalues)),
        "std": float(np.std(first_50_eigenvalues)),
        "median": float(np.median(first_50_eigenvalues)),
        "min": float(np.min(first_50_eigenvalues)),
        "max": float(np.max(first_50_eigenvalues)),
        "percentile_25": float(np.percentile(first_50_eigenvalues, 25)),
        "percentile_75": float(np.percentile(first_50_eigenvalues, 75))
    },
    "eigenvalue_1": float(eigenvalues[0]),
    "eigenvalue_50": float(eigenvalues[49]) if n_eigenvalues >= 50 else None,
    "decay_ratio_50_to_1": float(decay_ratio),
    "total_variance_first_50": float(total_variance),
    "cumulative_variance_explained": {
        "gradient_10": float(explained_variance_ratios[9]) if len(explained_variance_ratios) >= 10 else None,
        "gradient_20": float(explained_variance_ratios[19]) if len(explained_variance_ratios) >= 20 else None,
        "gradient_30": float(explained_variance_ratios[29]) if len(explained_variance_ratios) >= 30 else None,
        "gradient_50": float(explained_variance_ratios[49]) if len(explained_variance_ratios) >= 50 else None
    },
    "gradients_for_variance_thresholds": gradients_for_thresholds
}

# Save statistics
statistics_path = os.path.join(SAVE_DIR, "statistics.json")
with open(statistics_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"✅ Statistics saved to {statistics_path}")
print(f"\nKey findings:")
print(f"  - First eigenvalue: {statistics['eigenvalue_1']:.4f}")
print(f"  - 50th eigenvalue: {statistics['eigenvalue_50']:.4f}")
print(f"  - Decay ratio (50/1): {statistics['decay_ratio_50_to_1']:.4f}")
print(f"  - Gradients for 50% variance: {gradients_for_thresholds['gradients_for_50pct_variance']}")
print(f"  - Gradients for 80% variance: {gradients_for_thresholds['gradients_for_80pct_variance']}")
