"""
utils.py
Helper functions for neural data analysis, including PSTH computation, 
data alignment, and visualization utilities.
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import sem

def compute_sliding_psth(spike_times, stim_onset, rt, window=0.075, step=0.010):
    """Computes PSTH using sliding bins."""
    bins = np.arange(0.120, np.max(rt), step)
    psth = np.zeros(len(bins))
    
    # Filter spikes in trial window
    trial_spikes = spike_times[(spike_times >= stim_onset) & (spike_times <= stim_onset + rt)] - stim_onset
    
    for i, b in enumerate(bins):
        count = np.sum((trial_spikes >= b) & (trial_spikes < b + window))
        psth[i] = count / window
    return bins, psth

def pad_and_average_traces(traces):
    """Pads unequal length traces with NaNs and computes mean/sem."""
    if not traces:
        return None
    
    max_len = max(len(t) for t in traces)
    padded = np.full((len(traces), max_len), np.nan)
    for i, t in enumerate(traces):
        padded[i, :len(t)] = t
        
    return {
        'mean': np.nanmean(padded, axis=0),
        'sem': sem(padded, axis=0, nan_policy='omit')
    }

def plot_condition_traces(unit_id, results, output_path, colors=None, styles=None):
    """Generic plotter for multi-condition neural traces."""
    fig, ax = plt.subplots(figsize=(8, 5))
    colors = colors or {'Left': 'blue', 'Right': 'red'}
    styles = styles or {'Easy': '-', 'Hard': '--'}
    
    for cond, data in results.items():
        choice, diff = cond.split('-')
        ax.plot(data['mean'], label=cond, color=colors.get(choice, 'k'), linestyle=styles.get(diff, '-'))
        ax.fill_between(range(len(data['mean'])), 
                        data['mean'] - data['sem'], 
                        data['mean'] + data['sem'], alpha=0.2)
    
    ax.set_title(f"Unit {unit_id} Temporal Profile")
    ax.set_xlabel("Time from Stimulus (bins)")
    ax.set_ylabel("Firing Rate (Hz)")
    ax.legend()
    plt.savefig(output_path)
    plt.close()