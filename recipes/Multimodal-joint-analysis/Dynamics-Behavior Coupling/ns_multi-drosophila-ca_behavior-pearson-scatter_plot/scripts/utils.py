"""
Utility module for EPG data analysis and circular statistics.
"""

import numpy as np
import os
import logging

def get_circular_variance(diffs):
    """Compute circular variance of angular differences."""
    complex_sum = np.mean(np.exp(1j * diffs))
    return 1 - np.abs(complex_sum)

def estimate_bump_width(epg_data):
    """
    Computes bump width using circular standard deviation.
    Ref: Equivalent to von Mises width parameter analysis.
    """
    n_segments = epg_data.shape[1]
    angles = np.linspace(0, 2 * np.pi, n_segments, endpoint=False)
    
    # Calculate phase-weighted circular deviation
    weights = epg_data / (np.sum(epg_data, axis=1, keepdims=True) + 1e-9)
    complex_phase = np.sum(weights * np.exp(1j * angles), axis=1)
    return np.sqrt(-2 * np.log(np.abs(complex_phase)))

def load_fly_data(data_dir):
    """Safely loads behavior and EPG trace files."""
    try:
        behavior = np.load(os.path.join(data_dir, 'behavior.npy'), allow_pickle=True).item()
        epg_traces = np.load(os.path.join(data_dir, 'epg_traces.npy'))
        return behavior, epg_traces
    except Exception as e:
        logging.error(f"Failed to load data from {data_dir}: {e}")
        return None, None

def calculate_circular_phase(epg_data):
    """Extracts instantaneous phase from EPG segments."""
    n_segments = epg_data.shape[1]
    angles = np.linspace(0, 2 * np.pi, n_segments, endpoint=False)
    return np.angle(np.sum(epg_data * np.exp(1j * angles), axis=1))