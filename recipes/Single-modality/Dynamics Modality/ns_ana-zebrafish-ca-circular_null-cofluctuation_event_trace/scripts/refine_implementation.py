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
    # To optimize, we can compute this without explicit loops if memory allows, 
    # but the loop is safe for large T.
    rms_values = []
    triu_indices = np.triu_indices(R, 1)
    
    # Pre-calculate indices to avoid overhead in loop
    idx_i, idx_j = triu_indices
    
    for i in range(T):
        c = timeseries[:, i]
        # Outer product only for upper triangle can be computed directly
        # coactivation = c[idx_i] * c[idx_j]
        # rms = np.sqrt(np.mean(coactivation ** 2))
        
        # Using the previous implementation logic for consistency
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

state_matrix = np.load(state_matrix_path)
rseries = np.load(rseries_path)

n_fish, n_regions, n_timepoints_per_fish = rseries.shape
n_total_timepoints = state_matrix.shape[1]

# Validation
assert state_matrix.shape[1] == n_fish * n_timepoints_per_fish, \
    f"State matrix timepoints mismatch"

print(f"Data loaded. n_fish={n_fish}, n_regions={n_regions}, n_timepoints={n_total_timepoints}")

# ========== Compute Empirical RMS ==========

print("Computing empirical RMS...")
RMS = compute_RMS(state_matrix)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure4_RMS.npy"), RMS)

# ========== Generate Null RMS Distribution ==========

print("Generating null RMS distribution (100 permutations)...")
null_RMS_list = []
np.random.seed(42)

for perm_idx in range(100):
    permuted_fish_arrays = []
    for fish_idx in range(n_fish):
        # Permute regions independently within each fish
        p_fish = permute_timeseries(rseries[fish_idx])
        permuted_fish_arrays.append(p_fish)
    
    # Concatenate fish along time to create null state matrix
    null_state_matrix = np.concatenate(permuted_fish_arrays, axis=1)
    
    # Compute RMS
    null_rms = compute_RMS(null_state_matrix)
    null_RMS_list.append(null_rms)

null_RMS_distribution = np.concatenate(null_RMS_list)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure4_null_RMS_distribution.npy"), null_RMS_distribution)

# ========== Define Threshold ==========

threshold = np.percentile(null_RMS_distribution, 95)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure4_RMS_threshold.npy"), np.array([threshold]))
print(f"95th percentile threshold: {threshold}")

# ========== Detect Significant Frames (FDR) ==========

print("Calculating significance...")
# Calculate empirical p-values: (count(null >= val)) / N_null
# Note: Using strict inequality in previous code: 1 - (count < val)/N = count(>=)/N
pvalues = np.array([
    1.0 - (np.sum(null_RMS_distribution < val) / len(null_RMS_distribution))
    for val in RMS
])

reject, pvals_corrected, _, _ = multipletests(pvalues, alpha=0.05, method='fdr_bh')
significant_indices = np.where(reject)[0]
print(f"Significant frames found: {len(significant_indices)}")

# ========== Extract Discrete Events ==========

print("Extracting events...")
fish_boundaries = np.arange(n_timepoints_per_fish, n_total_timepoints, n_timepoints_per_fish)

events = []
if len(significant_indices) > 0:
    # 1. Group contiguous indices
    diffs = np.diff(significant_indices)
    split_locs = np.where(diffs > 1)[0] + 1
    contiguous_groups = np.split(significant_indices, split_locs)
    
    # 2. Split groups that cross fish boundaries
    for group in contiguous_groups:
        if len(group) == 0: continue
        
        start = group[0]
        end = group[-1]
        
        # Find boundaries strictly within (start, end]
        # A group [a, b] crosses boundary B if a < B <= b
        boundaries_crossed = fish_boundaries[(fish_boundaries > start) & (fish_boundaries <= end)]
        
        if len(boundaries_crossed) == 0:
            events.append(group)
        else:
            # Split
            current_group = group
            for b in boundaries_crossed:
                part1 = current_group[current_group < b]
                part2 = current_group[current_group >= b]
                if len(part1) > 0:
                    events.append(part1)
                current_group = part2
            if len(current_group) > 0:
                events.append(current_group)

# Calculate average activity per event
event_activities = []
for ev_idx in events:
    # ev_idx are time indices
    frames = state_matrix[:, ev_idx]
    # Average over time frames in the event
    avg = np.mean(frames, axis=1)
    event_activities.append(avg)

if len(event_activities) > 0:
    events_high = np.column_stack(event_activities)
else:
    events_high = np.zeros((n_regions, 0))

np.save(os.path.join(PROCESS_DATA_DIR, "Figure4_events_high.npy"), events_high)

# ========== Visualization ==========

print("Generating figure...")
fig = plt.figure(figsize=(21, 3))
gs = gridspec.GridSpec(2, 1, height_ratios=[4, 1], hspace=0.1)

# Top Axis: RMS
ax_top = fig.add_subplot(gs[0])
ax_top.semilogy(RMS, color='black', linewidth=0.8, label='Empirical RMS')
ax_top.axhline(y=threshold, color='red', linestyle='--', linewidth=1.0)

# Add text label for threshold (Red text, no overlap)
# Placing it at x=0, slightly above the threshold line
text_y = threshold * 1.15
ax_top.text(0, text_y, "95 percentile (null distribution)", color='red', fontsize=10, va='bottom')

# Legend for trace only (optional, but good for clarity if trace isn't self-explanatory, 
# though prompt implies the red text handles the line explanation)
# We will add a legend for the black trace to match the previous style, but omit the red line from legend 
# since it's now labeled directly.
ax_top.legend(['Empirical RMS'], loc='upper right', fontsize=8)

ax_top.set_ylabel("RMS", fontsize=12)
ax_top.set_xlim([0, len(RMS)])
ax_top.set_xticks([])
ax_top.spines['top'].set_visible(False)
ax_top.spines['right'].set_visible(False)
ax_top.spines['bottom'].set_visible(False)

# Bottom Axis: Raster
ax_bottom = fig.add_subplot(gs[1])
if len(significant_indices) > 0:
    ax_bottom.eventplot([significant_indices], colors='black', linewidths=0.5, lineoffsets=0.5, linelengths=0.8)

ax_bottom.set_xlim([0, len(RMS)])
ax_bottom.axis('off')

# Text below raster
ax_bottom.text(0.5, -0.5, f"Total significant frames: {len(significant_indices)}", 
               ha='center', va='top', transform=ax_bottom.transAxes, fontsize=10)

plt.tight_layout()
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=300)
plt.close()
print(f"Figure saved to {figure_path}")

# ========== Save Statistics ==========

stats = {
    "n_fish": int(n_fish),
    "n_regions": int(n_regions),
    "n_events": len(events),
    "n_significant_frames": len(significant_indices),
    "threshold": float(threshold),
    "max_RMS": float(np.max(RMS)),
    "null_95th": float(threshold)
}

stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(stats, f, indent=2)

print("Analysis and visualization complete.")
