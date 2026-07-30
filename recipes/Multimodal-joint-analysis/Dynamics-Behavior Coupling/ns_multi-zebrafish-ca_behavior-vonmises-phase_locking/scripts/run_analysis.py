#!/usr/bin/env python3
"""
Analysis script to test if the neural bump phase maintains a constant offset 
to the scene orientation during 'jump' and 'noise' epochs.

Methods derived from standard neural navigation research (e.g., Zebrafish HD cell studies):
1. Compute Delta Theta: Angle difference between bump and scene.
2. von Mises Fitting: MLE to determine concentration parameter (kappa).
3. Null Hypothesis: Circular shift (roll) of neural traces to maintain temporal structure.
4. Thresholding: Calculate 95th percentile of null distribution for significance.

Usage:
    python analyze_bump_coupling.py --data_path ./data.npy --output_dir ./results
"""

import numpy as np
import scipy.stats as stats
import matplotlib.pyplot as plt
import argparse
import logging
import os
import json
from pathlib import Path

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def wrap_to_pi(angles):
    """Wraps angles to the range [-pi, pi]."""
    return (angles + np.pi) % (2 * np.pi) - np.pi

def get_kappa(angles):
    """
    Fits a von Mises distribution to data and returns kappa (concentration).
    Using scipy.stats.vonmises.fit with fixed scale (1).
    """
    _, kappa = stats.vonmises.fit(angles, fscale=1)
    return kappa

def run_shuffle_control(bump_phase, scene_orientation, mask, n_shuffles=1000):
    """
    Performs circular shifts (rolling) on bump_phase to preserve local 
    autocorrelation while breaking phase locking to the scene.
    """
    epoch_data = wrap_to_pi(bump_phase[mask] - scene_orientation[mask])
    n_samples = len(epoch_data)
    null_kappas = []
    
    for _ in range(n_shuffles):
        # Circular shift by random amount
        shift = np.random.randint(1, len(bump_phase))
        shuffled_bump = np.roll(bump_phase, shift)
        shuffled_delta = wrap_to_pi(shuffled_bump[mask] - scene_orientation[mask])
        null_kappas.append(get_kappa(shuffled_delta))
        
    return np.percentile(null_kappas, 95), np.median(null_kappas)

def analyze_condition(data, mask):
    """Computes observed kappa for a specific epoch mask."""
    delta = wrap_to_pi(data['bump'][mask] - data['scene'][mask])
    return get_kappa(delta)

def main(args):
    # Load Data
    try:
        data = np.load(args.data_path, allow_pickle=True).item()
        # Expecting keys: 'bump_phase', 'scene_orientation', 'jump_mask', 'noise_mask'
    except Exception as e:
        logging.error(f"Failed to load data: {e}")
        return

    os.makedirs(args.output_dir, exist_ok=True)
    results = {}

    for cond in ['jump', 'noise']:
        mask = data[f'{cond}_mask']
        if np.sum(mask) < 100:
            logging.warning(f"Insufficient data for {cond} epoch.")
            continue
            
        obs_k = analyze_condition(data, mask)
        k_95, k_med = run_shuffle_control(data['bump_phase'], data['scene_orientation'], mask)
        
        results[cond] = {'observed': obs_k, 'shuffle_95': k_95, 'shuffle_med': k_med}
        logging.info(f"{cond.upper()} | Kappa: {obs_k:.3f}, Null 95%: {k_95:.3f}")

    # Plotting
    fig, ax = plt.subplots(figsize=(6, 4))
    conditions = list(results.keys())
    obs_vals = [results[c]['observed'] for c in conditions]
    null_vals = [results[c]['shuffle_95'] for c in conditions]
    
    x = np.arange(len(conditions))
    ax.bar(x - 0.2, obs_vals, width=0.3, label='Observed Kappa')
    ax.bar(x + 0.2, null_vals, width=0.3, label='Shuffle 95th %', color='gray')
    
    ax.set_xticks(x)
    ax.set_xticklabels(conditions)
    ax.set_ylabel('Concentration Parameter ($\kappa$)')
    ax.legend()
    plt.title("Bump-Scene Phase Coupling")
    
    plt.savefig(os.path.join(args.output_dir, "kappa_analysis.png"))
    with open(os.path.join(args.output_dir, "results.json"), 'w') as f:
        json.dump(results, f, indent=4)
        
    logging.info(f"Analysis complete. Results saved to {args.output_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze bump-scene phase coupling.")
    parser.add_argument("--data_path", required=True, help="Path to .npy data file")
    parser.add_argument("--output_dir", default="./analysis_output", help="Output directory")
    args = parser.parse_args()
    
    main(args)