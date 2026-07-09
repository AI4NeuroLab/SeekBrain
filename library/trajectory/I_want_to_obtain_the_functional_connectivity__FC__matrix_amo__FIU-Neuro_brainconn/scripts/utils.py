"""
Utility functions for Functional Connectivity Analysis.
"""

import numpy as np
import logging

logger = logging.getLogger(__name__)

def compute_fc(data_slice):
    """
    Compute Pearson correlation matrix from (N_regions, Timepoints) array.
    """
    return np.corrcoef(data_slice)

def apply_mask(fc_matrix, excluded_indices):
    """
    Remove excluded regions from the FC matrix.
    
    Args:
        fc_matrix: (N, N) connectivity matrix.
        excluded_indices: Array-like list of indices to remove.
        
    Returns:
        (filtered_fc, kept_indices)
    """
    all_indices = np.arange(fc_matrix.shape[0])
    keep_indices = np.delete(all_indices, excluded_indices)
    return fc_matrix[np.ix_(keep_indices, keep_indices)], keep_indices

def validate_data(data, min_timepoints=600):
    """
    Check if data meets requirements.
    """
    if data.shape[1] < min_timepoints:
        return False
    return True