import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt

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

# Load data, ensure it's 1D, and handle potential complex types
# Squeeze removes single-dimensional entries (e.g., shape (N, 1) -> (N,))
data = np.load(eigenvalues_path, allow_pickle=True)
eigenvalues = np.real(np.squeeze(data)).astype(float)

# Validation: ensure it's a 1D array after squeeze
if eigenvalues.ndim != 1:
    raise ValueError(f"Expected 1D eigenvalue array, got shape {eigenvalues.shape}")

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
statistics = {
    "n_eigenvalues": int(n_eigenvalues),
    "first_eigenvalue": float(eigenvalues[0]) if n_eigenvalues > 0 else None,
    "mean_eigenvalue": float(np.mean(eigenvalues)) if n_eigenvalues > 0 else None,
    "median_eigenvalue": float(np.median(eigenvalues)) if n_eigenvalues > 0 else None,
    "min_eigenvalue": float(np.min(eigenvalues)) if n_eigenvalues > 0 else None,
    "max_eigenvalue": float(np.max(eigenvalues)) if n_eigenvalues > 0 else None,
}

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
# Set Y-max with a 5% margin above the highest value
y_max = np.max(eigenvalues) * 1.05
ax.set_ylim(bottom=y_min, top=y_max)
ax.set_ylabel("Eigenvalue")

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Save figure as figure_refine.png
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
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
