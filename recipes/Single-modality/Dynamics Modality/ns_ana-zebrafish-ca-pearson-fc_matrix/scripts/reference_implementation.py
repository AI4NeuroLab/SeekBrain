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
            print(f"Skipping {folder}: region_series_dff.npy not found")
            continue
        
        region_series = np.load(region_series_path)
        
        # Ensure 2D array [regions, time]
        if region_series.ndim != 2:
            print(f"Skipping {folder}: invalid array shape {region_series.shape}")
            continue
        
        # Truncate to first 600 time points
        if region_series.shape[1] < TIME_POINTS:
            print(f"Skipping {folder}: insufficient time points ({region_series.shape[1]} < {TIME_POINTS})")
            continue
        
        region_series = region_series[:, :TIME_POINTS]
        
        # Apply Gaussian smoothing to each region (sigma=2)
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
print(f"Stacked FC matrices shape: {fc_matrices_stack.shape}")

# Remove excluded regions from both dimensions
num_regions = fc_matrices_stack.shape[1]
keep_mask = np.ones(num_regions, dtype=bool)
keep_mask[excluded_regions] = False

fc_matrices_filtered = fc_matrices_stack[:, keep_mask, :][:, :, keep_mask]
print(f"FC matrices after exclusion shape: {fc_matrices_filtered.shape}")

# 5. Save individual FC matrices
fc_output_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrices.npy")
np.save(fc_output_path, fc_matrices_filtered)
print(f"Saved individual FC matrices to {fc_output_path}")

# 6. Compute group-average FC matrix (handling NaNs)
fc_avg = np.nanmean(fc_matrices_filtered, axis=0)
print(f"Average FC matrix shape: {fc_avg.shape}")

# Save group-averaged FC matrix
fc_avg_output_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
np.save(fc_avg_output_path, fc_avg)
print(f"Saved average FC matrix to {fc_avg_output_path}")

# 7. Create visualization of lower triangle
fig, ax = plt.subplots(figsize=(6, 6))

# Create mask for lower triangle (excluding diagonal)
n_regions = fc_avg.shape[0]
mask = np.triu(np.ones((n_regions, n_regions), dtype=bool), k=0)
fc_avg_masked = fc_avg.copy()
fc_avg_masked[mask] = np.nan

# Plot with imshow
im = ax.imshow(
    fc_avg_masked,
    cmap='Reds',
    vmin=0.2,
    vmax=0.9,
    aspect='equal',
    origin='upper'
)

# Add colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label('FC', rotation=270, labelpad=15)

# Set ticks to show only first and last region indices
ax.set_yticks([0, n_regions - 1])
ax.set_yticklabels([1, n_regions])
ax.set_xticks([0, n_regions - 1])
ax.set_xticklabels([1, n_regions])

# Labels
ax.set_ylabel('Brain regions')
ax.set_xlabel('')

# Title with number of larvae
ax.set_title(f'Average functional connectivity\n(n={valid_fish_count} larvae)')

plt.tight_layout()

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()
print(f"Saved figure to {figure_path}")

# 8. Save statistics to JSON
# Compute statistics on the average FC matrix (lower triangle only)
lower_triangle_indices = np.tril_indices(n_regions, k=-1)
fc_lower_values = fc_avg[lower_triangle_indices]
fc_lower_valid = fc_lower_values[np.isfinite(fc_lower_values)]

statistics = {
    "n_larvae": int(valid_fish_count),
    "n_regions_after_exclusion": int(n_regions),
    "n_excluded_regions": int(len(excluded_regions)),
    "fc_mean": float(np.nanmean(fc_avg)),
    "fc_std": float(np.nanstd(fc_avg)),
    "fc_median": float(np.nanmedian(fc_avg)),
    "fc_min": float(np.nanmin(fc_avg)),
    "fc_max": float(np.nanmax(fc_avg)),
    "fc_lower_triangle_mean": float(np.mean(fc_lower_valid)),
    "fc_lower_triangle_std": float(np.std(fc_lower_valid)),
    "fc_lower_triangle_median": float(np.median(fc_lower_valid)),
    "fc_percentile_25": float(np.nanpercentile(fc_avg, 25)),
    "fc_percentile_75": float(np.nanpercentile(fc_avg, 75)),
    "n_valid_connections": int(np.sum(np.isfinite(fc_lower_values))),
    "time_points_used": int(TIME_POINTS),
    "smoothing_sigma": float(SMOOTH_SIGMA)
}

# Save statistics to JSON
stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)
print(f"Saved statistics to {stats_path}")

print("Analysis complete!")
