"""
utils.py

Helper functions for spatial neuronal data processing, including affine
transformations and 3D kernel density estimation.
"""

import numpy as np
import logging
from sklearn.neighbors import KernelDensity

def apply_affine_transform(coords, matrix):
    """
    Applies a 4x4 affine transformation matrix to N x 3 coordinates.
    
    Args:
        coords: (N, 3) array of spatial coordinates.
        matrix: (4, 4) affine transformation matrix.
    
    Returns:
        (N, 3) array of transformed coordinates.
    """
    ones = np.ones((coords.shape[0], 1))
    homo_coords = np.hstack([coords, ones])
    transformed = (matrix @ homo_coords.T).T
    return transformed[:, :3]

def compute_3d_kde(coords, bandwidth=5.0, bounds=(200, 200, 200)):
    """
    Computes a 3D Kernel Density Estimate on a defined grid.
    
    Args:
        coords: (N, 3) array of coordinates.
        bandwidth: Bandwidth for the Gaussian kernel.
        bounds: Tuple representing (x, y, z) dimensions of the output grid.
        
    Returns:
        (bounds) shape ndarray containing density values.
    """
    if coords is None or len(coords) == 0:
        return np.zeros(bounds)
    
    kde = KernelDensity(bandwidth=bandwidth, kernel='gaussian')
    kde.fit(coords)
    
    # Generate 3D grid
    grid_coords = np.indices(bounds).reshape(3, -1).T
    
    # Score samples and reshape to grid
    density = np.exp(kde.score_samples(grid_coords))
    return density.reshape(bounds)

def get_p_threshold(obs_density, null_densities, p_value=0.025):
    """
    Calculates a threshold mask based on permutation testing.
    """
    percentile = (1 - p_value) * 100
    threshold = np.percentile(np.stack(null_densities), percentile, axis=0)
    return obs_density > threshold