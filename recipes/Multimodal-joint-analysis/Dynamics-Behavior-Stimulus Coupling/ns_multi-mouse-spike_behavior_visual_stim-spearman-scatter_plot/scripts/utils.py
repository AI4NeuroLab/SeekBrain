"""
Utility functions for neurometric analysis.
"""

import logging
import sys
import numpy as np
import pandas as pd
import scipy.stats as stats
import seaborn as sns
import matplotlib.pyplot as plt

def load_and_preprocess_data(file_path, required_cols={'region', 'ephys_shift', 'wfi_shift'}):
    """Loads experimental data and ensures consistent region formatting."""
    try:
        df = pd.read_csv(file_path)
        if not required_cols.issubset(df.columns):
            raise ValueError(f"CSV must contain columns: {required_cols}")
        return df.dropna()
    except Exception as e:
        logging.error(f"Failed to load data from {file_path}: {e}")
        sys.exit(1)

def compute_spearman_stats(df, col1, col2, iterations=10000):
    """Computes Spearman correlation and permutation-based p-value."""
    rho, _ = stats.spearmanr(df[col1], df[col2])
    
    # Permutation test
    null_rhos = []
    for _ in range(iterations):
        shuffled_col2 = np.random.permutation(df[col2])
        null_rho, _ = stats.spearmanr(df[col1], shuffled_col2)
        null_rhos.append(null_rho)
    
    p_perm = np.sum(np.abs(null_rhos) >= np.abs(rho)) / iterations
    return rho, p_perm

def create_correlation_plot(df, x_col, y_col, rho, p_val, title, output_path):
    """Generates a standardized regplot with statistics."""
    plt.figure(figsize=(8, 6))
    sns.set_style("whitegrid")
    
    sns.regplot(data=df, x=x_col, y=y_col, color='teal', ci=95, 
                scatter_kws={'alpha': 0.7})
    
    plt.title(title)
    plt.xlabel(x_col.replace('_', ' ').title())
    plt.ylabel(y_col.replace('_', ' ').title())
    
    annotation = f"Spearman $\\rho$ = {rho:.3f}\n$p$ (perm) = {p_val:.4f}"
    plt.text(0.05, 0.95, annotation, transform=plt.gca().transAxes, 
             fontsize=12, verticalalignment='top', bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()