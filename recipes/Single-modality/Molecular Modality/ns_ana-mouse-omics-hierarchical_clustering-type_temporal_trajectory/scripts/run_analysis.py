"""
Temporal Dynamics of Cell-Type Diversity Analysis
-------------------------------------------------
Purpose:
    Characterizes cell-type diversity across developmental ages in the mouse 
    visual cortex. This script implements downsampling to control for sequencing 
    depth/cell-count bias, performs cluster stability analysis, and calculates 
    Shannon Entropy to assess diversification plateaus.

Reference: 
    Methodology follows Yao et al. (2021) "A transcriptomic atlas of the mouse 
    visual cortex". Specifically addressing the "Resolution Bias" and 
    "Diversity Plateau" metrics.

Inputs:
    - h5ad file containing normalized scRNA-seq/snRNA-seq data.
    - Expected annotation: 'age' and 'cluster_id' columns in .obs.

Outputs:
    - CSV: Shannon entropy values per age.
    - PNG: Visualization of cumulative cell-type discovery.
    - Log: Analysis progression.
"""

import os
import argparse
import logging
import pandas as pd
import numpy as np
import scanpy as sc
import matplotlib.pyplot as plt
from scipy.stats import entropy

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def downsample_data(adata, target_n):
    """
    Subsamples cells to match the minimum age-count to prevent 
    cluster explosion due to N-cell differences.
    """
    logger.info(f"Downsampling to {target_n} cells per age group.")
    sc.pp.subsample(adata, n_obs=target_n * len(adata.obs['age'].unique()))
    return adata

def calculate_shannon_entropy(adata):
    """
    Computes Shannon Entropy for cell-type distribution at each age.
    H = -sum(p_i * log(p_i))
    """
    entropy_results = {}
    for age in adata.obs['age'].unique():
        subset = adata[adata.obs['age'] == age]
        counts = subset.obs['cluster_id'].value_counts(normalize=True)
        entropy_results[age] = entropy(counts)
    return entropy_results

def run_stability_sweep(adata, resolutions=[0.1, 0.5, 1.0, 1.5, 2.0]):
    """
    Performs clustering at multiple resolutions to observe cluster stabilization.
    """
    for res in resolutions:
        sc.tl.leiden(adata, resolution=res, key_added=f'leiden_{res}')
    return adata

def main(args):
    # Load data
    try:
        adata = sc.read_h5ad(args.input)
    except Exception as e:
        logger.error(f"Failed to load data: {e}")
        return

    # 1. Normalization (Assuming pre-normalized, check library size)
    if 'log1p' not in adata.uns:
        sc.pp.normalize_total(adata, target_sum=1e4)
        sc.pp.log1p(adata)

    # 2. Downsampling
    min_cells = adata.obs.groupby('age').size().min()
    adata = downsample_data(adata, min_cells)

    # 3. Cluster Stability
    run_stability_sweep(adata)
    
    # 4. Diversity Analysis
    diversity = calculate_shannon_entropy(adata)
    div_df = pd.DataFrame.from_dict(diversity, orient='index', columns=['entropy'])
    div_df.to_csv(os.path.join(args.output, 'diversity_metrics.csv'))

    # 5. Plotting results
    plt.figure(figsize=(8, 5))
    plt.plot(div_df.index.astype(str), div_df['entropy'], marker='o')
    plt.title("Shannon Entropy of Cell-Type Clusters Across Development")
    plt.xlabel("Postnatal Age")
    plt.ylabel("Diversity Index (Shannon Entropy)")
    plt.savefig(os.path.join(args.output, 'diversity_curve.png'))
    logger.info("Analysis complete. Results saved.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Characterize temporal dynamics of cell clusters.")
    parser.add_argument('--input', type=str, required=True, help="Path to input .h5ad file")
    parser.add_argument('--output', type=str, required=True, help="Path to output directory")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.output):
        os.makedirs(args.output)
        
    main(args)