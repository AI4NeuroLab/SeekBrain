"""
PSTH Generation and Visualization for PMd Neurons
-------------------------------------------------
This script calculates and displays the trial-averaged firing rate curves (PSTHs) 
for 14 simultaneously recorded PMd neurons. It follows the methodology outlined 
in the paper "The Dynamics and Geometry of Population Activity in PMd."

Methodology:
- Data: population.pkl (Spike times and metadata per trial)
- Window: 75ms sliding window, 10ms step
- Uncertainty: Standard Error of the Mean (SEM)
- Visualization: 2x7 grid of panels for 14 neurons

Author: Scientific Computing Assistant
"""

import os
import pickle
import argparse
import logging
import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import uniform_filter1d

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_data(file_path):
    """Loads the population dataset."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Data file not found at {file_path}")
    with open(file_path, 'rb') as f:
        data = pickle.load(f)
    return data

def compute_psth(spikes, condition_indices, window_ms, step_ms, dt=1):
    """
    Computes PSTH using a sliding boxcar window.
    spikes: list of spike times (arrays) for trials
    window_ms: float (ms)
    step_ms: float (ms)
    """
    # Define time range based on common data constraints
    t_start, t_end = -500, 1500
    time_bins = np.arange(t_start, t_end, step_ms)
    
    n_trials = len(condition_indices)
    trial_data = [spikes[i] for i in condition_indices]
    
    # Generate spike counts matrix
    binned_matrix = np.zeros((n_trials, len(time_bins)))
    for i, trial_spikes in enumerate(trial_data):
        counts, _ = np.histogram(trial_spikes, bins=np.append(time_bins, time_bins[-1] + step_ms))
        binned_matrix[i, :] = counts
    
    # Smoothing using uniform_filter1d (mimics moving average window)
    window_size = int(window_ms / step_ms)
    smoothed = uniform_filter1d(binned_matrix, size=window_size, axis=1) * (1000 / window_ms)
    
    mean_rate = np.mean(smoothed, axis=0)
    sem_rate = np.std(smoothed, axis=0) / np.sqrt(n_trials)
    
    return time_bins, mean_rate, sem_rate

def main():
    parser = argparse.ArgumentParser(description="Generate PMd PSTH plots.")
    parser.add_argument("--data", default="data/population.pkl", help="Path to pkl file")
    parser.add_argument("--output", default="psth_plot.png", help="Output plot path")
    args = parser.parse_args()

    # 1. Load Data
    try:
        data = load_data(args.data)
        spikes = data['spikes']       # List of arrays per neuron
        choices = data['choice']     # DataFrame or array of choices
        difficulties = data['difficulty']
    except Exception as e:
        logging.error(f"Error loading data: {e}")
        return

    # 2. Partitioning conditions
    conditions = {
        'Easy-L': (difficulties == 'easy') & (choices == 'left'),
        'Easy-R': (difficulties == 'easy') & (choices == 'right'),
        'Hard-L': (difficulties == 'hard') & (choices == 'left'),
        'Hard-R': (difficulties == 'hard') & (choices == 'right'),
    }
    colors = {'Easy-L': 'blue', 'Easy-R': 'red', 'Hard-L': 'cyan', 'Hard-R': 'orange'}

    # 3. Visualization Setup
    fig, axes = plt.subplots(2, 7, figsize=(20, 8), sharex=True, sharey=True)
    axes = axes.flatten()

    for n in range(14):
        ax = axes[n]
        neuron_spikes = spikes[n]
        
        for cond_name, mask in conditions.items():
            idx = np.where(mask)[0]
            if len(idx) == 0: continue
            
            t, mean, sem = compute_psth(neuron_spikes, idx, 75, 10)
            ax.plot(t, mean, label=cond_name, color=colors[cond_name])
            ax.fill_between(t, mean - sem, mean + sem, color=colors[cond_name], alpha=0.2)
        
        ax.set_title(f"Neuron {n}")
        if n >= 7: ax.set_xlabel("Time from stim (ms)")
        if n % 7 == 0: ax.set_ylabel("Rate (Hz)")

    plt.tight_layout()
    plt.savefig(args.output)
    logging.info(f"Plot saved to {args.output}")

if __name__ == '__main__':
    main()