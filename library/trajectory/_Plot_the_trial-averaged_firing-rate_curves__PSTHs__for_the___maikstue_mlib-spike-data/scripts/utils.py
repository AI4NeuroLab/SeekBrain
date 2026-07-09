"""
Utility functions for neural data analysis.
"""
import os
import pickle
import numpy as np
from scipy.ndimage import gaussian_filter1d

def load_pkl_data(file_path):
    """Loads and returns data from a pickle file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset not found at {file_path}")
    with open(file_path, 'rb') as f:
        return pickle.load(f)

def compute_psth(spike_trials, window_ms=75, step_ms=10, fs=1000, duration_ms=2000):
    """
    Computes PSTH from raw spike times (in seconds).
    
    Args:
        spike_trials: List of lists containing spike times for each trial.
        window_ms: Smoothing window in ms.
        step_ms: Downsampling step in ms.
        fs: Sampling frequency in Hz.
        duration_ms: Max trial duration in ms.
        
    Returns:
        numpy.ndarray: Smoothed, downsampled firing rate matrix.
    """
    duration = duration_ms
    binned = np.zeros((len(spike_trials), duration))
    for i, spikes in enumerate(spike_trials):
        idx = (spikes * fs).astype(int)
        idx = idx[idx < duration]
        binned[i, idx] = 1
    
    # Sigma for Gaussian filter: window_ms / (2.355 * 2) 
    sigma = window_ms / 4.71
    smoothed = gaussian_filter1d(binned, sigma=sigma, axis=1) * fs
    
    # Downsample
    return smoothed[:, ::step_ms]

def get_stats(data_matrix):
    """Computes mean and SEM for a matrix of trials (axis 0)."""
    mean_fr = np.mean(data_matrix, axis=0)
    sem_fr = np.std(data_matrix, axis=0) / np.sqrt(data_matrix.shape[0])
    return mean_fr, sem_fr