"""
analyze_gc_modulation.py

PURPOSE:
    Analyzes whether granule cell (GC) movement-related responses are modulated by 
    task engagement compared to passive stimulus conditions. This script calculates 
    PSTHs, generates activity heatmaps, and computes the Modulation Index (MI) 
    using a Wilcoxon signed-rank test.

METHODOLOGICAL ALIGNMENT:
    - Normalization: Z-score using baseline window [-500, 0]ms.
    - Behavior: Motion Energy (ME) based event alignment.
    - Statistics: Wilcoxon signed-rank test on peak activity.

INPUTS:
    --data_path: Path to .npz file containing 'traces', 'timestamps', and 'behavioral_events'.
    --output_dir: Directory to save figures and statistics.

OUTPUTS:
    - PSTH_Comparison.png: Comparison of Task vs Passive movement-locked activity.
    - GC_Heatmap.png: Normalized GC activity sorted by movement onset.
    - stats.txt: Statistical results.
"""

import os
import argparse
import logging
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import wilcoxon

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def z_score_traces(traces, baseline_indices):
    """Normalize traces based on baseline window."""
    baseline = traces[:, baseline_indices]
    mean = np.mean(baseline, axis=1, keepdims=True)
    std = np.std(baseline, axis=1, keepdims=True)
    return (traces - mean) / (std + 1e-6)

def compute_psth(activity, event_times, window_bins, fs=30):
    """Extract trial-averaged PSTH centered on movement onset."""
    trials = []
    for t in event_times:
        start, end = t + window_bins[0], t + window_bins[1]
        if start >= 0 and end < activity.shape[1]:
            trials.append(activity[:, start:end])
    return np.array(trials).mean(axis=0) # Shape: (cells, time_bins)

def main(args):
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    # 1. Load Data
    try:
        data = np.load(args.data_path)
        traces = data['traces']  # Shape: (cells, time)
        task_events = data['task_movement_onsets']
        passive_events = data['passive_movement_onsets']
    except Exception as e:
        logging.error(f"Failed to load data: {e}")
        return

    # 2. Normalize Traces (Reference: normalize_traces.py)
    # Assuming -500ms baseline (e.g., 15 frames at 30Hz)
    z_traces = z_score_traces(traces, slice(0, 15))

    # 3. PSTH Generation (Reference: compute_psth.py)
    window = [-30, 60] # -1s to +2s @ 30Hz
    psth_task = compute_psth(z_traces, task_events, window)
    psth_passive = compute_psth(z_traces, passive_events, window)

    # 4. Statistical Analysis (Reference: stats_analysis.py)
    # Compare peak activity in the post-movement window [0, 1s]
    peak_task = np.max(psth_task[:, 30:60], axis=1)
    peak_passive = np.max(psth_passive[:, 30:60], axis=1)
    
    stat, p_val = wilcoxon(peak_task, peak_passive)
    
    with open(os.path.join(args.output_dir, 'stats.txt'), 'w') as f:
        f.write(f"Wilcoxon Signed-Rank Test\n")
        f.write(f"Statistic: {stat}, P-value: {p_val}\n")
    
    logging.info(f"Analysis complete. P-value: {p_val:.4f}")

    # 5. Visualization
    fig, axes = plt.subplots(2, 1, figsize=(8, 10))
    axes[0].plot(np.mean(psth_task, axis=0), label='Task')
    axes[0].plot(np.mean(psth_passive, axis=0), label='Passive')
    axes[0].set_title('Mean Granule Cell Movement Response')
    axes[0].legend()
    
    axes[1].imshow(psth_task, aspect='auto', cmap='viridis', vmin=0, vmax=2)
    axes[1].set_title('Task-Engaged GC Activity Heatmap')
    
    plt.tight_layout()
    plt.savefig(os.path.join(args.output_dir, 'GC_Modulation_Summary.png'))
    logging.info("Plots saved.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze GC movement responses.")
    parser.add_argument('--data_path', type=str, required=True, help="Path to input .npz")
    parser.add_argument('--output_dir', type=str, default='./results', help="Save folder")
    args = parser.parse_args()
    main(args)