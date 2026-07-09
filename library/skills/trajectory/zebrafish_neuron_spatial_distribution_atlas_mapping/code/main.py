import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
import h5py
from pathlib import Path
import colorsys

# Add shared toolkit to path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")
from zebrafish_Ca_utils import MapzebrainAtlas, get_datasets

# Environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure output directories exist
os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# =============================================================================
# Analysis Section
# =============================================================================

# 1. Initialize Atlas
atlas = MapzebrainAtlas(ATLAS_PATH)

# 2. Get all fish datasets
datasets = get_datasets(ZEBRAFISH_PATH, keywords=['fish'])
if len(datasets) < 1:
    raise RuntimeError(f"No fish datasets found in {ZEBRAFISH_PATH}")

print(f"Found {len(datasets)} fish datasets")

# 3. Calculate Neuronal Counts per Region
N_regions = 70  # Standard MapZebrain atlas has 70 regions
N_fish = len(datasets)
N_neurons_per_region = np.zeros((N_regions, N_fish), dtype=int)

for fish_idx, folder in enumerate(datasets):
    data_path = os.path.join(folder, "data.hdf5")
    if not os.path.exists(data_path):
        print(f"Warning: Missing data.hdf5 in {folder}")
        continue
    
    with h5py.File(data_path, 'r') as f:
        region_labels = np.array(f['region_labels'], dtype=bool)
        # Sum neurons per region
        for r in range(min(N_regions, region_labels.shape[1])):
            N_neurons_per_region[r, fish_idx] = np.sum(region_labels[:, r])

# Save the count matrix
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_N_neurons_per_region.npy"), N_neurons_per_region)

# 4. Define Exclusion Criteria
# Always exclude region 10 (Retina)
excluded_regions = [10]

# Exclude regions that don't have at least 25 neurons in at least 50% of datasets
threshold_count = 25
threshold_fraction = 0.5
for r in range(N_regions):
    if r == 10:  # Already excluded
        continue
    n_datasets_above_threshold = np.sum(N_neurons_per_region[r, :] >= threshold_count)
    if n_datasets_above_threshold < (N_fish * threshold_fraction):
        excluded_regions.append(r)

excluded_regions = np.array(sorted(excluded_regions), dtype=int)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy"), excluded_regions)
print(f"Excluded {len(excluded_regions)} regions: {excluded_regions}")

# 5. Statistical Reporting
# Create inclusion mask
included_mask = np.ones(N_regions, dtype=bool)
included_mask[excluded_regions] = False

# Calculate mean ± SD of neurons per fish (summed over included regions)
neurons_per_fish = np.sum(N_neurons_per_region[included_mask, :], axis=0)
mean_neurons = np.mean(neurons_per_fish)
std_neurons = np.std(neurons_per_fish, ddof=1)
print(f"Mean neurons per fish (included regions): {mean_neurons:.1f} ± {std_neurons:.1f}")

# 6. Generate Region Projections
# Top view: mean projection along axis 0 (vertical, collapse Z)
# Side view: mean projection along axis 2 (depth, collapse X)

projection_top = np.zeros(atlas.XYprojection.shape, dtype=float)
projection_side = np.zeros(atlas.XZprojection.shape, dtype=float)

for r in range(N_regions):
    if r == 10:  # Skip retina
        continue
    
    # Get region mask
    mask = atlas.getRegionMask(r, orientation='vertical')
    
    # Top view: mean along axis 0
    mean_proj_top = np.mean(mask, axis=0)
    projection_top += mean_proj_top
    
    # Side view: mean along axis 2
    mean_proj_side = np.mean(mask, axis=2)
    projection_side += mean_proj_side

# Normalize projections
if projection_top.max() > 0:
    projection_top = projection_top / projection_top.max()
if projection_side.max() > 0:
    projection_side = projection_side / projection_side.max()

# Save projections
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_projection_regions_top.npy"), projection_top)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_projection_regions_side.npy"), projection_side)

# =============================================================================
# Visualization Section
# =============================================================================

# 1. Load Data for Visualization
projection_top = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_projection_regions_top.npy"))
projection_side = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_projection_regions_side.npy"))
excluded_regions = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy"))

# Select the 2nd dataset (index 1)
if len(datasets) < 2:
    raise RuntimeError("Need at least 2 datasets to select the 2nd one")
representative_fish = datasets[1]

# Load representative fish data
data_path = os.path.join(representative_fish, "data.hdf5")
with h5py.File(data_path, 'r') as f:
    centroids_atlas = np.array(f['centroids_atlas'], dtype=float)
    region_labels = np.array(f['region_labels'], dtype=bool)

# Convert region_labels to categorical IDs
region_ids = np.argmax(region_labels, axis=1)  # Get the first True column for each neuron
has_label = np.any(region_labels, axis=1)

# Filter neurons: exclude those in excluded_regions or unlabeled
keep_mask = has_label.copy()
for neuron_idx in range(len(region_ids)):
    if region_ids[neuron_idx] in excluded_regions:
        keep_mask[neuron_idx] = False

centroids_filtered = centroids_atlas[keep_mask]
region_ids_filtered = region_ids[keep_mask]

# 2. Generate Color Palette
# 11 evenly spaced hues (saturation=65%, value=90%)
n_base_colors = 11
hues = np.linspace(0, 1, n_base_colors, endpoint=False)
base_palette = []
for h in hues:
    rgb = colorsys.hsv_to_rgb(h, 0.65, 0.90)
    base_palette.append(rgb)

# Repeat palette to cover all regions
max_region_id = np.max(region_ids_filtered) if len(region_ids_filtered) > 0 else 0
n_repeats = (max_region_id // n_base_colors) + 1
extended_palette = (base_palette * n_repeats)[:max_region_id + 1]

# Assign colors to filtered neurons
neuron_colors = [extended_palette[rid] for rid in region_ids_filtered]

# 3. Create Figure
fig = plt.figure(figsize=(8, 6))
gs = fig.add_gridspec(1, 2, width_ratios=[0.6, 0.4], hspace=0, wspace=0)

# Top View Panel (Left, 60%)
ax_top = fig.add_subplot(gs[0, 0])
ax_top.imshow(projection_top, cmap='binary', aspect='equal', origin='lower', vmin=0, vmax=1)
if len(centroids_filtered) > 0:
    ax_top.scatter(
        centroids_filtered[:, 0],  # X coordinate
        centroids_filtered[:, 1],  # Y coordinate
        c=neuron_colors,
        s=2,
        alpha=0.6,
        edgecolors='none'
    )
ax_top.set_xlim([65, 505])
ax_top.set_ylim([850, 50])
ax_top.axis('off')

# Side View Panel (Right, 40%)
ax_side = fig.add_subplot(gs[0, 1])

# Rotate side projection 90 degrees clockwise (k=3 for clockwise)
projection_side_rotated = np.rot90(projection_side, k=3)
ax_side.imshow(projection_side_rotated, cmap='binary', aspect='equal', origin='lower', vmin=0, vmax=1)

# Transform centroids for side view: invert Z coordinate
if len(centroids_filtered) > 0:
    z_coords = centroids_filtered[:, 2]
    y_coords = centroids_filtered[:, 1]
    
    # Invert Z to match rotated view
    z_inverted = 359 - z_coords
    
    ax_side.scatter(
        z_inverted,  # Inverted Z as X in side view
        y_coords,    # Y coordinate
        c=neuron_colors,
        s=2,
        alpha=0.6,
        edgecolors='none'
    )

ax_side.set_xlim([40, 359])
ax_side.set_ylim([850, 50])
ax_side.axis('off')

plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, "figure.png"), dpi=300, bbox_inches='tight')
plt.close()

print(f"✅ Figure saved to {os.path.join(SAVE_DIR, 'figure.png')}")

# =============================================================================
# Save Statistics
# =============================================================================

statistics = {
    "total_fish": int(N_fish),
    "total_regions": int(N_regions),
    "n_excluded_regions": int(len(excluded_regions)),
    "excluded_region_ids": excluded_regions.tolist(),
    "mean_neurons_per_fish": float(mean_neurons),
    "std_neurons_per_fish": float(std_neurons),
    "min_neurons_per_fish": float(np.min(neurons_per_fish)),
    "max_neurons_per_fish": float(np.max(neurons_per_fish)),
    "median_neurons_per_fish": float(np.median(neurons_per_fish)),
    "representative_fish_index": 1,
    "representative_fish_name": os.path.basename(representative_fish),
    "n_neurons_in_representative_fish_after_filtering": int(len(centroids_filtered))
}

with open(os.path.join(SAVE_DIR, "statistics.json"), "w") as f:
    json.dump(statistics, f, indent=2)

print(f"✅ Statistics saved to {os.path.join(SAVE_DIR, 'statistics.json')}")
print(f"Mean ± SD neurons per fish (included regions): {mean_neurons:.1f} ± {std_neurons:.1f}")
