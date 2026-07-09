"""
utils.py

Provides shared processing, statistical, and visualization utilities for
neuroscience data analysis pipelines.
"""

import numpy as np

def z_score_traces(traces, baseline_slice):
    """
    Normalize traces based on a provided baseline window.
    
    Args:
        traces (np.ndarray): Shape (cells, time)
        baseline_slice (slice): Indices representing the baseline period.
    Returns:
        np.ndarray: Z-scored traces.
    """
    baseline = traces[:, baseline_slice]
    mean = np.mean(baseline, axis=1, keepdims=True)
    std = np.std(baseline, axis=1, keepdims=True)
    return (traces - mean) / (std + 1e-6)

def compute_psth(activity, event_times, window_bins):
    """
    Extract trial-averaged PSTH centered on movement onset.
    
    Args:
        activity (np.ndarray): Activity matrix (cells, time).
        event_times (np.ndarray): Array of onset indices.
        window_bins (list): [start, end] relative to onset.
    Returns:
        np.ndarray: Averaged PSTH (cells, time_bins).
    """
    trials = []
    for t in event_times:
        start, end = t + window_bins[0], t + window_bins[1]
        if start >= 0 and end < activity.shape[1]:
            trials.append(activity[:, start:end])
    return np.array(trials).mean(axis=0)

def calculate_peak_activity(psth, window_slice):
    """
    Calculates peak activity for each cell within a specific window slice.
    """
    return np.max(psth[:, window_slice], axis=1)