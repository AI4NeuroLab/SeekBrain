import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from scipy.ndimage import gaussian_filter1d
from statsmodels.stats.multitest import multipletests

# Add library path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *

# Get directories
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure directories exist
os.makedirs(SAVE_DIR, exist_ok=True)

# ========== Helper Functions ==========

def compute_RMS(timeseries):
    """
    Computes Root-Mean-Square (RMS) of pairwise coactivations for each timepoint.
    
    Args:
        timeseries: (N_regions, T_frames) array.
        
    Returns:
        RMS vector of shape (T_frames,).
    """
    R, T = timeseries.shape
    rms_values = []
    triu_indices = np.triu_indices(R, 1)
    for i in range(T):
        c = timeseries[:, i]
        coactivation = np.outer(c, c)
        val = np.sqrt(np.mean(coactivation[triu_indices] ** 2))
        rms_values.append(val)
    return np.array(rms_values)


def permute_timeseries(timeseries):
    """
    Circularly permute each region's time series by a random offset.
    
    Args:
        timeseries: (N_regions, T_frames) array for one fish.
        
    Returns:
        Permuted timeseries array.
    """
    R, T = timeseries.shape
    permuted = np.zeros_like(timeseries)
    for r in range(R):
        shift = np.random.randint(0, T)
        permuted[r] = np.roll(timeseries[r], shift)
    return permuted


# ========== Load Data ==========

print("Loading data...")
state_matrix_path = os.path.join(PROCESS_DATA_DIR, "Figure4_state_matrix.npy")
rseries_path = os.path.join(PROCESS_DATA_DIR, "Figure4_rseries.npy")

if not os.path.exists(state_matrix_path):
    raise FileNotFoundError(f"State matrix not found: {state_matrix_path}")
if not os.path.exists(rseries_path):
    raise FileNotFoundError(f"Regional time series not found: {rseries_path}")

state_matrix = np.load(state_matrix_path)  # Shape: (n_regions, n_total_timepoints)
rseries = np.load(rseries_path)  # Shape: (n_fish, n_regions, n_timepoints_per_fish)

n_fish, n_regions, n_timepoints_per_fish = rseries.shape
n_total_timepoints = state_matrix.shape[1]

# Validation
assert state_matrix.shape[1] == n_fish * n_timepoints_per_fish, \
    f"State matrix timepoints ({state_matrix.shape[1]}) != n_fish * n_timepoints_per_fish ({n_fish * n_timepoints_per_fish})"

print(f"Loaded state_matrix: {state_matrix.shape}")
print(f"Loaded rseries: {rseries.shape}")
print(f"n_fish={n_fish}, n_regions={n_regions}, n_timepoints_per_fish={n_timepoints_per_fish}")

# ========== Compute Empirical RMS ==========

print("Computing empirical RMS...")
RMS = compute_RMS(state_matrix)
rms_path = os.path.join(PROCESS_DATA_DIR, "Figure4_RMS.npy")
np.save(rms_path, RMS)
print(f"Saved empirical RMS to {rms_path}")

# ========== Generate Null Distribution ==========

print("Generating null RMS distribution (100 permutations)...")
null_RMS_list = []
np.random.seed(42)

for perm_idx in range(100):
    # Permute each fish independently
    permuted_fish = []
    for fish_idx in range(n_fish):
        perm = permute_timeseries(rseries[fish_idx])
        permuted_fish.append(perm)
    
    # Concatenate along time axis to form null state matrix
    null_state = np.concatenate(permuted_fish, axis=1)
    
    # Compute null RMS
    null_rms = compute_RMS(null_state)
    null_RMS_list.append(null_rms)

null_RMS_distribution = np.concatenate(null_RMS_list)
null_rms_dist_path = os.path.join(PROCESS_DATA_DIR, "Figure4_null_RMS_distribution.npy")
np.save(null_rms_dist_path, null_RMS_distribution)
print(f"Saved null RMS distribution to {null_rms_dist_path} (total {len(null_RMS_distribution)} values)")

# Validation
assert len(null_RMS_distribution) == 100 * n_total_timepoints, \
    f"Null distribution length mismatch: {len(null_RMS_distribution)} != {100 * n_total_timepoints}"

# ========== Define Threshold ==========

print("Computing significance threshold (95th percentile of null distribution)...")
threshold = np.percentile(null_RMS_distribution, 95)
threshold_path = os.path.join(PROCESS_DATA_DIR, "Figure4_RMS_threshold.npy")
np.save(threshold_path, np.array([threshold]))
print(f"Threshold: {threshold:.6f}, saved to {threshold_path}")

# ========== Detect Significant Frames (FDR correction) ==========

print("Computing p-values and applying FDR correction...")
# Compute empirical p-values for each timepoint
pvalues = np.array([
    1.0 - (np.sum(null_RMS_distribution < rms_val) / len(null_RMS_distribution))
    for rms_val in RMS
])

# Apply Benjamini-Hochberg FDR correction
reject, pvals_corrected, _, _ = multipletests(pvalues, alpha=0.05, method='fdr_bh')

# Indices of significant frames
significant_indices = np.where(reject)[0]
print(f"Total significant frames: {len(significant_indices)}")

# ========== Extract Discrete Events (Respecting Fish Boundaries) ==========

print("Extracting discrete high-amplitude events...")
# Identify fish boundaries (every n_timepoints_per_fish)
fish_boundaries = np.arange(n_timepoints_per_fish, n_total_timepoints, n_timepoints_per_fish)

# Group contiguous significant frames
events = []
if len(significant_indices) > 0:
    # Split into groups of consecutive indices
    diff = np.diff(significant_indices)
    split_points = np.where(diff > 1)[0] + 1
    groups = np.split(significant_indices, split_points)
    
    # Further split groups that cross fish boundaries
    for group in groups:
        # Check if group crosses any fish boundary
        start_idx = group[0]
        end_idx = group[-1]
        
        # Find which fish boundaries are crossed by this group
        crossed_boundaries = fish_boundaries[(fish_boundaries > start_idx) & (fish_boundaries <= end_idx)]
        
        if len(crossed_boundaries) == 0:
            # No boundary crossed, add as single event
            events.append(group)
        else:
            # Split at boundaries
            sub_groups = [group[0:1]]  # Start with first element
            for boundary in crossed_boundaries:
                # Split group at boundary
                mask_before = group < boundary
                mask_after = group >= boundary
                if np.any(mask_before):
                    sub_groups[-1] = group[mask_before]
                if np.any(mask_after):
                    sub_groups.append(group[mask_after])
            events.extend(sub_groups)

# Compute average activity for each event
events_high_list = []
for event_indices in events:
    event_frames = state_matrix[:, event_indices]
    avg_activity = np.mean(event_frames, axis=1)
    events_high_list.append(avg_activity)

if len(events_high_list) > 0:
    events_high = np.column_stack(events_high_list)  # Shape: (n_regions, n_events)
else:
    events_high = np.zeros((n_regions, 0))

events_high_path = os.path.join(PROCESS_DATA_DIR, "Figure4_events_high.npy")
np.save(events_high_path, events_high)
print(f"Saved {events_high.shape[1]} high-amplitude events to {events_high_path}")

# Validation: Ensure no event crosses fish boundaries
for i, event_indices in enumerate(events):
    fish_ids = event_indices // n_timepoints_per_fish
    assert len(np.unique(fish_ids)) == 1, f"Event {i} crosses fish boundary: {event_indices}"

# ========== Prepare Visualization ==========

print("Preparing visualization...")
fig = plt.figure(figsize=(21, 3))
gs = gridspec.GridSpec(2, 1, height_ratios=[4, 1], hspace=0.05)

# Top axis: RMS trace
ax_top = fig.add_subplot(gs[0])
ax_top.semilogy(RMS, 'k-', linewidth=0.8, label='Empirical RMS')
ax_top.axhline(y=threshold, color='red', linewidth=1.0, linestyle='--', label='95 percentile (null distribution)')
ax_top.set_ylabel("RMS", fontsize=12)
ax_top.set_xlim([0, len(RMS)])
ax_top.spines['top'].set_visible(False)
ax_top.spines['right'].set_visible(False)
ax_top.spines['bottom'].set_visible(False)
ax_top.set_xticks([])
ax_top.legend(loc='upper right', fontsize=8)

# Bottom axis: Raster of significant frames
ax_bottom = fig.add_subplot(gs[1])
if len(significant_indices) > 0:
    ax_bottom.eventplot([significant_indices], colors='black', linewidths=0.5)
ax_bottom.set_xlim([0, len(RMS)])
ax_bottom.axis('off')
ax_bottom.text(0.5, -0.5, f"Total significant frames: {len(significant_indices)}", 
               ha='center', va='top', transform=ax_bottom.transAxes, fontsize=10)

plt.tight_layout()
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, dpi=300)
plt.close()
print(f"✅ Figure saved to {figure_path}")

# ========== Save Statistics ==========

statistics = {
    "n_fish": int(n_fish),
    "n_regions": int(n_regions),
    "n_timepoints_per_fish": int(n_timepoints_per_fish),
    "n_total_timepoints": int(n_total_timepoints),
    "empirical_RMS_mean": float(np.mean(RMS)),
    "empirical_RMS_std": float(np.std(RMS)),
    "empirical_RMS_median": float(np.median(RMS)),
    "null_RMS_mean": float(np.mean(null_RMS_distribution)),
    "null_RMS_std": float(np.std(null_RMS_distribution)),
    "null_RMS_median": float(np.median(null_RMS_distribution)),
    "threshold_95_percentile": float(threshold),
    "n_null_permutations": 100,
    "n_significant_frames": int(len(significant_indices)),
    "fraction_significant_frames": float(len(significant_indices) / n_total_timepoints),
    "n_discrete_events": int(len(events)),
    "FDR_alpha": 0.05,
    "events_shape": list(events_high.shape),
    "min_pvalue_corrected": float(np.min(pvals_corrected)) if len(pvals_corrected) > 0 else None,
    "max_pvalue_corrected": float(np.max(pvals_corrected)) if len(pvals_corrected) > 0 else None,
}

stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)
print(f"✅ Statistics saved to {stats_path}")

print("Analysis complete.")
