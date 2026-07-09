"""
Utility functions for neuroimaging and spatial coordinate analysis.
"""
import logging
import numpy as np
from pathlib import Path
from scipy.stats import gaussian_kde

def load_coordinates_from_folders(root_path, filename):
    """
    Aggregates (N, 3) coordinate arrays from subdirectories within a root path.
    """
    all_coords = []
    for fish_dir in Path(root_path).iterdir():
        if fish_dir.is_dir():
            file_path = fish_dir / filename
            if file_path.exists():
                try:
                    data = np.load(file_path)
                    all_coords.append(data)
                except Exception as e:
                    logging.warning(f"Could not load {file_path}: {e}")
    return np.vstack(all_coords) if all_coords else np.array([])

def compute_kde_3d(coords, grid_shape, bandwidth=5.0):
    """
    Computes 3D Gaussian Kernel Density Estimation over a specified grid.
    """
    if coords.size == 0:
        return np.zeros(grid_shape)
        
    kde = gaussian_kde(coords.T, bw_method=bandwidth/np.std(coords))
    x, y, z = [np.arange(s) for s in grid_shape]
    grid = np.array(np.meshgrid(x, y, z, indexing='ij'))
    density = kde(grid.reshape(3, -1)).reshape(grid_shape)
    return density

def run_spatial_permutation_test(coords, mask, n_perms=1000):
    """
    Generates a null distribution of densities using shuffled spatial coordinates.
    """
    mask_indices = np.argwhere(mask > 0)
    num_neurons = len(coords)
    null_stack = np.zeros((n_perms, *mask.shape))
    
    for i in range(n_perms):
        random_indices = np.random.choice(len(mask_indices), num_neurons)
        shuffled_coords = mask_indices[random_indices]
        null_stack[i] = compute_kde_3d(shuffled_coords, mask.shape)
        
    return np.percentile(null_stack, 97.5, axis=0)