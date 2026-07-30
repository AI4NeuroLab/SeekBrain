import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter1d

# Add shared toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import get_datasets, compute_correlation_matrix

# Get environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Validate paths
if not ZEBRAFISH_PATH:
    raise ValueError("ZEBRAFISH_PATH environment variable must be set")
if not PROCESS_DATA_DIR:
    raise ValueError("PROCESS_DATA_DIR environment variable must be set")
if not SAVE_DIR:
    raise ValueError("SAVE_DIR environment variable must be set")

# Create output directories
os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# Constants
SMOOTH_SIGMA = 2
TIME_POINTS = 600

# 1. Discover fish datasets
fish_folders = get_datasets(ZEBRAFISH_PATH, keywords=['fish'])
if len(fish_folders) == 0:
    raise RuntimeError(f"No fish folders found under {ZEBRAFISH_PATH}")

print(f"Found {len(fish_folders)} fish folders")

# 2. Load excluded regions
excluded_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
if not os.path.exists(excluded_path):
    raise FileNotFoundError(f"Excluded regions file not found: {excluded_path}")

excluded_regions = np.load(excluded_path).astype(int)
print(f"Loaded {len(excluded_regions)} excluded regions")

# 3. Process each fish and compute FC matrices
fc_matrices_list = []
valid_fish_count = 0

for folder in fish_folders:
    try:
        # Load region series
        region_series_path = os.path.join(folder, "region_series_dff.npy")
        if not os.path.exists(region_series_path):
            continue
        
        region_series = np.load(region_series_path)
        
        # Ensure 2D array [regions, time]
        if region_series.ndim != 2:
            continue
        
        # Truncate to first 600 time points
        if region_series.shape[1] < TIME_POINTS:
            continue
        
        region_series = region_series[:, :TIME_POINTS]
        
        # Apply Gaussian smoothing to each region
        smoothed_series = np.zeros_like(region_series, dtype=np.float64)
        for i in range(region_series.shape[0]):
            smoothed_series[i] = gaussian_filter1d(
                np.asarray(region_series[i], dtype=np.float64),
                sigma=SMOOTH_SIGMA
            )
        
        # Compute Pearson correlation matrix (FC)
        fc_matrix = compute_correlation_matrix(smoothed_series, arctanh=False)
        
        fc_matrices_list.append(fc_matrix)
        valid_fish_count += 1
        
    except Exception as e:
        print(f"Error processing {folder}: {e}")
        continue

if valid_fish_count == 0:
    raise RuntimeError("No valid fish datasets were processed")

print(f"Successfully processed {valid_fish_count} fish")

# 4. Stack FC matrices and remove excluded regions
fc_matrices_stack = np.array(fc_matrices_list, dtype=np.float64)

# Remove excluded regions from both dimensions
num_regions_orig = fc_matrices_stack.shape[1]
keep_mask = np.ones(num_regions_orig, dtype=bool)
# Ensure indices are within bounds
valid_excluded = excluded_regions[excluded_regions < num_regions_orig]
keep_mask[valid_excluded] = False

fc_matrices_filtered = fc_matrices_stack[:, keep_mask, :][:, :, keep_mask]

# 5. Save individual FC matrices
fc_output_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrices.npy")
np.save(fc_output_path, fc_matrices_filtered)

# 6. Compute group-average FC matrix
fc_avg = np.nanmean(fc_matrices_filtered, axis=0)

# Save group-averaged FC matrix
fc_avg_output_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
np.save(fc_avg_output_path, fc_avg)

# 7. Create visualization
fig, ax = plt.subplots(figsize=(6, 6))

n_regions = fc_avg.shape[0]

# Create mask for upper triangle AND diagonal
# k=0 includes the main diagonal in the mask (i.e. indices where i <= j)
mask = np.triu(np.ones((n_regions, n_regions), dtype=bool), k=0)
fc_avg_masked = fc_avg.copy()
fc_avg_masked[mask] = np.nan

# Plot with imshow
# interpolation='none' is crucial to prevent color bleeding into the masked diagonal
im = ax.imshow(
    fc_avg_masked,
    cmap='Reds',
    vmin=0.2,
    vmax=0.9,
    aspect='equal',
    origin='upper',
    interpolation='none'
)

# Add colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label('FC', rotation=270, labelpad=15)

# Set ticks to show only first and last region indices
# Ticks are placed at index 0 and index N-1
ax.set_yticks([0, n_regions - 1])
ax.set_yticklabels([1, n_regions])
ax.set_xticks([0, n_regions - 1])
ax.set_xticklabels([1, n_regions])

# Labels
ax.set_ylabel('Brain regions')
ax.set_xlabel('') 

# Title
ax.set_title(f'Average functional connectivity\n(n={valid_fish_count} larvae)')

plt.tight_layout()

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()

# 8. Save statistics
lower_triangle_indices = np.tril_indices(n_regions, k=-1)
fc_lower_values = fc_avg[lower_triangle_indices]
fc_lower_valid = fc_lower_values[np.isfinite(fc_lower_values)]

statistics = {
    "n_larvae": int(valid_fish_count),
    "n_regions_original": int(num_regions_orig),
    "n_regions_after_exclusion": int(n_regions),
    "n_excluded_regions": int(len(excluded_regions)),
    "fc_mean": float(np.nanmean(fc_avg)),
    "fc_lower_triangle_mean": float(np.mean(fc_lower_valid)) if len(fc_lower_valid) > 0 else 0.0
}

stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print("Analysis complete!")
