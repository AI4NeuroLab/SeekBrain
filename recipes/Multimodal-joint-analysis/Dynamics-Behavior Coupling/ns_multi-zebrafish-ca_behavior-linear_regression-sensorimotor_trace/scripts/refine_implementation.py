import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

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
try:
    fish_folders = sorted([
        os.path.join(subjects_dir, folder)
        for folder in os.listdir(subjects_dir)
        if folder.startswith("fish") and os.path.isdir(os.path.join(subjects_dir, folder))
    ])
except FileNotFoundError:
    print(f"Directory not found: {subjects_dir}")
    fish_folders = []

if len(fish_folders) < 8:
    # Fallback for testing environments or if folder structure differs
    print(f"Warning: Found {len(fish_folders)} folders. Using index 0 if available.")
    if fish_folders:
        fish_folder = fish_folders[0]
    else:
        raise ValueError("No fish folders found.")
else:
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
target_length = 360000
if len(binary_swim) < target_length:
    binary_swim = np.concatenate([binary_swim, np.zeros(target_length - len(binary_swim), dtype=int)])
elif len(binary_swim) > target_length:
    binary_swim = binary_swim[:target_length]

# Time vector for swim trace
time_swim = np.arange(len(binary_swim)) / camera_fps
duration = time_swim[-1]

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
time_calcium = np.linspace(0, duration, num_timepoints)

# 5. Create figure
fig = plt.figure(figsize=(12, 5))
# Layout: 6 rows total. 
# Top 20% height = 2 context panels. Bottom 80% height = 4 calcium panels.
# Ratio calculation: Context panels have height 1, Calcium panels have height 2.
# Total height units = 1+1 + 2+2+2+2 = 10. Top is 2/10 (20%). Bottom is 8/10 (80%).
gs = gridspec.GridSpec(6, 1, height_ratios=[1, 1, 2, 2, 2, 2], hspace=0)

ax_motor = fig.add_subplot(gs[0])
ax_stim = fig.add_subplot(gs[1])
ax_m_plus = fig.add_subplot(gs[2])
ax_m_minus = fig.add_subplot(gs[3])
ax_dark = fig.add_subplot(gs[4])
ax_light = fig.add_subplot(gs[5])

# 6. Plot context (Top)
# Motor events
ax_motor.fill_between(time_swim, 0, binary_swim, color='black', alpha=0.7)
ax_motor.set_xlim([0, duration])
ax_motor.set_ylim([0, 1.2])
ax_motor.text(duration + (duration * 0.01), 0.5, "Motor", va='center', fontsize=10)
ax_motor.axis('off')

# Stimulus sequence
stim_time = np.linspace(0, duration, len(sequence_stimuli))
ax_stim.plot(stim_time, sequence_stimuli, color='black', linewidth=0.5)
ax_stim.set_xlim([0, duration])
ax_stim.set_ylim([-0.2, 1.2])
ax_stim.text(duration + (duration * 0.01), 0.5, "Stim.", va='center', fontsize=10)
ax_stim.axis('off')

# 7. Plot calcium traces (Bottom)
calcium_axes = [ax_m_plus, ax_m_minus, ax_dark, ax_light]
trace_groups = [
    (dff_motor_plus, [0, 0.8, 0.2]), # Motor+, Green
    (dff_motor_minus, [1, 0, 1]),    # Motor-, Magenta
    (dff_dark, [1, 0, 0]),           # Dark, Red
    (dff_light, 'orange')            # Light, Orange
]

for ax, (traces, color) in zip(calcium_axes, trace_groups):
    # Plot individual traces
    for i in range(traces.shape[0]):
        ax.plot(time_calcium, traces[i], color=color, alpha=0.1, linewidth=0.5, rasterized=True)
    
    # Plot mean trace
    mean_trace = np.mean(traces, axis=0)
    ax.plot(time_calcium, mean_trace, color=[0, 0, 0], alpha=1, linewidth=0.5)
    
    # Styling
    ax.set_xlim([0, duration])
    ax.axis('off')

# 8. Save figure
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"Figure saved to {figure_path}")
