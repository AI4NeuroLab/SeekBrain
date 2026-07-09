"""
Functional Analysis: Correlating EPG Bump Width and HD Encoding Accuracy.

This script processes neural imaging data to test the hypothesis that flies with 
more accurate head-direction (HD) encoding show narrower EPG bumps. 
It follows the methods typically described in studies like Green et al. (2017).

Analysis Steps:
1. Filters data for movement periods (velocity > threshold).
2. Computes Encoding Accuracy: 1 - circular_variance(phi_epg - theta_hd).
3. Computes Mean Bump Width: The circular standard deviation/kappa proxy.
4. Performs Pearson Correlation across a cohort of flies.
5. Generates and saves a scatter plot with regression statistics.

Inputs:
    - Path to a CSV file containing columns: 'fly_id', 'velocity', 'bump_phase', 
      'head_dir', 'bump_width' (for each time point).
"""

import argparse
import logging
import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from scipy import stats
from astropy.stats import circular_var

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def compute_encoding_accuracy(phase_epg, head_dir):
    """Computes accuracy as 1 - circular variance of the offset."""
    diff = np.mod(phase_epg - head_dir, 2 * np.pi)
    circ_var = circular_var(diff)
    return 1.0 - circ_var

def process_fly_data(df, v_threshold=0.1):
    """Processes per-fly data into aggregate metrics."""
    # 1. Filter Movement
    df_mov = df[df['velocity'] > v_threshold]
    
    if len(df_mov) < 100:  # Basic data integrity check
        return None
    
    # 2. Compute Metrics
    accuracy = compute_encoding_accuracy(df_mov['bump_phase'], df_mov['head_dir'])
    mean_width = df_mov['bump_width'].mean()
    
    return pd.Series({'encoding_accuracy': accuracy, 'mean_bump_width': mean_width})

def main(args):
    # Load dataset
    try:
        data = pd.read_csv(args.input_path)
    except FileNotFoundError:
        logging.error(f"File not found: {args.input_path}")
        return

    # Aggregate by fly
    results = []
    for fly_id, group in data.groupby('fly_id'):
        metrics = process_fly_data(group, args.v_threshold)
        if metrics is not None:
            metrics['fly_id'] = fly_id
            results.append(metrics)
    
    results_df = pd.DataFrame(results)
    
    if len(results_df) < 5:
        logging.warning("Insufficient flies for correlation analysis.")
        return

    # Statistics
    r, p = stats.pearsonr(results_df['encoding_accuracy'], results_df['mean_bump_width'])
    logging.info(f"Pearson Correlation: r={r:.3f}, p={p:.4f}")

    # Visualization
    plt.figure(figsize=(8, 6))
    sns.regplot(data=results_df, x='encoding_accuracy', y='mean_bump_width', scatter_kws={'s': 100})
    plt.title(f'HD Encoding Accuracy vs. EPG Bump Width\nPearson r={r:.2f}, p={p:.3f}')
    plt.xlabel('Encoding Accuracy (1 - Circular Variance)')
    plt.ylabel('Mean Bump Width (rad)')
    
    # Save Outputs
    results_df.to_csv(f"{args.output_dir}/fly_metrics.csv", index=False)
    plt.savefig(f"{args.output_dir}/correlation_plot.png")
    logging.info(f"Analysis saved to {args.output_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Correlate EPG bump width with HD accuracy.")
    parser.add_argument('--input_path', type=str, required=True, help="Path to trial data CSV.")
    parser.add_argument('--output_dir', type=str, default=".", help="Directory to save outputs.")
    parser.add_argument('--v_threshold', type=float, default=0.5, help="Velocity threshold for movement.")
    
    args = parser.parse_args()
    main(args)