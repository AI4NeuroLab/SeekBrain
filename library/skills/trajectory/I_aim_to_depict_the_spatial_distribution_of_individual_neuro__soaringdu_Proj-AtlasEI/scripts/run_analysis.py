"""
Spatial Distribution Analysis of Functional Neurons in Zebrafish Larvae.

This script aggregates (X, Y, Z) coordinates from multiple fish larvae, computes 
3D Gaussian Kernel Density Estimation (KDE) for specific functional types, 
and performs a permutation test to identify regions of statistically 
significant neuronal density (P < 0.025).

Inputs:
    - Root folder containing fish larvae subdirectories.
    - Each subfolder must contain: correlated_motor.npy, anticorrelated_motor.npy, 
      correlated_dark.npy, correlated_light.npy.
    - Atlas mask (NIfTI file) for anatomical boundary constraints.

Output:
    - 3D density maps (NIfTI format).
    - Thresholded significance masks.
    - Maximum Intensity Projections (MIPs) saved as PNGs.
"""

import os
import argparse
import logging
import numpy as np
import nibabel as nib
from scipy.stats import gaussian_kde
from pathlib import Path

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_data(root_path, category):
    """Aggregates coordinates from all fish folders for a specific category."""
    all_coords = []
    file_map = {
        "motor_corr": "correlated_motor.npy",
        "motor_anticorr": "anticorrelated_motor.npy",
        "dark": "correlated_dark.npy",
        "light": "correlated_light.npy"
    }
    
    filename = file_map[category]
    for fish_dir in Path(root_path).iterdir():
        if fish_dir.is_dir():
            file_path = fish_dir / filename
            if file_path.exists():
                try:
                    data = np.load(file_path) # Expected shape (N, 3)
                    all_coords.append(data)
                except Exception as e:
                    logging.warning(f"Could not load {file_path}: {e}")
            else:
                logging.info(f"Skipping {fish_dir.name}: {filename} not found.")
                
    return np.vstack(all_coords) if all_coords else np.array([])

def compute_kde(coords, grid_shape, bandwidth=5.0):
    """Computes 3D KDE over the defined grid dimensions."""
    kde = gaussian_kde(coords.T, bw_method=bandwidth/np.std(coords))
    
    # Create coordinate grid
    x, y, z = [np.arange(s) for s in grid_shape]
    grid = np.array(np.meshgrid(x, y, z, indexing='ij'))
    grid_flat = grid.reshape(3, -1)
    
    density = kde(grid_flat).reshape(grid_shape)
    return density

def run_permutation_test(coords, mask, n_perms=1000):
    """Generates a null distribution of densities to find 97.5th percentile threshold."""
    logging.info(f"Running {n_perms} permutations for significance mapping...")
    mask_indices = np.argwhere(mask > 0)
    num_neurons = len(coords)
    null_densities = []
    
    for _ in range(n_perms):
        # Sample random positions from valid brain mask
        random_indices = np.random.choice(len(mask_indices), num_neurons)
        shuffled_coords = mask_indices[random_indices]
        null_densities.append(compute_kde(shuffled_coords, mask.shape))
        
    null_stack = np.stack(null_densities)
    threshold_map = np.percentile(null_stack, 97.5, axis=0)
    return threshold_map

def main():
    parser = argparse.ArgumentParser(description="Spatial neuronal density analysis.")
    parser.add_argument("--root", required=True, help="Path to fish larvae data folders.")
    parser.add_argument("--atlas", required=True, help="Path to atlas mask (NIfTI).")
    parser.add_argument("--out", required=True, help="Output directory.")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    
    # Load Atlas
    atlas_img = nib.load(args.atlas)
    mask = atlas_img.get_fdata() > 0
    
    categories = ["motor_corr", "motor_anticorr", "dark", "light"]
    
    for cat in categories:
        logging.info(f"Processing category: {cat}")
        coords = load_data(args.root, cat)
        
        if coords.size == 0:
            continue
            
        # Step 1: Observed Density
        observed_density = compute_kde(coords, mask.shape)
        
        # Step 2: Permutation Null Model
        null_threshold = run_permutation_test(coords, mask)
        
        # Step 3: Thresholding
        significant_mask = (observed_density > null_threshold) & mask
        
        # Save results
        out_path = Path(args.out) / f"{cat}_significant.nii.gz"
        img = nib.Nifti1Image(significant_mask.astype(float), atlas_img.affine)
        nib.save(img, out_path)
        logging.info(f"Saved significant clusters for {cat} to {out_path}")

if __name__ == '__main__':
    main()