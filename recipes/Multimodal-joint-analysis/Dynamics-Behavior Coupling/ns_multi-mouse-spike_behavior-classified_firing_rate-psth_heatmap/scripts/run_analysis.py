"""
PSTH Analysis Pipeline
----------------------
Purpose: 
    Calculates and visualizes Peri-Stimulus Time Histograms (PSTHs) for neural 
    populations, sorted by experimental conditions (choice and stimulus difficulty).

Methodology:
    1. Spike binning: Discretize timestamps into a trial x time matrix.
    2. Alignment: Synchronize spikes to t=0 (stimulus onset).
    3. Smoothing: Apply a Gaussian kernel (sigma=20-50ms) to estimate firing rate.
    4. Averaging: Group by behavioral conditions and aggregate.

Requirements: 
    numpy, pandas, scipy, matplotlib, seaborn
"""

import numpy as np
import pandas as pd
import scipy.ndimage as ndimage
import matplotlib.pyplot as plt
import seaborn as sns
import logging
import argparse
import os

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def generate_synthetic_data(n_trials=200, n_neurons=5, n_bins=500):
    """Generates synthetic spiking data and metadata for demonstration."""
    metadata = pd.DataFrame({
        'trial_id': range(n_trials),
        'choice': np.random.choice(['Left', 'Right'], n_trials),
        'difficulty': np.random.choice(['Easy', 'Hard'], n_trials)
    })
    
    # Random spike events (0 or 1)
    spike_matrix = np.random.choice([0, 1], size=(n_trials, n_neurons, n_bins), p=[0.95, 0.05])
    return spike_matrix, metadata

def compute_psth(spike_matrix, sigma_ms=20, bin_width_ms=1):
    """
    Smoothes binned spikes using a Gaussian kernel.
    Method: Convolution with Gaussian window to estimate instantaneous firing rate.
    """
    sigma_bins = sigma_ms / bin_width_ms
    # Convert to firing rate (Hz): (spikes / bin) * (1000ms / bin_width)
    smoothed = ndimage.gaussian_filter1d(spike_matrix.astype(float), sigma=sigma_bins, axis=2)
    return smoothed * (1000 / bin_width_ms)

def main(args):
    # 1. Data Ingestion
    logger.info("Generating/Loading data...")
    spike_matrix, metadata = generate_synthetic_data()
    
    # 2. Alignment & Binning
    # Assumes spike_matrix is already aligned to t=0 (e.g. at bin index 200)
    # Output: (n_neurons, n_timepoints, n_difficulties, n_choices)
    
    sigma = args.sigma
    logger.info(f"Applying Gaussian smoothing (sigma={sigma}ms)...")
    rate_matrix = compute_psth(spike_matrix, sigma_ms=sigma)
    
    # 3. Aggregation
    results = []
    for (choice, diff), group in metadata.groupby(['choice', 'difficulty']):
        idx = group.index
        # Mean across trials for each neuron
        mean_rate = np.mean(rate_matrix[idx], axis=0)
        
        for neuron_id in range(mean_rate.shape[0]):
            for t in range(mean_rate.shape[1]):
                results.append({
                    'neuron_id': neuron_id,
                    'time': t,
                    'choice': choice,
                    'difficulty': diff,
                    'firing_rate': mean_rate[neuron_id, t]
                })
    
    df_plot = pd.DataFrame(results)
    
    # 4. Visualization
    logger.info("Generating plot...")
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
        
    g = sns.FacetGrid(df_plot[df_plot['neuron_id'] == 0], col='choice', hue='difficulty')
    g.map(sns.lineplot, 'time', 'firing_rate')
    g.add_legend()
    g.set_axis_labels("Time from Stim Onset (ms)", "Firing Rate (Hz)")
    
    plt.savefig(os.path.join(args.output_dir, 'psth_results.png'))
    logger.info(f"Process complete. Plots saved to {args.output_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="PSTH Analysis Pipeline")
    parser.add_argument('--sigma', type=int, default=30, help="Gaussian smoothing kernel sigma in ms")
    parser.add_argument('--output_dir', type=str, default='output', help="Directory to save figures")
    
    args = parser.parse_args()
    
    try:
        main(args)
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")