"""
Granule Cell Odor Response Analysis Pipeline
--------------------------------------------
This script calculates and visualizes the percentage distribution of 
odor-excited, odor-inhibited, and non-responsive granule cell-odor pairs 
across Task and Passive experimental conditions.

Workflow:
1. Aggregate data from experimental result sets.
2. Apply classification masks (Excited/Inhibited).
3. Compute population percentages.
4. Visualize using side-by-side pie charts.

Dependencies: numpy, matplotlib, pandas
"""

import numpy as np
import matplotlib.pyplot as plt
import argparse
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_data(file_path):
    """Loads a .npy file with error handling."""
    if not os.path.exists(file_path):
        logging.error(f"File not found: {file_path}")
        raise FileNotFoundError(f"Missing required data file: {file_path}")
    return np.load(file_path)

def classify_responses(exc_mask, inh_mask):
    """
    Classifies pairs based on excitation and inhibition masks.
    Method:
    - Excited: exc_mask == 1
    - Inhibited: inh_mask == 1
    - Non-responsive: !(Excited | Inhibited)
    """
    excited = (exc_mask == 1)
    inhibited = (inh_mask == 1)
    # Ensure no overlap
    overlap = np.logical_and(excited, inhibited)
    if np.any(overlap):
        logging.warning(f"Detected {np.sum(overlap)} pairs classified as both excited and inhibited.")
        
    non_responsive = ~np.logical_or(excited, inhibited)
    
    return {
        "Excited": np.sum(excited),
        "Inhibited": np.sum(inhibited),
        "Non-responsive": np.sum(non_responsive)
    }

def main(args):
    # 1. Data Loading and Aggregation
    # Task: combining ld and lc
    # Passive: combining pd and pc
    logging.info("Aggregating experimental data...")
    
    try:
        # Load classification masks
        exc_task = load_data(args.exc_task)
        inh_task = load_data(args.inh_task)
        exc_passive = load_data(args.exc_passive)
        inh_passive = load_data(args.inh_passive)
        
        # 2. Classification
        task_stats = classify_responses(exc_task, inh_task)
        passive_stats = classify_responses(exc_passive, inh_passive)
        
        total_task = sum(task_task := [task_stats['Excited'], task_stats['Inhibited'], task_stats['Non-responsive']])
        total_pass = sum(pass_stats := [passive_stats['Excited'], passive_stats['Inhibited'], passive_stats['Non-responsive']])
        
        task_pct = [x/total_task * 100 for x in task_task]
        pass_pct = [x/total_pass * 100 for x in pass_stats]
        
        # 3. Visualization
        logging.info("Generating visualization...")
        fig, axes = plt.subplots(1, 2, figsize=(12, 6))
        labels = ['Excited', 'Inhibited', 'Non-responsive']
        colors = ['#ff9999', '#66b3ff', '#99ff99']
        
        axes[0].pie(task_pct, labels=labels, autopct='%1.1f%%', colors=colors, startangle=90)
        axes[0].set_title("Task Condition")
        
        axes[1].pie(pass_pct, labels=labels, autopct='%1.1f%%', colors=colors, startangle=90)
        axes[1].set_title("Passive Condition")
        
        plt.tight_layout()
        plt.savefig(args.output_fig)
        logging.info(f"Analysis complete. Figure saved to {args.output_fig}")
        
    except Exception as e:
        logging.error(f"Pipeline failed: {e}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze Granule Cell Response Distributions")
    
    # Paths to the .npy classification arrays described in the request
    parser.add_argument('--exc-task', default='joint_cell_odor_pair_exc_task.npy', help='Path to task excitation mask')
    parser.add_argument('--inh-task', default='joint_cell_odor_pair_inh_task.npy', help='Path to task inhibition mask')
    parser.add_argument('--exc-passive', default='joint_cell_odor_pair_exc_passive.npy', help='Path to passive excitation mask')
    parser.add_argument('--inh-passive', default='joint_cell_odor_pair_inh_passive.npy', help='Path to passive inhibition mask')
    parser.add_argument('--output-fig', default='response_distribution.png', help='Output figure filename')
    
    args = parser.parse_args()
    main(args)