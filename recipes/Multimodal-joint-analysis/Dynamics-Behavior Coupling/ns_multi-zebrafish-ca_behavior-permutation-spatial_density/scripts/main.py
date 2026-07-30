import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from mpl_toolkits.axes_grid1 import make_axes_locatable
from tqdm import tqdm

# Add toolkit to path
sys.path.append("<data-root>")
from zebrafish_Ca_utils import (
    MapzebrainAtlas, get_datasets, load_data, identify_files,
    spatial_p_value_test, compute_density_atlas
)

# Environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Create directories
os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================================
# 1. DATASET LOADING
# ============================================================================
print("Step 1: Loading datasets...")
datasets = get_datasets(ZEBRAFISH_PATH, keywords=['fish'])
if len(datasets) == 0:
    raise RuntimeError(f"No fish datasets found in {ZEBRAFISH_PATH}")

print(f"Found {len(datasets)} fish datasets. Processing ALL...")

# Initialize lists
centroids_motor_list = []
motor_labels_list = []
antimotor_labels_list = []

centroids_all_list = []
dark_labels_list = []
light_labels_list = []

n_processed = 0

# Process all fish (Removed max_fish limit)
for folder in tqdm(datasets, desc="Processing fish"):
    try:
        # Load core data
        data = load_data(folder)
        
        # Region 10 exclusion & in_brain mask
        region_labels = data['region_labels']
        region_labels = np.array(region_labels) # Ensure copy
        region_labels[:, 10] = 0
        in_brain = np.sum(region_labels, axis=1) > 0
        
        # Load centroids and filter to brain
        centroids_atlas = data['centroids_atlas']
        centroids_filtered = centroids_atlas[in_brain]
        
        # --- Motor Categories ---
        motor_path = os.path.join(folder, 'correlated_motor.npy')
        antimotor_path = os.path.join(folder, 'anticorrelated_motor.npy')
        
        # Check existence before loading
        if os.path.exists(motor_path) and os.path.exists(antimotor_path):
            motor_mask = np.load(motor_path)
            antimotor_mask = np.load(antimotor_path)
            
            # Ensure masks align with total cells before applying in_brain
            if motor_mask.shape[0] == in_brain.shape[0]:
                motor_mask_filtered = motor_mask[in_brain]
                antimotor_mask_filtered = antimotor_mask[in_brain]
                
                centroids_motor_list.append(centroids_filtered)
                motor_labels_list.append(motor_mask_filtered)
                antimotor_labels_list.append(antimotor_mask_filtered)
        
        # --- Visual Categories ---
        dark_path = os.path.join(folder, 'correlated_dark.npy')
        light_path = os.path.join(folder, 'correlated_light.npy')
        
        if os.path.exists(dark_path) and os.path.exists(light_path):
            dark_mask = np.load(dark_path)
            light_mask = np.load(light_path)
            
            if dark_mask.shape[0] == in_brain.shape[0]:
                dark_mask_filtered = dark_mask[in_brain]
                light_mask_filtered = light_mask[in_brain]
                
                centroids_all_list.append(centroids_filtered)
                dark_labels_list.append(dark_mask_filtered)
                light_labels_list.append(light_mask_filtered)
        
        n_processed += 1
        
    except Exception as e:
        print(f"Error processing {folder}: {e}")
        continue

if n_processed == 0:
    raise RuntimeError("No valid datasets processed")

# ============================================================================
# 2. CONSOLIDATE CENTROIDS
# ============================================================================
def consolidate_and_save(centroids_list, labels_list, name):
    if not centroids_list:
        cents = np.empty((0, 3))
    else:
        cents_all = np.concatenate(centroids_list, axis=0)
        labels_all = np.concatenate(labels_list, axis=0)
        cents = cents_all[labels_all]
    
    path = os.path.join(PROCESS_DATA_DIR, f'Figure5_centroids_{name}.npy')
    np.save(path, cents)
    return cents

centroids_motor = consolidate_and_save(centroids_motor_list, motor_labels_list, 'motor')
centroids_antimotor = consolidate_and_save(centroids_motor_list, antimotor_labels_list, 'antimotor')
centroids_dark = consolidate_and_save(centroids_all_list, dark_labels_list, 'dark')
centroids_light = consolidate_and_save(centroids_all_list, light_labels_list, 'light')

# ============================================================================
# 3. SPATIAL STATISTICS
# ============================================================================
print("Step 3: Computing spatial p-values (N_shuffles=1000)...")

def run_stats(cents_list, lbls_list, name):
    if not cents_list:
        res = np.empty(0)
    else:
        # spatial_p_value_test returns p-values for the cells marked True in labels
        p_vals_list = spatial_p_value_test(cents_list, lbls_list, N_shuffles=1000)
        res = np.concatenate(p_vals_list)
    
    np.save(os.path.join(PROCESS_DATA_DIR, f'Figure5_pvalues_{name}.npy'), res)
    return res

p_motor = run_stats(centroids_motor_list, motor_labels_list, 'motor')
p_antimotor = run_stats(centroids_motor_list, antimotor_labels_list, 'antimotor')
p_dark = run_stats(centroids_all_list, dark_labels_list, 'dark')
p_light = run_stats(centroids_all_list, light_labels_list, 'light')

# ============================================================================
# 4. VISUALIZATION
# ============================================================================
print("Step 4: Visualization...")

atlas = MapzebrainAtlas(ATLAS_PATH)
XY_projection = atlas.XYprojection
XZ_projection = atlas.XZprojection

# Rotate XZ projection 90 degrees clockwise as requested
XZ_rotated = np.rot90(XZ_projection, k=-1)

# Get dynamic dimensions for inversion
xy_h, xy_w = XY_projection.shape
xz_rot_h, xz_rot_w = XZ_rotated.shape

significance = 0.025
categories = ['Motor positive', 'Motor negative', 'Dark', 'Light']
data_groups = [
    (centroids_motor, p_motor),
    (centroids_antimotor, p_antimotor),
    (centroids_dark, p_dark),
    (centroids_light, p_light)
]

fig = plt.figure(figsize=(14, 4))
# Layout: 4 Groups side by side
gs = gridspec.GridSpec(1, 4, figure=fig, wspace=0.3)

for idx, (cents, pvals) in enumerate(data_groups):
    # Filter by significance
    if len(cents) > 0 and len(pvals) > 0:
        sig_mask = pvals < significance
        cents_sig = cents[sig_mask]
    else:
        cents_sig = np.empty((0, 3))
    
    # Compute density
    if len(cents_sig) > 0:
        density = compute_density_atlas(cents_sig, sigma=10)
        order = np.argsort(density)
        cents_sorted = cents_sig[order]
        dens_sorted = density[order]
    else:
        cents_sorted = np.empty((0, 3))
        dens_sorted = np.zeros(0)

    # Within group: Top View (60%) | Side View (40%)
    sub_gs = gridspec.GridSpecFromSubplotSpec(1, 2, subplot_spec=gs[idx], 
                                              width_ratios=[0.6, 0.4], wspace=0.05)
    
    # --- Top View (XY) ---
    ax_top = fig.add_subplot(sub_gs[0])
    ax_top.imshow(XY_projection, cmap='gray', vmax=200, aspect='equal')
    
    if len(cents_sorted) > 0:
        # Invert X (use image width). Y is unchanged.
        x_plot = (xy_w - 1) - cents_sorted[:, 0]
        y_plot = cents_sorted[:, 1]
        ax_top.scatter(x_plot, y_plot, c=dens_sorted, cmap='rainbow', 
                       alpha=0.1, s=1, rasterized=True)
    
    ax_top.set_title(categories[idx], fontsize=12)
    ax_top.axis('off')

    # --- Side View (XZ Rotated) ---
    ax_side = fig.add_subplot(sub_gs[1])
    ax_side.imshow(XZ_rotated, cmap='gray', vmax=200, aspect='equal')
    
    sc_side = None
    if len(cents_sorted) > 0:
        # Invert Z. Use rotated width (original Z dim).
        z_plot = (xz_rot_w - 1) - cents_sorted[:, 2]
        y_plot = cents_sorted[:, 1]
        sc_side = ax_side.scatter(z_plot, y_plot, c=dens_sorted, cmap='rainbow',
                                  alpha=0.1, s=1, rasterized=True)
    
    ax_side.axis('off')
    
    # Cell count label centered below the group
    ax_top.text(0.8, -0.05, f'n = {len(cents_sig)}', 
                transform=ax_top.transAxes, ha='center', fontsize=10)
    
    # Colorbar
    divider = make_axes_locatable(ax_side)
    cax = divider.append_axes("right", size="8%", pad=0.05)
    if sc_side is not None:
        plt.colorbar(sc_side, cax=cax, orientation='vertical')
        cax.tick_params(labelsize=6)
    else:
        cax.axis('off')

plt.savefig(os.path.join(SAVE_DIR, 'figure_refine.png'), dpi=300, bbox_inches='tight')
print(f"Figure saved to {os.path.join(SAVE_DIR, 'figure_refine.png')}")
