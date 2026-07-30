"""
Characterize heterogeneous single-neuron activity in macaque PMd.

This script computes sliding-window PSTHs for neural units, conditioned on 
behavioral performance (Choice: Left/Right, Difficulty: Easy/Hard). It 
generates PSTH plots for each unit to visualize diverse temporal profiles 
(ramping, transient, etc.) as described in the paper.

Dependencies: numpy, pandas, scipy, matplotlib, phylib
Usage:
    python pmd_analysis.py --data_path ./path/to/phy_session/ --output_dir ./results/
"""

import os
import argparse
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import sem
from phylib.io.model import load_model

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def compute_sliding_psth(spike_times, stim_onset, rt, window=0.075, step=0.010):
    """
    Computes PSTH using 75ms bins sliding every 10ms.
    Alignment: Stimulus onset to Reaction Time (RT).
    """
    bins = np.arange(0.120, np.max(rt), step)  # Start 120ms post-stim
    psth = np.zeros(len(bins))
    
    # Filter spikes occurring in trial window
    trial_spikes = spike_times[(spike_times >= stim_onset) & (spike_times <= stim_onset + rt)] - stim_onset
    
    for i, b in enumerate(bins):
        count = np.sum((trial_spikes >= b) & (trial_spikes < b + window))
        psth[i] = count / window  # Rate in Hz
    return bins, psth

def process_unit(unit_id, model, behavioral_df):
    """Processes a single unit and returns trial-averaged firing rates."""
    all_spikes = model.spike_times[model.spike_clusters == unit_id]
    conditions = ['Left-Easy', 'Left-Hard', 'Right-Easy', 'Right-Hard']
    results = {}

    for cond in conditions:
        subset = behavioral_df[behavioral_df['condition'] == cond]
        traces = []
        for _, row in subset.iterrows():
            _, trace = compute_sliding_psth(all_spikes, row['stim_onset'], row['rt'])
            traces.append(trace)
        
        if traces:
            # Pad traces to match length (RT-capped variability handled by masking)
            max_len = max(len(t) for t in traces)
            padded = np.full((len(traces), max_len), np.nan)
            for i, t in enumerate(traces):
                padded[i, :len(t)] = t
            
            results[cond] = {
                'mean': np.nanmean(padded, axis=0),
                'sem': sem(padded, axis=0, nan_policy='omit')
            }
    return results

def plot_unit(unit_id, results, output_dir):
    """Visualizes the 4 condition traces for a unit."""
    fig, ax = plt.subplots(figsize=(8, 5))
    colors = {'Left': 'blue', 'Right': 'red'}
    styles = {'Easy': '-', 'Hard': '--'}
    
    for cond, data in results.items():
        choice, diff = cond.split('-')
        ax.plot(data['mean'], label=cond, color=colors[choice], linestyle=styles[diff])
        ax.fill_between(range(len(data['mean'])), 
                        data['mean'] - data['sem'], 
                        data['mean'] + data['sem'], alpha=0.2)
    
    ax.set_title(f"Unit {unit_id} Temporal Profile")
    ax.set_xlabel("Time from Stimulus (bins)")
    ax.set_ylabel("Firing Rate (Hz)")
    ax.legend()
    plt.savefig(os.path.join(output_dir, f"unit_{unit_id}_psth.png"))
    plt.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_path", required=True, help="Path to phy session directory")
    parser.add_argument("--output_dir", required=True, help="Path to save results")
    args = parser.parse_args()

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    # Load Model (phy source of truth)
    model = load_model(args.data_path)
    
    # Mock behavioral data loading (Replace with real CSV/Mat access)
    # Expected cols: stim_onset, rt, coherence, choice
    # behavioral_df = pd.read_csv(os.path.join(args.data_path, 'behavior.csv'))
    logger.info("Generating mock behavioral data for demonstration...")
    n_trials = 100
    behavioral_df = pd.DataFrame({
        'stim_onset': np.linspace(0, 100, n_trials),
        'rt': np.random.uniform(0.5, 1.2, n_trials),
        'condition': np.random.choice(['Left-Easy', 'Left-Hard', 'Right-Easy', 'Right-Hard'], n_trials)
    })

    # Characterize neurons
    for unit_id in model.cluster_ids[:10]:  # Analyze first 10 for demo
        logger.info(f"Processing unit {unit_id}")
        try:
            results = process_unit(unit_id, model, behavioral_df)
            plot_unit(unit_id, results, args.output_dir)
        except Exception as e:
            logger.error(f"Failed to process unit {unit_id}: {e}")

if __name__ == '__main__':
    main()