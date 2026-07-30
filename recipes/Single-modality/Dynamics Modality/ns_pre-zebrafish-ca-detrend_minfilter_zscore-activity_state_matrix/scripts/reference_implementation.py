import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter1d
from scipy.stats import zscore

# Add shared toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import (
    MapzebrainAtlas,
    get_datasets,
    compute_dff_using_minfilter
)

# Environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Create output directories
os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# Constants
RETINA_INDEX_UNILATERAL = 10
SMOOTHING_SIGMA = 2
DFF_WINDOW = 30
DFF_SIGMA1 = 3
DFF_SIGMA2 = 30

# Step 1: Discover fish datasets
fish_folders = get_datasets(ZEBRAFISH_PATH, keywords=['fish'])
fish_folders = sorted(fish_folders)

if len(fish_folders) == 0:
    raise RuntimeError(f"No fish folders found under {ZEBRAFISH_PATH}")

print(f"Found {len(fish_folders)} fish datasets")

# Step 2: Identify regions to exclude
# Always exclude retina (index 10 in unilateral = [10, 80] in bilateral)
# Find regions with zero signal in any larva
excluded_regions_bilateral = set([RETINA_INDEX_UNILATERAL, RETINA_INDEX_UNILATERAL + 70])

all_bilateral_data = []
for folder in fish_folders:
    bilateral_file = os.path.join(folder, "region_series_dff_bilateral.npy")
    if not os.path.exists(bilateral_file):
        print(f"Warning: {bilateral_file} not found, skipping.")
        continue
    
    rseries_bilateral = np.load(bilateral_file)  # shape: (140, time)
    all_bilateral_data.append(rseries_bilateral)
    
    # Check for zero signals
    for region_idx in range(rseries_bilateral.shape[0]):
        if np.any(rseries_bilateral[region_idx] == 0):
            excluded_regions_bilateral.add(region_idx)

if len(all_bilateral_data) == 0:
    raise RuntimeError("No valid bilateral data files found")

# Apply symmetry: if region i is excluded, exclude i+70 (or i-70 if i>=70)
excluded_list = sorted(excluded_regions_bilateral)
symmetric_excluded = set(excluded_list)
for idx in excluded_list:
    if idx < 70:
        symmetric_excluded.add(idx + 70)
    else:
        symmetric_excluded.add(idx - 70)

excluded_regions_bilateral = sorted(symmetric_excluded)
excluded_regions_bilateral_array = np.array(excluded_regions_bilateral, dtype=int)

# Save excluded regions
np.save(
    os.path.join(PROCESS_DATA_DIR, "Figure4_excluded_regions_bilateral.npy"),
    excluded_regions_bilateral_array
)
print(f"Excluded bilateral regions: {excluded_regions_bilateral}")

# Step 3: Load and process data for all fish
# Extract fish IDs and sort
fish_ids = []
fish_data_dict = {}

for folder in fish_folders:
    bilateral_file = os.path.join(folder, "region_series_dff_bilateral.npy")
    if not os.path.exists(bilateral_file):
        continue
    
    # Extract fish ID from folder name (e.g., "fish1" -> 1)
    folder_name = os.path.basename(folder.rstrip('/'))
    if folder_name.startswith('fish'):
        try:
            fish_id = int(folder_name.replace('fish', ''))
            fish_ids.append(fish_id)
            fish_data_dict[fish_id] = bilateral_file
        except ValueError:
            print(f"Warning: Could not parse fish ID from {folder_name}")
            continue

# Sort by fish ID
fish_ids = sorted(fish_ids)

# Assert sequential IDs
expected_ids = list(range(1, len(fish_ids) + 1))
assert fish_ids == expected_ids, f"Fish IDs are not sequential: {fish_ids}"

print(f"Processing {len(fish_ids)} fish in order: {fish_ids}")

# Process each fish
processed_fish_data = []
time_lengths = []

for fish_id in fish_ids:
    bilateral_file = fish_data_dict[fish_id]
    
    # Load bilateral data
    rseries_bilateral = np.load(bilateral_file)  # shape: (140, time)
    
    # Smooth with Gaussian filter
    rseries_smoothed = np.zeros_like(rseries_bilateral)
    for region_idx in range(rseries_bilateral.shape[0]):
        rseries_smoothed[region_idx] = gaussian_filter1d(
            rseries_bilateral[region_idx],
            sigma=SMOOTHING_SIGMA
        )
    
    # Remove excluded regions
    keep_mask = np.ones(140, dtype=bool)
    keep_mask[excluded_regions_bilateral] = False
    rseries_filtered = rseries_smoothed[keep_mask]  # shape: (n_regions_kept, time)
    
    # Detrend and normalize using compute_dff_using_minfilter
    rseries_dff = compute_dff_using_minfilter(
        rseries_filtered,
        window=DFF_WINDOW,
        sigma1=DFF_SIGMA1,
        sigma2=DFF_SIGMA2
    )
    
    # Z-score along time axis
    rseries_zscore = np.zeros_like(rseries_dff)
    for region_idx in range(rseries_dff.shape[0]):
        rseries_zscore[region_idx] = zscore(rseries_dff[region_idx], nan_policy='omit')
    
    # Replace NaNs with 0
    rseries_zscore = np.nan_to_num(rseries_zscore, nan=0.0)
    
    processed_fish_data.append(rseries_zscore)
    time_lengths.append(rseries_zscore.shape[1])
    
    print(f"Fish {fish_id}: processed shape {rseries_zscore.shape}")

# Step 4: Save ordered dataset (3D array)
# Stack as (n_fish, n_regions, n_timepoints)
# Note: if time lengths differ, we need to handle this
min_time = min(time_lengths)
max_time = max(time_lengths)

if min_time != max_time:
    print(f"Warning: Time lengths vary from {min_time} to {max_time}. Truncating to minimum.")
    # Truncate all to minimum length
    processed_fish_data_truncated = [arr[:, :min_time] for arr in processed_fish_data]
    rseries_3d = np.stack(processed_fish_data_truncated, axis=0)
else:
    rseries_3d = np.stack(processed_fish_data, axis=0)

np.save(
    os.path.join(PROCESS_DATA_DIR, "Figure4_rseries.npy"),
    rseries_3d
)
print(f"Saved rseries_3d with shape: {rseries_3d.shape}")

# Step 5: Concatenate along time axis to create state matrix
state_matrix = np.concatenate(processed_fish_data, axis=1)  # shape: (n_regions, total_time)

np.save(
    os.path.join(PROCESS_DATA_DIR, "Figure4_state_matrix.npy"),
    state_matrix
)
print(f"Saved state_matrix with shape: {state_matrix.shape}")

# Step 6: Visualize state matrix
n_regions_kept = state_matrix.shape[0]
total_time = state_matrix.shape[1]

fig, ax = plt.subplots(figsize=(21, 3))

# Plot heatmap
im = ax.imshow(
    state_matrix,
    cmap='hot',
    aspect='auto',
    vmin=-1,
    vmax=3,
    interpolation='nearest'
)

# Add horizontal dashed white line at midpoint
midpoint_y = n_regions_kept / 2
ax.axhline(midpoint_y, color='white', linestyle='--', linewidth=1.5)

# Add vertical white lines at fish boundaries
cumulative_time = 0
fish_boundaries = [0]
for t_len in time_lengths:
    cumulative_time += t_len
    fish_boundaries.append(cumulative_time)
    if cumulative_time < total_time:
        ax.axvline(cumulative_time, color='white', linestyle='-', linewidth=1.5)

# Label fish IDs at the top of each block
for i, fish_id in enumerate(fish_ids):
    start_idx = fish_boundaries[i]
    end_idx = fish_boundaries[i + 1]
    mid_idx = (start_idx + end_idx) / 2
    ax.text(
        mid_idx,
        -0.02 * n_regions_kept,
        f"Fish {fish_id}",
        ha='center',
        va='top',
        fontsize=8,
        color='black'
    )

# Y-axis labels
# Label start and end region IDs (1-indexed)
ax.set_yticks([0, n_regions_kept - 1])
ax.set_yticklabels([1, n_regions_kept])

# Add "Left" and "Right" labels
left_y = midpoint_y / 2
right_y = midpoint_y + (n_regions_kept - midpoint_y) / 2
ax.text(
    -0.01 * total_time,
    left_y,
    "Left",
    ha='right',
    va='center',
    fontsize=10,
    rotation=90
)
ax.text(
    -0.01 * total_time,
    right_y,
    "Right",
    ha='right',
    va='center',
    fontsize=10,
    rotation=90
)
ax.set_ylabel("Brain Regions", fontsize=12, labelpad=30)

# X-axis labels
ax.set_xticks([0, total_time - 1])
ax.set_xticklabels([1, total_time])
ax.set_xlabel("Imaging Volumes", fontsize=12)

# Colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.02, pad=0.01)
cbar.set_label("Activity (z-scored)", rotation=270, labelpad=15, fontsize=10)

plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, "figure.png"), dpi=300, bbox_inches='tight')
plt.close()

print("Figure saved to figure.png")

# Step 7: Save statistics
statistics = {
    "n_fish": len(fish_ids),
    "fish_ids": fish_ids,
    "n_regions_bilateral_original": 140,
    "n_excluded_regions_bilateral": len(excluded_regions_bilateral),
    "excluded_regions_bilateral": excluded_regions_bilateral,
    "n_regions_kept": int(n_regions_kept),
    "time_lengths_per_fish": [int(t) for t in time_lengths],
    "total_time_concatenated": int(total_time),
    "state_matrix_shape": list(state_matrix.shape),
    "rseries_3d_shape": list(rseries_3d.shape),
    "activity_mean": float(np.mean(state_matrix)),
    "activity_std": float(np.std(state_matrix)),
    "activity_min": float(np.min(state_matrix)),
    "activity_max": float(np.max(state_matrix)),
    "activity_median": float(np.median(state_matrix)),
    "activity_percentile_25": float(np.percentile(state_matrix, 25)),
    "activity_percentile_75": float(np.percentile(state_matrix, 75))
}

with open(os.path.join(SAVE_DIR, "statistics.json"), 'w') as f:
    json.dump(statistics, f, indent=2)

print("Statistics saved to statistics.json")
print("Processing complete!")
