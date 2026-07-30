"""
Utility functions for HD-Cell Tuning Analysis.
"""

import numpy as np

def wrap_angle(angles):
    """Wraps angles to [-pi, pi] for circular alignment."""
    return (angles + np.pi) % (2 * np.pi) - np.pi

def get_tuning_curve(fluorescence, theta, num_bins=60):
    """
    Computes mean fluorescence per theta bin.
    
    Args:
        fluorescence: Array of fluorescence values.
        theta: Array of corresponding angular head-direction data.
        num_bins: Number of circular bins.
        
    Returns:
        bin_centers: Array of bin center values.
        tuning: Mean fluorescence per bin.
    """
    bins = np.linspace(-np.pi, np.pi, num_bins + 1)
    bin_centers = (bins[:-1] + bins[1:]) / 2
    tuning = np.zeros(num_bins)
    
    for i in range(num_bins):
        mask = (theta >= bins[i]) & (theta < bins[i+1])
        if np.any(mask):
            tuning[i] = np.nanmean(fluorescence[mask])
        else:
            tuning[i] = np.nan
    return bin_centers, tuning

def center_tuning_matrix(matrix, preferred_orientations, num_bins=60):
    """
    Shifts tuning curves to center based on preferred orientation.
    
    Args:
        matrix: 2D array [ROI, Bin]
        preferred_orientations: Array of preferred orientations in radians.
    """
    centered_matrix = np.zeros_like(matrix)
    for r in range(matrix.shape[0]):
        shift_idx = int((preferred_orientations[r] / (2 * np.pi)) * num_bins)
        centered_matrix[r, :] = np.roll(matrix[r, :], -shift_idx)
    return centered_matrix