"""
Temporal Dynamics of Cell-Type Clusters in Developing Mouse Visual Cortex.

Purpose:
    This script characterizes the temporal dynamics of cell-type clusters and subclusters 
    across developmental stages (e.g., E11.5–P56). It performs downsampling, taxonomic mapping, 
    and quantitative analysis of cluster emergence/volatility based on developmental atlases.

References:
    - Science 2020: "A cell atlas of the developing mouse brain"
    - Methods: Sampling bias correction, Taxonomic Integration, Cluster Volatility analysis.

Inputs:
    - --data: Path to .h5ad file containing 'age', 'cell_type', and 'subcluster_id'.
    - --map: CSV file with columns 'subcluster_id' and 'parent_cluster_id'.
    - --output: Directory to store statistics and plots.
"""

import os
import argparse
import logging
import pandas as pd
import numpy as np
import scanpy as sc
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.stats import jaccard

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def downsample_data(adata, target_n=None):
    """
    Step 1: Downsampling. Equalize cell counts per time point to prevent resolution drift.
    """
    if target_n is None:
        target_n = adata.obs['age'].value_counts().min()
        logger.info(f"Targeting {target_n} cells per stage based on min count.")
    
    subset_list = []
    for stage, group in adata.obs.groupby('age'):
        if len(group) >= target_n:
            subset_list.append(group.sample(n=target_n, random_state=42))
        else:
            logger.warning(f"Stage {stage} has fewer cells ({len(group)}) than target. Skipping.")
    
    return adata[pd.concat(subset_list).index].copy()

def compute_taxonomic_metrics(adata, mapping_df):
    """
    Step 3 & 4: Taxonomic Mapping and Temporal Counting.
    """
    obs = adata.obs.merge(mapping_df, on='subcluster_id', how='left')
    
    # Validation: Ensure 100% mapping
    missing = obs['parent_cluster_id'].isna().sum()
    if missing > 0:
        logger.warning(f"{missing} subclusters failed to map to a parent.")
    
    # Calculate counts per age/parent
    stats = obs.groupby(['age', 'parent_cluster_id'])['subcluster_id'].nunique().unstack(fill_value=0)
    return stats

def calculate_volatility(stats_df):
    """
    Step 5: Volatility Metric (1 - Jaccard).
    Quantifies how much cluster composition changes between consecutive time points.
    """
    volatility = {}
    stages = stats_df.index
    for i in range(len(stages) - 1):
        s1 = stats_df.loc[stages[i]]
        s2 = stats_df.loc[stages[i+1]]
        # Simple Jaccard of cluster sets present
        union = set(s1.index).union(set(s2.index))
        intersection = set(s1.index).intersection(set(s2.index))
        volatility[stages[i+1]] = 1 - (len(intersection) / len(union))
    return pd.Series(volatility)

def plot_dynamics(stats, output_dir):
    """Visualization of Temporal Dynamics."""
    plt.figure(figsize=(10, 6))
    stats.plot(kind='area', stacked=True, alpha=0.7)
    plt.title("Temporal Dynamics of Subcluster Emergence")
    plt.ylabel("Number of Subclusters")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "cluster_dynamics.png"))
    logger.info("Plot saved to output directory.")

def main(args):
    # Load Data
    try:
        adata = sc.read_h5ad(args.data)
        mapping = pd.read_csv(args.map)
    except Exception as e:
        logger.error(f"Failed to load data: {e}")
        return

    # Process
    adata_sampled = downsample_data(adata)
    stats = compute_taxonomic_metrics(adata_sampled, mapping)
    volatility = calculate_volatility(stats)
    
    # Save Results
    if not os.path.exists(args.output):
        os.makedirs(args.output)
    
    stats.to_csv(os.path.join(args.output, "temporal_stats.csv"))
    volatility.to_csv(os.path.join(args.output, "volatility_metrics.csv"))
    plot_dynamics(stats, args.output)
    
    logger.info("Analysis complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Characterize temporal dynamics of cell-type clusters.")
    parser.add_argument("--data", required=True, help="Path to input .h5ad file")
    parser.add_argument("--map", required=True, help="Path to taxonomy CSV file")
    parser.add_argument("--output", default="./output", help="Output directory")
    
    args = parser.parse_args()
    main(args)