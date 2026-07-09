"""
utils.py
Common processing functions for neural data analysis.
"""
import os
import pickle
import numpy as np

def load_data(file_path):
    """Loads the population pickle file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Data file not found at {file_path}")
    with open(file_path, 'rb') as f:
        data = pickle.load(f)
    return data

def bin_spikes(spike_times, stim_onset, bin_size=0.01, t_range=(-0.2, 0.8)):
    """Aligns spikes and bins them into counts."""
    bins = np.arange(t_range[0], t_range[1] + bin_size, bin_size)
    counts, _ = np.histogram(spike_times - stim_onset, bins=bins)
    return counts, bins[:-1]

def compute_psth(spike_data, window_size_ms=75, bin_size_ms=10):
    """Applies a boxcar kernel to binned spikes for firing rate estimation."""
    kernel_size = int(window_size_ms / bin_size_ms)
    kernel = np.ones(kernel_size) / kernel_size
    smoothed = np.convolve(spike_data, kernel, mode='same')
    return smoothed / (bin_size_ms / 1000.0)