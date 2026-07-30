"""
Utility module for PSTH analysis.
Contains reusable data processing and visualization helpers.
"""

import numpy as np
import pandas as pd
import scipy.ndimage as ndimage
import seaborn as sns
import matplotlib.pyplot as plt

def compute_psth(spike_matrix, sigma_ms=20, bin_width_ms=1):
    """
    Smoothes binned spikes using a Gaussian kernel.
    spike_matrix shape: (n_trials, n_neurons, n_bins)
    """
    sigma_bins = sigma_ms / bin_width_ms
    smoothed = ndimage.gaussian_filter1d(spike_matrix.astype(float), sigma=sigma_bins, axis=2)
    return smoothed * (1000 / bin_width_ms)

def aggregate_by_condition(rate_matrix, metadata, grouping_cols=['choice', 'difficulty']):
    """
    Groups trials by behavioral conditions and computes mean firing rates.
    """
    results = []
    for keys, group in metadata.groupby(grouping_cols):
        idx = group.index
        mean_rate = np.mean(rate_matrix[idx], axis=0)
        
        n_neurons, n_time = mean_rate.shape
        for neuron_id in range(n_neurons):
            for t in range(n_time):
                row = {col: keys[i] for i, col in enumerate(grouping_cols)}
                row.update({
                    'neuron_id': neuron_id,
                    'time': t,
                    'firing_rate': mean_rate[neuron_id, t]
                })
                results.append(row)
    return pd.DataFrame(results)

def plot_psth(df, neuron_id, output_path):
    """Generates a FacetGrid plot for a specific neuron."""
    g = sns.FacetGrid(df[df['neuron_id'] == neuron_id], col='choice', hue='difficulty')
    g.map(sns.lineplot, 'time', 'firing_rate')
    g.add_legend()
    g.set_axis_labels("Time from Stim Onset (ms)", "Firing Rate (Hz)")
    plt.savefig(output_path)
    plt.close()