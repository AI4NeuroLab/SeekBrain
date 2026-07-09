#!/usr/bin/env python3
"""
PSTH Analysis for PMd Neurons
-----------------------------
This script reproduces the trial-averaged firing rate curves (PSTHs) for 14 
simultaneously recorded PMd neurons as described in the study dynamics and geometry.

Methodology:
- Data Input: population.pkl (Dict/DataFrame of spikes and metadata).
- Binning: 10ms bins, 75ms boxcar sliding window.
- Alignment: Spike times relative to stim_onset.
- Visualization: 2x7 grid showing 4 conditions (Left/Right x Easy/Hard).

Usage:
    python psth_analysis.py --data_path path/to/population.pkl --output_dir ./results
"""

import os
import pickle
import argparse
import logging
import numpy as np
import matplotlib.pyplot as plt

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

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
    """
    Applies a boxcar kernel to binned spikes.
    75ms / 10ms = 7.5 bins, approximated to 7 or 8.
    """
    kernel_size = int(window_size_ms / bin_size_ms)
    kernel = np.ones(kernel_size) / kernel_size
    
    # Simple smoothing using convolution
    smoothed = np.convolve(spike_data, kernel, mode='same')
    return smoothed / (bin_size_ms / 1000.0)  # Convert to Hz

def main(args):
    # Load population
    data = load_data(args.data_path)
    # Expected structure: 'spikes': list of arrays, 'choice': array, 'difficulty': array, 'stim_onset': array
    
    n_neurons = 14
    fig, axes = plt.subplots(2, 7, figsize=(20, 8), sharey=False)
    axes = axes.flatten()
    
    time_bins = np.arange(-0.2, 0.8, 0.01)
    
    for n_idx in range(n_neurons):
        ax = axes[n_idx]
        neuron_key = f'neuron_{n_idx}'
        
        # Conditions mapping
        conditions = [
            ('Left', 'Easy', 'blue', '-'),
            ('Left', 'Hard', 'blue', '--'),
            ('Right', 'Easy', 'red', '-'),
            ('Right', 'Hard', 'red', '--')
        ]
        
        for choice, diff, color, style in conditions:
            # Masking trials based on metadata
            mask = (data['choice'] == choice) & (data['difficulty'] == diff)
            trials = [data['spikes'][neuron_key][i] for i in np.where(mask)[0]]
            
            if not trials:
                continue
                
            # Process PSTH
            psth_trials = []
            for t in trials:
                binned, _ = bin_spikes(t, data['stim_onset'][0]) # Assuming aligned metadata
                psth_trials.append(compute_psth(binned))
            
            psth_arr = np.array(psth_trials)
            mean_psth = np.mean(psth_arr, axis=0)
            sem_psth = np.std(psth_arr, axis=0) / np.sqrt(len(trials))
            
            ax.plot(time_bins[:len(mean_psth)], mean_psth, label=f"{choice} {diff}", color=color, linestyle=style)
            ax.fill_between(time_bins[:len(mean_psth)], mean_psth - sem_psth, mean_psth + sem_psth, color=color, alpha=0.1)
        
        ax.set_title(f"Neuron {n_idx}")
        if n_idx == 0: ax.legend(fontsize='small')

    plt.tight_layout()
    output_file = os.path.join(args.output_dir, "PMd_PSTH_Panel.png")
    plt.savefig(output_file)
    logging.info(f"Plot saved to {output_file}")
    plt.show()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Generate PMd PSTH panels.")
    parser.add_argument('--data_path', type=str, required=True, help="Path to population.pkl")
    parser.add_argument('--output_dir', type=str, default=".", help="Directory to save output")
    args = parser.parse_args()
    
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
        
    main(args)