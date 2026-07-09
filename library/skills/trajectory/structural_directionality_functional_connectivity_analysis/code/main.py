import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from scipy.stats import f_oneway
from scipy.ndimage import gaussian_filter1d

# Add shared toolkit to path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")
from zebrafish_Ca_utils import *

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
DATA_ROOT = "/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data/dataverse_files"

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# 1. Data Loading and Preprocessing
# ============================================================================

# Load directed structural connectivity matrix
sc_path = os.path.join(DATA_ROOT, "Files", "SC_matrix_directed_terminals_expanded.npy")
SC_directed = np.load(sc_path, allow_pickle=True).astype(float)
print(f"Loaded SC matrix with shape: {SC_directed.shape}")

# Load excluded regions
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path, allow_pickle=True).astype(int)
print(f"Loaded {len(excluded_regions)} excluded regions")

# Remove excluded regions from SC matrix (rows and columns)
# Create mask based on original shape
mask = np.ones(SC_directed.shape[0], dtype=bool)
mask[excluded_regions] = False
SC_directed = SC_directed[mask][:, mask]
print(f"SC matrix after removal: {SC_directed.shape}")

# Load FC matrices
fc_matrices_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrices.npy")
FC_matrices = np.load(fc_matrices_path, allow_pickle=True).astype(float)
print(f"Loaded FC matrices with shape: {FC_matrices.shape}")

# Validate that FC matrices have the correct shape after exclusion
# Note: mask was created based on the original N dimensions, which matches FC_matrices original dimension
if FC_matrices.ndim == 3:
    n_fish, n_regions_fc, _ = FC_matrices.shape
    # If FC matrix region count matches the ORIGINAL SC size (before we cut SC), we need to cut FC too.
    # We compare against SC_directed.shape[0] which is already reduced.
    # If n_regions_fc > SC_directed.shape[0], it implies FC is not yet reduced.
    if n_regions_fc > SC_directed.shape[0]: 
        print(f"Applying exclusion to FC matrices...")
        FC_matrices = FC_matrices[:, mask][:, :, mask]
        print(f"FC matrices after removal: {FC_matrices.shape}")
elif FC_matrices.ndim == 2:
    if FC_matrices.shape[0] > SC_directed.shape[0]:
        print(f"Applying exclusion to FC matrices...")
        FC_matrices = FC_matrices[mask][:, mask]

# ============================================================================
# 2. Structural Connection Categorization
# ============================================================================

# Binarize the directed SC matrix
SC_binary = (SC_directed > 0).astype(int)

# Calculate connection category matrix
# 0 = unconnected, 1 = unidirectional, 2 = bidirectional
connection_category = SC_binary + SC_binary.T
print(f"Connection categories: 0={np.sum(connection_category == 0)}, "
      f"1={np.sum(connection_category == 1)}, 2={np.sum(connection_category == 2)}")

# Save connection category matrix
connection_category_path = os.path.join(PROCESS_DATA_DIR, "Figure2_number_of_connections.npy")
np.save(connection_category_path, connection_category)
print(f"Saved connection category matrix to {connection_category_path}")

# ============================================================================
# 3. Functional Connectivity Distribution Analysis
# ============================================================================

# Get upper triangle indices (excluding diagonal)
n_regions = SC_directed.shape[0]
upper_indices = np.triu_indices(n_regions, k=1)

# Initialize lists to accumulate FC values by category
fc_bidirectional = []
fc_unidirectional = []
fc_unconnected = []

# Iterate through each FC matrix
n_fish_matrices = FC_matrices.shape[0] if FC_matrices.ndim == 3 else 1
if FC_matrices.ndim == 2:
    FC_matrices = FC_matrices[np.newaxis, :, :]

for fish_idx in range(n_fish_matrices):
    fc_matrix = FC_matrices[fish_idx]
    
    # Extract upper triangle FC values
    fc_upper = fc_matrix[upper_indices]
    category_upper = connection_category[upper_indices]
    
    # Separate by category
    fc_bidirectional.extend(fc_upper[category_upper == 2])
    fc_unidirectional.extend(fc_upper[category_upper == 1])
    fc_unconnected.extend(fc_upper[category_upper == 0])

# Convert to arrays, flatten, and remove zeros
fc_bidirectional = np.array(fc_bidirectional).flatten()
fc_unidirectional = np.array(fc_unidirectional).flatten()
fc_unconnected = np.array(fc_unconnected).flatten()

# Remove zero and NaN values
fc_bidirectional = fc_bidirectional[(fc_bidirectional != 0) & np.isfinite(fc_bidirectional)]
fc_unidirectional = fc_unidirectional[(fc_unidirectional != 0) & np.isfinite(fc_unidirectional)]
fc_unconnected = fc_unconnected[(fc_unconnected != 0) & np.isfinite(fc_unconnected)]

print(f"FC value counts - Bidirectional: {len(fc_bidirectional)}, "
      f"Unidirectional: {len(fc_unidirectional)}, Unconnected: {len(fc_unconnected)}")

# Save FC values by category
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_Directionality_Corr_Bidirection.npy"), fc_bidirectional)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_Directionality_Corr_Unidirection.npy"), fc_unidirectional)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_Directionality_Corr_Unconnect.npy"), fc_unconnected)

# ============================================================================
# 4. Statistical Analysis
# ============================================================================

# Perform one-way ANOVA
f_statistic, p_value = f_oneway(fc_unconnected, fc_unidirectional, fc_bidirectional)
print(f"One-way ANOVA: F={f_statistic:.4f}, P={p_value:.4e}")

# Determine significance markers
if p_value < 0.0001:
    sig_marker = "****"
elif p_value < 0.001:
    sig_marker = "***"
elif p_value < 0.01:
    sig_marker = "**"
elif p_value < 0.05:
    sig_marker = "*"
else:
    sig_marker = "ns"

# ============================================================================
# 5. Visualization
# ============================================================================

fig = plt.figure(figsize=(6, 8))
gs = fig.add_gridspec(2, 1, height_ratios=[1, 1], hspace=0.3)

# ============================================================================
# Top Panel: Structural Connection Matrix
# ============================================================================

ax_matrix = fig.add_subplot(gs[0])

# Mask upper triangle (including diagonal)
masked_matrix = connection_category.copy().astype(float)
mask_upper = np.triu_indices(n_regions, k=0)
masked_matrix[mask_upper] = np.nan

# Display with gray colormap (0=black, 1=gray, 2=white)
# Use aspect='equal' to maintain square pixels
im = ax_matrix.imshow(masked_matrix, cmap='gray', vmin=0, vmax=2, aspect='equal')

# Add legend in upper-right area
legend_x = n_regions * 0.75
legend_y = n_regions * 0.15
ax_matrix.text(legend_x, legend_y, '0: Unconnected', fontsize=8, color='white',
               bbox=dict(boxstyle='round', facecolor='black', alpha=0.8))
ax_matrix.text(legend_x, legend_y + n_regions*0.08, '1: Unidirectional', fontsize=8, color='black',
               bbox=dict(boxstyle='round', facecolor='gray', alpha=0.8))
ax_matrix.text(legend_x, legend_y + n_regions*0.16, '2: Bidirectional', fontsize=8, color='black',
               bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

# Hide spines and ticks
ax_matrix.spines['top'].set_visible(False)
ax_matrix.spines['right'].set_visible(False)
ax_matrix.set_xticks([])
ax_matrix.set_yticks([])

# ============================================================================
# Bottom Panel: FC Density Distributions
# ============================================================================

ax_density = fig.add_subplot(gs[1])

# Define grid for density estimation
fc_min = min(fc_unconnected.min(), fc_unidirectional.min(), fc_bidirectional.min())
fc_max = max(fc_unconnected.max(), fc_unidirectional.max(), fc_bidirectional.max())
grid = np.linspace(fc_min, fc_max, 512)

# Function to compute smoothed histogram
def compute_smoothed_density(values, grid, sigma=20):
    hist, bin_edges = np.histogram(values, bins=200, density=True)
    bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])
    # Interpolate to grid
    density_interp = np.interp(grid, bin_centers, hist, left=0, right=0)
    # Apply Gaussian smoothing
    density_smooth = gaussian_filter1d(density_interp, sigma=sigma)
    return density_smooth

# Compute densities
density_unconnected = compute_smoothed_density(fc_unconnected, grid, sigma=20)
density_unidirectional = compute_smoothed_density(fc_unidirectional, grid, sigma=20)
density_bidirectional = compute_smoothed_density(fc_bidirectional, grid, sigma=20)

# Plot densities
ax_density.plot(grid, density_unconnected, color='black', linewidth=2, label='Unconnected')
ax_density.plot(grid, density_unidirectional, color='gray', linewidth=2, label='Unidirectional')

# For Bidirectional (White), we use path effects to add a black outline
# so it is visible against the white background.
line_bi = ax_density.plot(grid, density_bidirectional, color='white', linewidth=2, label='Bidirectional')[0]
line_bi.set_path_effects([pe.Stroke(linewidth=4, foreground='black'), pe.Normal()])

# Add fills
ax_density.fill_between(grid, density_unconnected, alpha=0.3, color='black')
ax_density.fill_between(grid, density_unidirectional, alpha=0.3, color='gray')
ax_density.fill_between(grid, density_bidirectional, alpha=0.3, color='lightgray')

# Find peak positions for significance bars
peak_unconnected = grid[np.argmax(density_unconnected)]
peak_bidirectional = grid[np.argmax(density_bidirectional)]
max_density = max(density_unconnected.max(), density_unidirectional.max(), density_bidirectional.max())

# Add significance bar
bar_y = max_density * 1.1
ax_density.plot([peak_unconnected, peak_bidirectional], [bar_y, bar_y], 'k-', linewidth=1.5)
ax_density.text((peak_unconnected + peak_bidirectional) / 2, bar_y * 1.05, sig_marker,
                ha='center', va='bottom', fontsize=12)

# Axis styling
ax_density.spines['top'].set_visible(False)
ax_density.spines['right'].set_visible(False)
ax_density.set_xlabel('Edge strength (FC)', fontsize=12)
ax_density.set_ylabel('Density', fontsize=12)
ax_density.legend(frameon=False, fontsize=10)

plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, 'figure_refine.png'), dpi=300, bbox_inches='tight')
plt.close()

print(f"Figure saved to {os.path.join(SAVE_DIR, 'figure_refine.png')}")

# ============================================================================
# 6. Save Statistics
# ============================================================================

statistics = {
    "sample_sizes": {
        "unconnected": int(len(fc_unconnected)),
        "unidirectional": int(len(fc_unidirectional)),
        "bidirectional": int(len(fc_bidirectional))
    },
    "means": {
        "unconnected": float(np.mean(fc_unconnected)),
        "unidirectional": float(np.mean(fc_unidirectional)),
        "bidirectional": float(np.mean(fc_bidirectional))
    },
    "std_devs": {
        "unconnected": float(np.std(fc_unconnected)),
        "unidirectional": float(np.std(fc_unidirectional)),
        "bidirectional": float(np.std(fc_bidirectional))
    },
    "anova_test": {
        "f_statistic": float(f_statistic),
        "p_value": float(p_value),
        "significance_marker": sig_marker
    }
}

with open(os.path.join(SAVE_DIR, 'statistics.json'), 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"Statistics saved to {os.path.join(SAVE_DIR, 'statistics.json')}")
print("Analysis complete!")
