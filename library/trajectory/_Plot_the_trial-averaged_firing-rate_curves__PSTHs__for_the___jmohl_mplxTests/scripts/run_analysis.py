#!/usr/bin/env python3
"""
PSTH Generation for PMd Population
----------------------------------
This script computes and plots trial-averaged firing rate curves (PSTHs) 
for 14 PMd neurons from the provided population dataset.

Methodology:
- Aligns spike times to stimulus onset (t=0).
- Calculates binned firing rates using a 75ms boxcar window with 10ms steps.
- Segregates trials by choice direction (Left/Right) and difficulty (Easy/Hard).
- Estimates uncertainty using the standard error of the mean (SEM).
- Visualizes results in a 2x7 grid to highlight temporal response heterogeneity.

Input:
- examples/2024_the_dynamics_and_geometry/data/population.pkl
  Expected structure: {
    'spikes': list of arrays (one per neuron),
    'trial_starts': array,
    'choice': array (0 for Left, 1 for Right),
    'difficulty': array (0 for Easy, 1 for Hard)
  }
"""

import os
import pickle
import argparse
import logging
import numpy as np
import matplotlib.pyplot as plt

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def compute_psth(spike_times, trial_onsets, window_size=0.075, step=0.010, t_range=(-0.2, 0.8)):
    """Computes binned firing rate for a single neuron across multiple trials."""
    bins = np.arange(t_range[0], t_range[1], step)
    n_trials = len(trial_onsets)
    rates = np.zeros((n_trials, len(bins) - 1))
    
    for i, onset in enumerate(trial_onsets):
        # Align spikes to stimulus onset
        aligned_spikes = spike_times[(spike_times >= onset + t_range[0]) & 
                                     (spike_times <= onset + t_range[1])] - onset
        
        # Apply 75ms boxcar window
        for j, b in enumerate(bins[:-1]):
            count = np.sum((aligned_spikes >= b - window_size/2) & (aligned_spikes <= b + window_size/2))
            rates[i, j] = count / window_size
            
    return rates, bins[:-1] + step/2

def main(args):
    # Load dataset
    if not os.path.exists(args.input_path):
        logging.error(f"File not found: {args.input_path}")
        return

    with open(args.input_path, 'rb') as f:
        data = pickle.load(f)

    # Extract metadata and spikes
    # Assumed structure based on reproduction plan
    metadata = data['metadata']
    spikes = data['spikes']
    onsets = metadata['stimulus_onset']
    choices = metadata['choice']  # 0: Left, 1: Right
    difficulties = metadata['difficulty']  # 0: Easy, 1: Hard

    fig, axes = plt.subplots(2, 7, figsize=(18, 6), sharex=True, sharey=True)
    axes = axes.flatten()

    colors = { (0, 0): 'blue', (0, 1): 'cyan', (1, 0): 'red', (1, 1): 'salmon' }
    linestyles = { 0: '-', 1: '--' }  # 0: Easy (solid), 1: Hard (dashed)

    for n_idx in range(14):
        ax = axes[n_idx]
        neuron_spikes = spikes[n_idx]
        
        for dir_val in [0, 1]:
            for diff_val in [0, 1]:
                mask = (choices == dir_val) & (difficulties == diff_val)
                trial_subset = onsets[mask]
                
                rates, time_axis = compute_psth(neuron_spikes, trial_subset)
                
                mean_rate = np.mean(rates, axis=0)
                sem = np.std(rates, axis=0) / np.sqrt(len(trial_subset))
                
                label = f"{'L' if dir_val==0 else 'R'}-{'Easy' if diff_val==0 else 'Hard'}"
                ax.plot(time_axis, mean_rate, label=label, 
                        color=colors[(dir_val, diff_val)], linestyle=linestyles[diff_val])
                ax.fill_between(time_axis, mean_rate - sem, mean_rate + sem, 
                                color=colors[(dir_val, diff_val)], alpha=0.2)
        
        ax.set_title(f"Neuron {n_idx}")
        if n_idx >= 7: ax.set_xlabel("Time (s)")
        if n_idx % 7 == 0: ax.set_ylabel("Firing Rate (Hz)")

    plt.tight_layout()
    plt.savefig(args.output_path)
    logging.info(f"PSTH figure saved to {args.output_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Generate PSTHs for PMd neurons.")
    parser.add_argument('--input_path', type=str, 
                        default='examples/2024_the_dynamics_and_geometry/data/population.pkl',
                        help='Path to the input .pkl file.')
    parser.add_argument('--output_path', type=str, default='psth_results.pdf',
                        help='Path to save the output PDF figure.')
    
    args = parser.parse_args()
    main(args)