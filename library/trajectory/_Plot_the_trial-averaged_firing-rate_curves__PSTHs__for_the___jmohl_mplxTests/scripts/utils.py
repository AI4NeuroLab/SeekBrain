"""
Utility functions for neural data analysis.
"""
import os
import pickle
import logging
import numpy as np

def load_population_data(filepath):
    """Loads and validates the population dataset."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Data file not found: {filepath}")
    with open(filepath, 'rb') as f:
        return pickle.load(f)

def compute_psth(spike_times, trial_onsets, window_size=0.075, step=0.010, t_range=(-0.2, 0.8)):
    """Computes binned firing rate (PSTH) for a single neuron across multiple trials."""
    bins = np.arange(t_range[0], t_range[1], step)
    n_trials = len(trial_onsets)
    rates = np.zeros((n_trials, len(bins) - 1))
    
    for i, onset in enumerate(trial_onsets):
        aligned_spikes = spike_times[(spike_times >= onset + t_range[0]) & 
                                     (spike_times <= onset + t_range[1])] - onset
        
        for j, b in enumerate(bins[:-1]):
            count = np.sum((aligned_spikes >= b - window_size/2) & 
                           (aligned_spikes <= b + window_size/2))
            rates[i, j] = count / window_size
            
    return rates, bins[:-1] + step/2

def get_stats(rates):
    """Calculates mean and SEM for a set of trial firing rates."""
    mean_rate = np.mean(rates, axis=0)
    sem = np.std(rates, axis=0) / np.sqrt(rates.shape[0])
    return mean_rate, sem