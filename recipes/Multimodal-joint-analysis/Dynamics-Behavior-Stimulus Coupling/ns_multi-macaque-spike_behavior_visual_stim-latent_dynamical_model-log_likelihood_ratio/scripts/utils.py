"""
utils.py

Reusable helper functions for neural data analysis, including statistical 
baseline calculations and visualization utilities.
"""

import numpy as np
import matplotlib.pyplot as plt
import os

def compute_psth_likelihood(spikes, time_bins, T):
    """
    Computes Poisson log-likelihood of spike data given trial-averaged PSTH.
    
    Args:
        spikes (array): Spike times for a single neuron.
        time_bins (array): Time bin edges.
        T (float): Total duration.
        
    Returns:
        float: Total log-likelihood.
    """
    K = 1 # Number of trials assumption for baseline calculation
    counts = np.histogram(spikes, bins=time_bins)[0] / K
    rate = counts / (T / len(time_bins))
    rate = np.maximum(rate, 1e-6)  # Avoid log(0)
    
    ll = np.sum(counts * np.log(rate) - rate)
    return ll

def plot_improvement_distribution(delta_lls, save_path):
    """
    Plots and saves the distribution of model improvement (Delta-LL).
    
    Args:
        delta_lls (array): Array of differences in log-likelihood.
        save_path (str): Full path to save the generated image.
    """
    plt.figure(figsize=(8, 4))
    plt.hist(delta_lls, bins=20, color='skyblue', edgecolor='black')
    plt.axvline(0, color='red', linestyle='--')
    plt.xlabel('$\\Delta$ Log-Likelihood (LDM - PSTH)')
    plt.ylabel('Neuron Count')
    plt.title('Distribution of Model Improvement')
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()

def ensure_directory(path):
    """Checks if directory exists, creates if not."""
    os.makedirs(path, exist_ok=True)