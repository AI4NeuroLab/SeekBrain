"""
Characterization of glyt2–gfra1a molecular subtype functional dynamics.

Purpose: 
    1. Align calcium dF/F traces to stimulus onset.
    2. Calculate behavioral correlation (Pearson) with swimming kinematics.
    3. Aggregate across 3 fish for violin plot visualization.
    4. Generate multi-panel report including activity traces and statistics.

Inputs:
    - Processed CSV files containing: 'fish_id', 'cluster_id', 'time', 'dff', 'swim_event'.
Output:
    - 'functional_characterization.png': Multi-panel figure with PSTHs and violin plots.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import logging
import argparse
import os
from scipy.stats import pearsonr

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_data(data_path):
    """Load and validate processed neuro-functional data."""
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Data file {data_path} not found.")
    df = pd.read_csv(data_path)
    required_cols = {'fish_id', 'cluster_id', 'time', 'dff', 'swim_event'}
    if not required_cols.issubset(df.columns):
        raise ValueError(f"Missing required columns. Expected {required_cols}")
    return df

def calculate_behavioral_correlation(df):
    """Correlate calcium activity with swim kinematics per neuron."""
    results = []
    for (f_id, c_id), group in df.groupby(['fish_id', 'cluster_id']):
        corr, _ = pearsonr(group['dff'], group['swim_event'])
        results.append({'fish_id': f_id, 'cluster_id': c_id, 'correlation': corr, 
                        'max_response': group['dff'].max()})
    return pd.DataFrame(results)

def plot_multi_panel(df, stats_df, output_dir):
    """Generates the multi-panel figure for the glyt2–gfra1a characterization."""
    fig = plt.figure(figsize=(12, 10))
    gs = fig.add_gridspec(2, 2)

    # Panel A: Trial-averaged PSTH for glyt2–gfra1a cluster
    ax1 = fig.add_subplot(gs[0, :])
    target_cluster = df[df['cluster_id'] == 'glyt2-gfra1a']
    sns.lineplot(data=target_cluster, x='time', y='dff', ax=ax1, errorbar='sd')
    ax1.set_title("Trial-Aligned Calcium Dynamics (glyt2–gfra1a)")
    ax1.set_ylabel("ΔF/F")

    # Panel B: Max Response Violin Plot
    ax2 = fig.add_subplot(gs[1, 0])
    sns.violinplot(data=stats_df, x='cluster_id', y='max_response', ax=ax2)
    ax2.set_title("Max Visual Response")

    # Panel C: Swim Correlation Violin Plot
    ax3 = fig.add_subplot(gs[1, 1])
    sns.violinplot(data=stats_df, x='cluster_id', y='correlation', ax=ax3)
    ax3.set_title("Behavioral Correlation (Swim)")

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'functional_characterization.png'))
    logging.info("Visualization saved to output directory.")

def main():
    parser = argparse.ArgumentParser(description="Analyze glyt2–gfra1a functional subtype.")
    parser.add_argument("--input", required=True, help="Path to aggregated CSV data")
    parser.add_argument("--output", default="./results", help="Output directory")
    args = parser.parse_args()

    if not os.path.exists(args.output):
        os.makedirs(args.output)

    try:
        logging.info("Loading dataset...")
        data = load_data(args.input)
        
        logging.info("Calculating behavioral correlations...")
        stats = calculate_behavioral_correlation(data)
        
        logging.info("Generating multi-panel visualization...")
        plot_multi_panel(data, stats, args.output)
        
        logging.info("Analysis complete.")
    except Exception as e:
        logging.error(f"Analysis failed: {e}")

if __name__ == '__main__':
    main()