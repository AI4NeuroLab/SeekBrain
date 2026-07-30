#!/usr/bin/env python3
"""
Scene-Bump Alignment Disruption Analysis
----------------------------------------
This script quantifies how the alignment between the neural 'bump' position 
and the visual scene orientation changes across experiment epochs (Pre, Learn, Post).

Methodology:
1. Calculates circular difference between bump and scene angles.
2. Identifies 'out-phase' periods where |offset| > 90 degrees (pi/2).
3. Computes the fraction of time spent out-of-phase for each fish per epoch.
4. Generates a paired-line plot to visualize disruption trends.

Inputs:
- Data directory containing .npy files for 'bump_angle' and 'scene_angle'.
- Metadata CSV defining fish IDs and epoch timestamps.
"""

import os
import argparse
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import circmean

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def calculate_circular_offset(bump, scene):
    """Computes circular difference in range (-pi, pi]."""
    return np.arctan2(np.sin(bump - scene), np.cos(bump - scene))

def compute_out_phase_fraction(bump, scene, threshold=np.pi/2):
    """
    Computes the fraction of time the scene-bump offset is outside 
    the (-pi/2, pi/2) range.
    """
    offset = calculate_circular_offset(bump, scene)
    out_phase_mask = np.abs(offset) > threshold
    return np.mean(out_phase_mask)

def main(args):
    # Load metadata
    metadata = pd.read_csv(args.metadata_path)
    results = []

    # Iterate through fish
    for fish_id in metadata['fish_ID'].unique():
        logging.info(f"Processing fish: {fish_id}")
        
        # Load data (Assuming files named as {fish_id}_bump.npy etc)
        try:
            bump = np.load(os.path.join(args.data_dir, f"{fish_id}_bump.npy"))
            scene = np.load(os.path.join(args.data_dir, f"{fish_id}_scene.npy"))
        except FileNotFoundError as e:
            logging.error(f"Missing data for {fish_id}: {e}")
            continue

        # Extract segments based on metadata (start/stop indices)
        fish_meta = metadata[metadata['fish_ID'] == fish_id]
        
        for _, row in fish_meta.iterrows():
            epoch = row['epoch'] # 'pre', 'learning', 'post'
            start, stop = int(row['start_idx']), int(row['stop_idx'])
            
            frac = compute_out_phase_fraction(bump[start:stop], scene[start:stop])
            results.append({'fish_ID': fish_id, 'epoch': epoch, 'fraction': frac})

    # Convert to DataFrame
    df = pd.DataFrame(results)
    df.to_csv(os.path.join(args.output_dir, "disruption_metrics.csv"), index=False)

    # Plotting
    fig, ax = plt.subplots(figsize=(8, 6))
    
    # Plot grey lines for each fish
    order = ['pre', 'learning', 'post']
    for fish_id in df['fish_ID'].unique():
        subset = df[df['fish_ID'] == fish_id].set_index('epoch').reindex(order)
        ax.plot(order, subset['fraction'], 'o-', color='grey', alpha=0.5, label='_nolegend_')

    # Style plot
    ax.set_ylabel("Fraction of Time Out-Phase")
    ax.set_title("Scene-Bump Alignment Disruption")
    ax.set_ylim(0, 1)
    plt.tight_layout()
    plt.savefig(os.path.join(args.output_dir, "alignment_disruption.png"))
    logging.info("Analysis complete. Outputs saved to %s", args.output_dir)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Quantify scene-bump alignment disruption.")
    parser.add_argument("--data_dir", required=True, help="Directory containing .npy files")
    parser.add_argument("--metadata_path", required=True, help="Path to CSV with fish_ID, epoch, start_idx, stop_idx")
    parser.add_argument("--output_dir", default="./output", help="Directory to save results")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
        
    main(args)