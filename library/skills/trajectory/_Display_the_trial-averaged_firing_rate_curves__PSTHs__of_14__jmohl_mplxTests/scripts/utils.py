"""
Utility functions for neural data processing.
"""
import os
import pickle
import numpy as np
from scipy.ndimage import uniform_filter1d

def load_data(file_path):
    """Loads a pickled dataset from the specified path."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Data file not found at {file_path}")
    with open(file_path, 'rb') as f:
        return pickle.load(f)

def compute_psth(spikes, condition_indices, window_ms, step_ms, t_range=(-500, 1500)):
    """
    Computes PSTH using a sliding boxcar window for a set of trials.
    
    Args:
        spikes: List of arrays containing spike times per trial.
        condition_indices: Indices of trials to include.
        window_ms: Smoothing window size (ms).
        step_ms: Bin size (ms).
        t_range: Tuple of (start, end) time in ms.
        
    Returns:
        time_bins, mean_rate, sem_rate
    """
    t_start, t_end = t_range
    time_bins = np.arange(t_start, t_end, step_ms)
    
    n_trials = len(condition_indices)
    if n_trials == 0:
        return time_bins, np.zeros_like(time_bins), np.zeros_like(time_bins)

    # Bin spikes
    binned_matrix = np.zeros((n_trials, len(time_bins)))
    for i, idx in enumerate(condition_indices):
        trial_spikes = spikes[idx]
        counts, _ = np.histogram(trial_spikes, bins=np.append(time_bins, time_bins[-1] + step_ms))
        binned_matrix[i, :] = counts
    
    # Smooth and convert to Hz
    window_size = int(window_ms / step_ms)
    smoothed = uniform_filter1d(binned_matrix, size=window_size, axis=1) * (1000 / step_ms)
    
    mean_rate = np.mean(smoothed, axis=0)
    sem_rate = np.std(smoothed, axis=0) / np.sqrt(n_trials)
    
    return time_bins, mean_rate, sem_rate