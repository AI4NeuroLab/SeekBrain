import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from scipy.ndimage import gaussian_filter1d

# Add library path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import *

# Get paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH", "<data-root>")
SAVE_DIR = os.getenv("SAVE_DIR", "./")

# Create save directory
os.makedirs(SAVE_DIR, exist_ok=True)

# 1. Locate and select the 8th fish folder
subjects_dir = os.path.join(ZEBRAFISH_PATH, "Subjects")
fish_folders = sorted([
    os.path.join(subjects_dir, folder)
    for folder in os.listdir(subjects_dir)
    if folder.startswith("fish") and os.path.isdir(os.path.join(subjects_dir, folder))
])

if len(fish_folders) < 8:
    raise ValueError(f"Not enough fish folders. Found {len(fish_folders)}, need at least 8.")

fish_folder = fish_folders[7]  # 8th folder (0-indexed)
print(f"Using fish folder: {fish_folder}")

# 2. Load data files
dff = np.load(os.path.join(fish_folder, "dff.npy"))
swim_events = np.load(os.path.join(fish_folder, "swim_events.npy"))
correlations_motor = np.load(os.path.join(fish_folder, "correlations_motor.npy"))
correlations_dark = np.load(os.path.join(fish_folder, "correlations_dark.npy"))
correlations_light = np.load(os.path.join(fish_folder, "correlations_light.npy"))
sequence_stimuli = np.load(os.path.join(ZEBRAFISH_PATH, "Files", "sequence_stimuli.npy"))

# 3. Process swim events
camera_fps = 399.75
binary_swim = (swim_events > 0.5).astype(int)
# Drop first 15 elements, append 15 zeros
binary_swim = binary_swim[15:]
binary_swim = np.concatenate([binary_swim, np.zeros(15, dtype=int)])
# Pad to 360000 if needed
if len(binary_swim) < 360000:
    binary_swim = np.concatenate([binary_swim, np.zeros(360000 - len(binary_swim), dtype=int)])
# Time vector for swim trace
time_swim = np.arange(len(binary_swim)) / camera_fps

# 4. Select neurons
# Motor+: top 50 highest correlation
motor_plus_idx = np.argsort(correlations_motor)[-50:]
# Motor-: bottom 50 (most negative)
motor_minus_idx = np.argsort(correlations_motor)[:50]
# Dark: top 50
dark_idx = np.argsort(correlations_dark)[-50:]
# Light: top 50
light_idx = np.argsort(correlations_light)[-50:]

# Extract calcium traces for each group
dff_motor_plus = dff[motor_plus_idx]
dff_motor_minus = dff[motor_minus_idx]
dff_dark = dff[dark_idx]
dff_light = dff[light_idx]

# Time vector for calcium traces
num_timepoints = dff.shape[1]
time_calcium = np.linspace(0, len(binary_swim) / camera_fps, num_timepoints)

# 5. Create figure
fig = plt.figure(figsize=(12, 5))
gs = gridspec.GridSpec(5, 1, height_ratios=[0.5, 0.5, 2, 2, 2], hspace=0)

# Top panels (context): Motor and Stimulus
ax_motor = fig.add_subplot(gs[0, 0])
ax_stim = fig.add_subplot(gs[1, 0])

# Bottom panels (calcium traces)
ax_traces = []
for i in range(2, 5):
    ax_traces.append(fig.add_subplot(gs[i, 0]))

# 6. Plot context (Top)
# Motor events
ax_motor.fill_between(time_swim, 0, binary_swim, color='black', alpha=0.7)
ax_motor.set_xlim([0, time_swim[-1]])
ax_motor.set_ylim([0, 1.2])
ax_motor.text(time_swim[-1] + 5, 0.5, "Motor", va='center', fontsize=10)
ax_motor.axis('off')

# Stimulus sequence
stim_time = np.linspace(0, time_swim[-1], len(sequence_stimuli))
ax_stim.plot(stim_time, sequence_stimuli, color='black', linewidth=0.5)
ax_stim.set_xlim([0, time_swim[-1]])
ax_stim.set_ylim([-0.2, 1.2])
ax_stim.text(time_swim[-1] + 5, 0.5, "Stim.", va='center', fontsize=10)
ax_stim.axis('off')

# 7. Plot calcium traces (Bottom)
trace_groups = [
    (dff_motor_plus, [0, 0.8, 0.2], "Motor+"),
    (dff_motor_minus, [1, 0, 1], "Motor-"),
    (dff_dark, [1, 0, 0], "Dark"),
    (dff_light, 'orange', "Light")
]

for idx, (traces, color, label) in enumerate(trace_groups):
    ax = ax_traces[idx] if idx < 3 else ax_traces[2]
    
    # Plot individual traces
    for i in range(traces.shape[0]):
        ax.plot(time_calcium, traces[i], color=color, alpha=0.1, linewidth=0.5, rasterized=True)
    
    # Plot mean trace
    mean_trace = np.mean(traces, axis=0)
    ax.plot(time_calcium, mean_trace, color=[0, 0, 0], alpha=1, linewidth=0.5)
    
    # Styling
    ax.set_xlim([0, time_swim[-1]])
    ax.axis('off')

# Special handling for 4 groups in 3 axes - split bottom axis
ax_traces[2].clear()
# Plot Dark first
for i in range(dff_dark.shape[0]):
    ax_traces[2].plot(time_calcium, dff_dark[i] + 1.5, color=[1, 0, 0], alpha=0.1, linewidth=0.5, rasterized=True)
mean_dark = np.mean(dff_dark, axis=0)
ax_traces[2].plot(time_calcium, mean_dark + 1.5, color=[0, 0, 0], alpha=1, linewidth=0.5)

# Plot Light below
for i in range(dff_light.shape[0]):
    ax_traces[2].plot(time_calcium, dff_light[i], color='orange', alpha=0.1, linewidth=0.5, rasterized=True)
mean_light = np.mean(dff_light, axis=0)
ax_traces[2].plot(time_calcium, mean_light, color=[0, 0, 0], alpha=1, linewidth=0.5)

ax_traces[2].set_xlim([0, time_swim[-1]])
ax_traces[2].axis('off')

# 8. Save figure
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"Figure saved to {figure_path}")

# 9. Compute and save statistics
statistics = {
    "fish_folder": os.path.basename(fish_folder),
    "total_neurons": int(dff.shape[0]),
    "total_timepoints": int(dff.shape[1]),
    "total_swim_samples": int(len(binary_swim)),
    "recording_duration_seconds": float(time_swim[-1]),
    "motor_plus": {
        "n_neurons": 50,
        "mean_correlation": float(np.mean(correlations_motor[motor_plus_idx])),
        "std_correlation": float(np.std(correlations_motor[motor_plus_idx])),
        "median_correlation": float(np.median(correlations_motor[motor_plus_idx])),
        "min_correlation": float(np.min(correlations_motor[motor_plus_idx])),
        "max_correlation": float(np.max(correlations_motor[motor_plus_idx])),
        "mean_activity": float(np.mean(dff_motor_plus)),
        "std_activity": float(np.std(dff_motor_plus))
    },
    "motor_minus": {
        "n_neurons": 50,
        "mean_correlation": float(np.mean(correlations_motor[motor_minus_idx])),
        "std_correlation": float(np.std(correlations_motor[motor_minus_idx])),
        "median_correlation": float(np.median(correlations_motor[motor_minus_idx])),
        "min_correlation": float(np.min(correlations_motor[motor_minus_idx])),
        "max_correlation": float(np.max(correlations_motor[motor_minus_idx])),
        "mean_activity": float(np.mean(dff_motor_minus)),
        "std_activity": float(np.std(dff_motor_minus))
    },
    "dark": {
        "n_neurons": 50,
        "mean_correlation": float(np.mean(correlations_dark[dark_idx])),
        "std_correlation": float(np.std(correlations_dark[dark_idx])),
        "median_correlation": float(np.median(correlations_dark[dark_idx])),
        "min_correlation": float(np.min(correlations_dark[dark_idx])),
        "max_correlation": float(np.max(correlations_dark[dark_idx])),
        "mean_activity": float(np.mean(dff_dark)),
        "std_activity": float(np.std(dff_dark))
    },
    "light": {
        "n_neurons": 50,
        "mean_correlation": float(np.mean(correlations_light[light_idx])),
        "std_correlation": float(np.std(correlations_light[light_idx])),
        "median_correlation": float(np.median(correlations_light[light_idx])),
        "min_correlation": float(np.min(correlations_light[light_idx])),
        "max_correlation": float(np.max(correlations_light[light_idx])),
        "mean_activity": float(np.mean(dff_light)),
        "std_activity": float(np.std(dff_light))
    },
    "swim_events": {
        "total_frames": int(len(binary_swim)),
        "active_frames": int(np.sum(binary_swim)),
        "fraction_active": float(np.sum(binary_swim) / len(binary_swim))
    }
}

stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"Statistics saved to {stats_path}")
