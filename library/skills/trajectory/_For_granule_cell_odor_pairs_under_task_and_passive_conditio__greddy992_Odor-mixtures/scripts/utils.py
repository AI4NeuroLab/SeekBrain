"""
Utility module for Granule Cell Analysis Pipeline.
Contains reusable data loading and classification helpers.
"""

import numpy as np
import os
import logging

def load_data(file_path):
    """Loads a .npy file with error handling."""
    if not os.path.exists(file_path):
        logging.error(f"File not found: {file_path}")
        raise FileNotFoundError(f"Missing required data file: {file_path}")
    return np.load(file_path)

def classify_responses(exc_mask, inh_mask):
    """
    Classifies pairs based on excitation and inhibition masks.
    Returns dictionary with counts for 'Excited', 'Inhibited', 'Non-responsive'.
    """
    excited = (exc_mask == 1)
    inhibited = (inh_mask == 1)
    
    # Check for invalid overlap
    overlap = np.logical_and(excited, inhibited)
    if np.any(overlap):
        logging.warning(f"Detected {np.sum(overlap)} pairs classified as both excited and inhibited.")
        
    non_responsive = ~np.logical_or(excited, inhibited)
    
    return {
        "Excited": np.sum(excited),
        "Inhibited": np.sum(inhibited),
        "Non-responsive": np.sum(non_responsive)
    }

def calculate_percentages(stats_dict):
    """Converts a dictionary of counts into a list of percentages."""
    counts = [stats_dict['Excited'], stats_dict['Inhibited'], stats_dict['Non-responsive']]
    total = sum(counts)
    return [c / total * 100 for c in counts]