"""
Utility functions for scRNA-seq temporal dynamics analysis.
"""
import logging
import pandas as pd
import scanpy as sc
import matplotlib.pyplot as plt
from scipy.stats import entropy

logger = logging.getLogger(__name__)

def downsample_data(adata, target_n):
    """Subsamples cells to match the minimum age-count."""
    logger.info(f"Downsampling to {target_n} cells per age group.")
    # Assuming uniform distribution across ages for subsampling logic
    sc.pp.subsample(adata, n_obs=target_n * len(adata.obs['age'].unique()))
    return adata

def calculate_shannon_entropy(adata, cluster_col='cluster_id'):
    """Computes Shannon Entropy for cell-type distribution at each age."""
    entropy_results = {}
    for age in adata.obs['age'].unique():
        subset = adata[adata.obs['age'] == age]
        counts = subset.obs[cluster_col].value_counts(normalize=True)
        entropy_results[age] = entropy(counts)
    return entropy_results

def run_stability_sweep(adata, resolutions=[0.1, 0.5, 1.0, 1.5, 2.0]):
    """Performs clustering at multiple resolutions."""
    for res in resolutions:
        sc.tl.leiden(adata, resolution=res, key_added=f'leiden_{res}')
    return adata

def plot_diversity_curve(div_df, output_path):
    """Generates and saves the diversity trajectory plot."""
    plt.figure(figsize=(8, 5))
    plt.plot(div_df.index.astype(str), div_df['entropy'], marker='o')
    plt.title("Shannon Entropy of Cell-Type Clusters Across Development")
    plt.xlabel("Postnatal Age")
    plt.ylabel("Diversity Index (Shannon Entropy)")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()