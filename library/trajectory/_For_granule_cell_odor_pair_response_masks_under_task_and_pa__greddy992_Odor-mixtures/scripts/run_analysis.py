#!/usr/bin/env python3
"""
analyze_gc_responses.py

Purpose:
    Computes and visualizes the percentages of odor-excited, odor-suppressed, and 
    non-responsive granule cell-odor pairs under Task and Passive conditions.
    
Inputs:
    - 8 .npy binary mask files (Excited/Suppressed for ld, lc, pd, pc)
    
Outputs:
    - Console summary of calculated percentages.
    - Side-by-side pie charts (EPS/PNG).

Author: Scientific Computing Assistant
"""

import numpy as np
import matplotlib.pyplot as plt
import argparse
import logging
import os
import sys
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def load_masks(data_dir):
    """Loads necessary .npy files for task and passive analysis."""
    files = {
        'exc_ld': 'joint_cell_odor_pair_exc_ld.npy',
        'exc_lc': 'joint_cell_odor_pair_exc_lc.npy',
        'pre_ld': 'cell_odor_pair_index_pre_ld.npy',
        'pre_lc': 'cell_odor_pair_index_pre_lc.npy',
        'exc_pd': 'joint_cell_odor_pair_exc_pd.npy',
        'exc_pc': 'joint_cell_odor_pair_exc_pc.npy',
        'sup_pd': 'joint_cell_odor_pair_sup_pd.npy',
        'sup_pc': 'joint_cell_odor_pair_sup_pc.npy'
    }
    
    loaded_data = {}
    for key, filename in files.items():
        path = Path(data_dir) / filename
        if not path.exists():
            logger.error(f"Missing required data file: {filename}")
            sys.exit(1)
        loaded_data[key] = np.load(path)
        logger.info(f"Loaded {filename} with shape {loaded_data[key].shape}")
    return loaded_data

def compute_metrics(exc_array, sup_array):
    """Computes distribution percentages. Checks for mask overlap."""
    total_elements = exc_array.size
    n_exc = np.sum(exc_array)
    n_sup = np.sum(sup_array)
    
    # Check for mutual exclusivity
    if np.any((exc_array == 1) & (sup_array == 1)):
        logger.warning("Mask overlap detected! Some pairs are marked as both excited and suppressed.")
        
    p_exc = (n_exc / total_elements) * 100
    p_sup = (n_sup / total_elements) * 100
    p_non = 100 - p_exc - p_sup
    
    return [p_exc, p_sup, p_non]

def plot_results(task_stats, passive_stats, output_path):
    """Generates side-by-side pie charts."""
    labels = ['Excited', 'Suppressed', 'Non-responsive']
    colors = ['#ff9999', '#66b3ff', '#99ff99']
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6))
    
    ax1.pie(task_stats, labels=labels, autopct='%1.1f%%', colors=colors, startangle=140)
    ax1.set_title('Task Condition')
    
    ax2.pie(passive_stats, labels=labels, autopct='%1.1f%%', colors=colors, startangle=140)
    ax2.set_title('Passive Condition')
    
    plt.tight_layout()
    plt.savefig(output_path)
    logger.info(f"Figure saved to {output_path}")

def main():
    parser = argparse.ArgumentParser(description="GC Odor-pair Response Analysis")
    parser.add_argument("--data_dir", type=str, default="./data", help="Directory containing .npy files")
    parser.add_argument("--output", type=str, default="gc_response_distribution.png", help="Output filename")
    args = parser.parse_args()

    data = load_masks(args.data_dir)

    # Pooling logic per reproduction plan
    task_exc = np.concatenate([data['exc_ld'], data['exc_lc']], axis=0)
    task_sup = np.concatenate([data['pre_ld'], data['pre_lc']], axis=0)
    
    passive_exc = np.concatenate([data['exc_pd'], data['exc_pc']], axis=0)
    passive_sup = np.concatenate([data['sup_pd'], data['sup_pc']], axis=0)

    # Calculate percentages
    task_stats = compute_metrics(task_exc, task_sup)
    passive_stats = compute_metrics(passive_exc, passive_sup)

    # Output stats
    print(f"\nTask Stats: Exc={task_stats[0]:.2f}%, Sup={task_stats[1]:.2f}%, Non={task_stats[2]:.2f}%")
    print(f"Passive Stats: Exc={passive_stats[0]:.2f}%, Sup={passive_stats[1]:.2f}%, Non={passive_stats[2]:.2f}%")

    # Plot
    plot_results(task_stats, passive_stats, args.output)

if __name__ == '__main__':
    main()