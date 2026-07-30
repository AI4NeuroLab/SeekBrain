"""
Utility functions for neural data alignment analysis.
"""

import os
import numpy as np
import logging

def calculate_circular_offset(bump, scene):
    """Computes circular difference in range (-pi, pi]."""
    return np.arctan2(np.sin(bump - scene), np.cos(bump - scene))

def compute_out_phase_fraction(bump, scene, threshold=np.pi/2):
    """
    Computes the fraction of time the scene-bump offset is outside 
    the (-threshold, threshold) range.
    """
    offset = calculate_circular_offset(bump, scene)
    out_phase_mask = np.abs(offset) > threshold
    return np.mean(out_phase_mask)

def load_fish_data(data_dir, fish_id):
    """
    Loads bump and scene .npy files for a given fish.
    """
    try:
        bump = np.load(os.path.join(data_dir, f"{fish_id}_bump.npy"))
        scene = np.load(os.path.join(data_dir, f"{fish_id}_scene.npy"))
        return bump, scene
    except FileNotFoundError as e:
        logging.error(f"Missing data for {fish_id}: {e}")
        return None, None