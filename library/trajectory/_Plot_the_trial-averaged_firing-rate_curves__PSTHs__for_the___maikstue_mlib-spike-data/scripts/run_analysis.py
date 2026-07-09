"""
PSTH Analysis Script for PMd Population Dynamics.

This script generates trial-averaged firing-rate curves (PSTHs) for 14 neurons
based on the population dataset structure described in the research question.

Procedure:
1. Load population.pkl containing spike times and trial metadata.
2. Bin spike times at 1ms resolution aligned to stimulus onset.
3. Smooth using a 75ms Gaussian kernel.
4. Downsample to 10ms steps.
5. Compute mean and SEM per condition (Choice x Difficulty).
6. Visualize as a 7x2 grid of subplots.

Reference: 'The dynamics and geometry of decision-making in PMd neurons'.
"""

import os
import pickle
import logging
import argparse
import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter1d

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_data(file_path):
    """Loads the population.pkl file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset not found at {file_path}")
    with open(file_path, 'rb') as f:
        return pickle.load(f)

def compute_psth(spike_trials, window_ms=75, step_ms=10, fs=1000):
    """
    Computes PSTH from raw spike times (in seconds).
    Assumes trial structure: {condition: [list of spike_times_per_trial]}
    """
    # 1. Binning (1ms) - Assuming max trial duration 2000ms
    duration = 2000 
    binned = np.zeros((len(spike_trials), duration))
    for i, spikes in enumerate(spike_trials):
        idx = (spikes * fs).astype(int)
        idx = idx[idx < duration]
        binned[i, idx] = 1
    
    # 2. Smoothing (75ms window)
    sigma = window_ms / (2.355 * 2)  # Conversion to sigma for gaussian
    smoothed = gaussian_filter1d(binned, sigma=sigma, axis=1) * fs
    
    # 3. Downsampling (10ms step)
    return smoothed[:, ::step_ms]

def plot_population_psths(data, output_dir):
    """Generates the 7x2 subplot figure."""
    fig, axes = plt.subplots(7, 2, figsize=(12, 18), sharex=True)
    axes = axes.flatten()
    
    conditions = ['Left-Easy', 'Left-Hard', 'Right-Easy', 'Right-Hard']
    colors = ['blue', 'cyan', 'red', 'orange']
    
    for i in range(14):
        neuron_key = f'neuron_{i}'
        ax = axes[i]
        
        for cond, color in zip(conditions, colors):
            # Extract trials for this condition
            trials = data[neuron_key]['trials'][cond]
            if len(trials) == 0: continue
            
            psth_matrix = compute_psth(trials)
            mean_fr = np.mean(psth_matrix, axis=0)
            sem_fr = np.std(psth_matrix, axis=0) / np.sqrt(psth_matrix.shape[0])
            
            time_axis = np.arange(psth_matrix.shape[1]) * 10
            ax.plot(time_axis, mean_fr, label=cond, color=color, alpha=0.8)
            ax.fill_between(time_axis, mean_fr - sem_fr, mean_fr + sem_fr, 
                            color=color, alpha=0.2)
        
        ax.set_title(f"Neuron {i}")
        ax.axvline(0, color='k', linestyle='--', alpha=0.5)
        if i >= 12: ax.set_xlabel("Time from Stimulus (ms)")
        if i % 2 == 0: ax.set_ylabel("Firing Rate (Hz)")

    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc='upper center', ncol=4)
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig(os.path.join(output_dir, "psth_population.png"))
    logging.info(f"Figure saved to {output_dir}/psth_population.png")

def main():
    parser = argparse.ArgumentParser(description="PSTH Analysis for PMd Neurons")
    parser.add_argument("--data", default="population.pkl", help="Path to data")
    parser.add_argument("--out", default=".", help="Output directory")
    args = parser.parse_args()

    try:
        data = load_data(args.data)
        if not os.path.exists(args.out): os.makedirs(args.out)
        plot_population_psths(data, args.out)
    except Exception as e:
        logging.error(f"Analysis failed: {e}")

if __name__ == '__main__':
    main()