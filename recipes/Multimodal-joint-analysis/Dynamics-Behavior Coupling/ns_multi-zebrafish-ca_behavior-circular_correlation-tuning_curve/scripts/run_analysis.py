"""
bump_phase_analysis.py

This script reproduces the neural "bump" phase mapping analysis across three experimental 
epochs (pre-learning, learning, post-training). It evaluates the relationship between 
the neural population activity (bump phase) and the external scene orientation (θ).

Reference:
- Mapping internal to external: bump phase vs θ.
- Learning epoch characteristic: bump phase = 2θ (mod 2π).
- Pre/Post-training characteristic: bump phase = θ (mod 2π).

Usage:
    python bump_phase_analysis.py --data_path ./data/fish_01.csv --out_dir ./results/
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import argparse
import logging
import os
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_and_validate_data(data_path):
    """Loads experimental data and performs basic validation."""
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Data file not found: {data_path}")
    
    df = pd.read_csv(data_path)
    required_cols = {'timestamp', 'bump_phase', 'scene_theta', 'epoch'}
    if not required_cols.issubset(df.columns):
        raise ValueError(f"Missing required columns. Expected {required_cols}")
    
    return df

def plot_bump_mapping(df, output_dir):
    """
    Generates scatter plots for each epoch to visualize the mapping of 
    bump phase (phi) vs scene orientation (theta).
    """
    os.makedirs(output_dir, exist_ok=True)
    epochs = ['pre-learning', 'learning', 'post-training']
    
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    for i, epoch in enumerate(epochs):
        data = df[df['epoch'] == epoch]
        if data.empty:
            logging.warning(f"No data found for epoch: {epoch}")
            continue
            
        ax = axes[i]
        theta = data['scene_theta']
        phi = data['bump_phase']
        
        ax.scatter(theta, phi, alpha=0.3, s=5, c='gray', label='Neural Data')
        
        # Plotting Reference Lines (based on paper methods)
        x_vals = np.linspace(0, 2 * np.pi, 100)
        if epoch == 'learning':
            # Bump phase = 2θ (mod 2π)
            y_ref = (2 * x_vals) % (2 * np.pi)
            title = "Learning (Slope 2)"
        else:
            # Bump phase = θ (mod 2π)
            y_ref = x_vals
            title = f"{epoch.capitalize()} (Slope 1)"
            
        ax.plot(x_vals, y_ref, 'k--', linewidth=2, label='Reference Line')
        
        ax.set_title(title)
        ax.set_xlabel('Scene Orientation (θ)')
        ax.set_ylabel('Bump Phase (φ)')
        ax.set_xlim(0, 2 * np.pi)
        ax.set_ylim(0, 2 * np.pi)
        ax.legend()
        
    plt.tight_layout()
    save_path = os.path.join(output_dir, 'bump_phase_mapping.png')
    plt.savefig(save_path)
    logging.info(f"Plot saved to {save_path}")

def main():
    parser = argparse.ArgumentParser(description="Reproduce Bump Phase vs Scene Orientation Analysis")
    parser.add_argument("--data_path", required=True, help="Path to input CSV (cols: timestamp, bump_phase, scene_theta, epoch)")
    parser.add_argument("--out_dir", default="./output", help="Directory to save figures")
    args = parser.parse_args()

    try:
        # Step 1: Load Data
        logging.info("Loading data...")
        df = load_and_validate_data(args.data_path)
        
        # Step 2 & 3: Ensure data is in [0, 2π] range (Data preprocessing requirement)
        df['bump_phase'] = df['bump_phase'] % (2 * np.pi)
        df['scene_theta'] = df['scene_theta'] % (2 * np.pi)
        
        # Step 4: Visualize mapping
        logging.info("Generating mapping plots...")
        plot_bump_mapping(df, args.out_dir)
        
        logging.info("Analysis complete.")
        
    except Exception as e:
        logging.error(f"Analysis failed: {e}")

if __name__ == '__main__':
    # Execution guard
    # The script expects a CSV with specific columns representing the processed 
    # output of the bump estimation and behavioral synchronization described 
    # in the reproduction plan.
    main()