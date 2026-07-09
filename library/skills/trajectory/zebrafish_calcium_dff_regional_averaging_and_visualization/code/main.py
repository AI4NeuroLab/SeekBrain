import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter1d, minimum_filter1d
import h5py
from tqdm import tqdm

# Add library path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")
from zebrafish_Ca_utils import get_datasets

# Get environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# Load atlas acronyms
acronyms_path = os.path.join(ATLAS_PATH, "acronyms.txt")
with open(acronyms_path, "r") as f:
    region_acronyms = [line.strip() for line in f.readlines()]

# Get all fish datasets
fish_folders = get_datasets(ZEBRAFISH_PATH, keywords=['fish'])
fish_folders = sorted(fish_folders)

print(f"Found {len(fish_folders)} fish datasets")

# ========== PART 1: PROCESSING PIPELINE ==========
processed_count = 0
# Removed the limit to process all fish as requested
for fish_folder in tqdm(fish_folders, desc="Processing fish"):
    fish_name = os.path.basename(fish_folder.rstrip('/'))
    
    # Check if already processed
    dff_output = os.path.join(PROCESS_DATA_DIR, f"Figure1_dff_{fish_name}.npy")
    regional_output = os.path.join(PROCESS_DATA_DIR, f"Figure1_region_series_dff_{fish_name}.npy")
    
    if os.path.exists(dff_output) and os.path.exists(regional_output):
        processed_count += 1
        continue
    
    # Load data.hdf5
    data_path = os.path.join(fish_folder, "data.hdf5")
    if not os.path.exists(data_path):
        print(f"  Skipping {fish_name}: data.hdf5 not found")
        continue
    
    try:
        with h5py.File(data_path, 'r') as f:
            timeseries = np.array(f['timeseries'], dtype=np.float64)  # [neurons, time]
            region_labels = np.array(f['region_labels'], dtype=bool)  # [neurons, regions]
        
        # Step 1: Fix first-frame artifact
        timeseries[:, 0] = timeseries[:, 1]
        
        # Step 2: Baseline correction & normalization (compute ΔF/F0)
        dff = np.zeros_like(timeseries, dtype=np.float64)
        for i in range(timeseries.shape[0]):
            signal = timeseries[i]
            
            # Pre-smooth with sigma=3
            smooth1 = gaussian_filter1d(signal, sigma=3)
            
            # Minimum filter with window=300
            baseline = minimum_filter1d(smooth1, size=300, mode='nearest')
            
            # Post-smooth with sigma=60
            baseline = gaussian_filter1d(baseline, sigma=60)
            
            # Compute ΔF/F0 with safety
            baseline_safe = np.maximum(baseline, 1e-10)
            dff[i] = (signal - baseline) / baseline_safe
        
        # Validate: no NaN or Inf
        assert not np.any(np.isnan(dff)), f"NaN detected in dff for {fish_name}"
        assert not np.any(np.isinf(dff)), f"Inf detected in dff for {fish_name}"
        
        # Step 3: Regional averaging
        n_regions = region_labels.shape[1]
        n_time = timeseries.shape[1]
        region_series_dff = np.zeros((n_regions, n_time), dtype=np.float64)
        
        for r in range(n_regions):
            mask = region_labels[:, r]
            if np.any(mask):
                region_series_dff[r] = np.mean(dff[mask], axis=0)
            else:
                region_series_dff[r] = np.nan
        
        # Step 4: Save outputs
        np.save(dff_output, dff)
        np.save(regional_output, region_series_dff)
        
        processed_count += 1
        
    except Exception as e:
        print(f"  Error processing {fish_name}: {e}")
        continue

print(f"Successfully processed {processed_count} fish datasets")

# ========== PART 2: VISUALIZATION ==========
# Find fish2 folder
fish2_folder = None
for f in fish_folders:
    if 'fish2' in os.path.basename(f.rstrip('/')).lower():
        fish2_folder = f
        break

if fish2_folder is None:
    raise FileNotFoundError("Could not find fish2 dataset")

fish2_name = os.path.basename(fish2_folder.rstrip('/'))

# Load fish2 data
fish2_regional_path = os.path.join(PROCESS_DATA_DIR, f"Figure1_region_series_dff_{fish2_name}.npy")
if not os.path.exists(fish2_regional_path):
    raise FileNotFoundError(f"Regional series for fish2 not found at {fish2_regional_path}")

fish2_regional = np.load(fish2_regional_path)

# Load timesteps
with h5py.File(os.path.join(fish2_folder, "data.hdf5"), 'r') as f:
    timesteps_fish2 = np.array(f['timesteps'], dtype=np.float64)

# Load or create exclusion list
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
if os.path.exists(excluded_regions_path):
    excluded_regions = np.load(excluded_regions_path).astype(int)
else:
    excluded_regions = np.array([], dtype=int)

# Filter out excluded regions
mask = np.ones(fish2_regional.shape[0], dtype=bool)
if len(excluded_regions) > 0:
    mask[excluded_regions] = False

fish2_regional_filtered = fish2_regional[mask]
region_acronyms_filtered = [region_acronyms[i] for i in range(len(mask)) if mask[i]]

# Process traces: smooth and normalize
n_regions_filtered = fish2_regional_filtered.shape[0]
traces_processed = np.zeros_like(fish2_regional_filtered, dtype=np.float64)

for i in range(n_regions_filtered):
    # Smooth with sigma=1
    smoothed = gaussian_filter1d(fish2_regional_filtered[i], sigma=1)
    
    # Min-max normalization
    min_val = np.nanmin(smoothed)
    max_val = np.nanmax(smoothed)
    if max_val - min_val > 1e-10:
        traces_processed[i] = (smoothed - min_val) / (max_val - min_val)
    else:
        traces_processed[i] = 0

# Create figure
fig, ax = plt.subplots(figsize=(5, 6))
ax.axis('off')

# Vertical offset for stacking
offset = 0.5

# Plot traces (top to bottom, OE to VSL)
for i in range(n_regions_filtered):
    y_offset = (n_regions_filtered - 1 - i) * offset
    ax.plot(timesteps_fish2, traces_processed[i] + y_offset, color='black', linewidth=0.5)

# Add region acronyms on the right
text_x = timesteps_fish2[-1] + 20
for i in range(n_regions_filtered):
    y_offset = (n_regions_filtered - 1 - i) * offset
    ax.text(text_x, y_offset + 0.25, region_acronyms_filtered[i], va='center', ha='left', fontsize=6)

# Add "Anterior <–––> Posterior" label on far right
# Increased spacing to 250 to avoid overlap with region names
far_right_x = text_x + 250
mid_y = (n_regions_filtered - 1) * offset / 2

# Rotate 270 degrees (Top-to-Bottom). 
# Start of string "Anterior" is at top, matching Top (Anterior) regions like OE.
ax.text(far_right_x, mid_y, "Anterior <–––> Posterior", rotation=270, va='center', ha='center', fontsize=7)

# Add y-axis label on the left
ax.text(-80, mid_y, "Regional fluorescence (normalized)", rotation=90, va='center', ha='right', fontsize=8)

# Add 2-minute scale bar at bottom left
bar_duration = 120  # seconds
bar_start_x = 50
bar_y = -offset * 1.5
bar_end_x = bar_start_x + bar_duration
ax.plot([bar_start_x, bar_end_x], [bar_y, bar_y], color='black', linewidth=2)
ax.text((bar_start_x + bar_end_x) / 2, bar_y - 0.5, "2 min", ha='center', va='top', fontsize=7)

# Highlight visual stimulation period (11th–14th minute = 660–840 seconds)
stim_start = 660
stim_end = 840
ax.axvspan(stim_start, stim_end, color='orange', alpha=0.3, zorder=0)
# Add label at top
ax.text((stim_start + stim_end) / 2, n_regions_filtered * offset + 0.5, "stimuli", 
        ha='center', va='bottom', fontsize=7, color='darkorange', weight='bold')

# Set axis limits
# Extend right limit to accommodate the far right label
ax.set_xlim(-100, far_right_x + 100)
ax.set_ylim(bar_y - 1, n_regions_filtered * offset + 1.5)

plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, "figure_refine.png"), dpi=300, bbox_inches='tight')
plt.close()

print(f"✅ Figure saved to {os.path.join(SAVE_DIR, 'figure_refine.png')}")

# ========== SAVE STATISTICS ==========
statistics = {
    "n_fish_total": len(fish_folders),
    "n_fish_processed": processed_count,
    "n_regions_total": len(region_acronyms),
    "n_excluded_regions": int(len(excluded_regions)),
    "n_regions_plotted": int(n_regions_filtered),
    "fish2_name": fish2_name,
    "fish2_timeseries_shape": list(fish2_regional.shape),
    "fish2_time_range_seconds": [float(timesteps_fish2[0]), float(timesteps_fish2[-1])],
    "visual_stimulation_period_seconds": [stim_start, stim_end],
    "baseline_window_frames": 300,
    "gaussian_sigma1_prefilter": 3,
    "gaussian_sigma2_postfilter": 60,
    "plot_smoothing_sigma": 1,
    "vertical_offset": offset,
    "scale_bar_duration_seconds": bar_duration,
    "region_acronyms_plotted": region_acronyms_filtered[:10],
    "processing_notes": "First frame artifact corrected. Baseline estimated (G3->Min300->G60). Regional traces smoothed (sigma=1) and min-max normalized. Anatomical label rotated 270 deg."
}

with open(os.path.join(SAVE_DIR, "statistics.json"), "w") as f:
    json.dump(statistics, f, indent=2)

print(f"✅ Statistics saved to {os.path.join(SAVE_DIR, 'statistics.json')}")
