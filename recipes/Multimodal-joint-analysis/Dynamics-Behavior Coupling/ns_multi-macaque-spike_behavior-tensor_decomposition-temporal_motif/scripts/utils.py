"""
utils.py

Reusable helper functions for tensor decomposition and visualization 
in neural population analysis.
"""

import numpy as np
import logging
import os
import matplotlib.pyplot as plt
from tensorly.decomposition import parafac

def generate_synthetic_data(n_neurons=50, n_time=100, n_trials=200):
    """Generates synthetic neural data containing heterogeneous motifs."""
    logging.info("Generating synthetic PMd population data...")
    t = np.linspace(0, 1, n_time)
    
    # Motifs (Ramping, Phasic, Biphasic)
    factors = np.array([
        t, 
        np.exp(-((t - 0.2)**2) / 0.01), 
        np.sin(2 * np.pi * t)
    ])
    
    trial_weights = np.random.rand(n_trials, 3)
    neuron_map = np.random.rand(n_neurons, 3)
    
    data = np.einsum('nr, tr, kr -> ntk', neuron_map, factors.T, trial_weights)
    data += np.random.normal(0, 0.1, size=data.shape)
    
    return data

def run_cp_decomposition(tensor, rank=3):
    """Performs CP decomposition on a tensor."""
    logging.info(f"Executing CP decomposition with rank R={rank}...")
    _, factors = parafac(tensor, rank=rank, init='random', n_iter_max=100)
    return factors

def plot_temporal_motifs(factors, output_path):
    """Visualizes the temporal motifs (factors[1])."""
    plt.figure(figsize=(10, 4))
    time_factor = factors[1]
    for i in range(time_factor.shape[1]):
        plt.plot(time_factor[:, i], label=f"Factor {i+1}")
    
    plt.title("Extracted Temporal Motifs")
    plt.xlabel("Time Bins")
    plt.ylabel("Firing Rate (A.U.)")
    plt.legend()
    plt.savefig(output_path)
    plt.close()