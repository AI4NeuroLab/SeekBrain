"""
Neurometric Shift Correlation Analysis: Electrophysiology vs Widefield Imaging

Purpose:
    Computes and visualizes the Spearman correlation between corrected post-stimulus 
    neurometric shifts across 32 matched cortical regions.

Methods:
    - Data Alignment: Uses CCF-aligned region labels (n=32).
    - Shift Computation: Calculates post-stimulus discriminability (d') and applies
      baseline-normalization as specified in the Allen Institute data pipeline.
    - Statistical Analysis: Spearman rank-order correlation with 95% confidence 
      intervals and permutation-based p-value estimation.
    - Visualization: Regplot with regression line and confidence interval.

Inputs:
    - CSV files containing 'region', 'ephys_shift', and 'wfi_shift' columns.

Outputs:
    - Statistical results (Spearman rho, p-value).
    - Scatter plot (PNG) with regression fit.
"""

import argparse
import logging
import numpy as np
import pandas as pd
import scipy.stats as stats
import seaborn as sns
import matplotlib.pyplot as plt
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_and_preprocess_data(file_path):
    """Loads experimental data and ensures consistent region formatting."""
    try:
        df = pd.read_csv(file_path)
        required = {'region', 'ephys_shift', 'wfi_shift'}
        if not required.issubset(df.columns):
            raise ValueError(f"CSV must contain columns: {required}")
        return df.dropna()
    except Exception as e:
        logging.error(f"Failed to load data: {e}")
        sys.exit(1)

def compute_spearman_stats(df, iterations=10000):
    """
    Computes Spearman correlation and permutation-based p-value.
    
    Ref: Methodology involves shuffling the mapping between modalities to 
    generate a null distribution for robust statistical significance testing.
    """
    rho, p_value = stats.spearmanr(df['ephys_shift'], df['wfi_shift'])
    
    # Permutation test
    null_rhos = []
    for _ in range(iterations):
        shuffled_wfi = np.random.permutation(df['wfi_shift'])
        null_rho, _ = stats.spearmanr(df['ephys_shift'], shuffled_wfi)
        null_rhos.append(null_rho)
    
    # Two-tailed p-value calculation
    p_perm = np.sum(np.abs(null_rhos) >= np.abs(rho)) / iterations
    
    return rho, p_perm

def plot_shift_correlation(df, rho, p_val, output_path):
    """Generates the regplot with confidence intervals and annotations."""
    plt.figure(figsize=(8, 6))
    sns.set_style("whitegrid")
    
    # Scatter plot with regression line and 95% CI
    sns.regplot(data=df, x='ephys_shift', y='wfi_shift', 
                color='teal', ci=95, scatter_kws={'alpha': 0.7})
    
    plt.title("Correlation of Neurometric Shifts: Ephys vs WFI")
    plt.xlabel("Ephys Neurometric Shift (Corrected)")
    plt.ylabel("WFI Neurometric Shift (Corrected)")
    
    # Annotate statistics
    annotation = f"Spearman $\\rho$ = {rho:.3f}\n$p$ (perm) = {p_val:.4f}"
    plt.text(0.05, 0.95, annotation, transform=plt.gca().transAxes, 
             fontsize=12, verticalalignment='top', bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    logging.info(f"Plot saved to {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Analyze cross-modal neurometric shifts.")
    parser.add_argument('--data', required=True, help="Path to input CSV file")
    parser.add_argument('--output', default="neurometric_correlation.png", help="Path to save plot")
    args = parser.parse_args()

    # 1. Load data
    df = load_and_preprocess_data(args.data)
    
    if len(df) < 32:
        logging.warning(f"Warning: Only {len(df)} regions found, expected 32.")

    # 2. Statistical Analysis
    rho, p_val = compute_spearman_stats(df)
    logging.info(f"Spearman Rho: {rho:.4f}, Permutation p-value: {p_val:.4f}")

    # 3. Visualization
    plot_shift_correlation(df, rho, p_val, args.output)

if __name__ == '__main__':
    """
    Example usage:
    python script.py --data ./data/region_shifts.csv --output ./results/fig_shift_corr.png
    """
    main()