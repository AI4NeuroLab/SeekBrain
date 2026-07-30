"""
Utility functions for Cell-Type Temporal Dynamics analysis.
"""
import logging
import pandas as pd
import matplotlib.pyplot as plt
import os

logger = logging.getLogger(__name__)

def downsample_data(adata, target_n=None):
    """Equalize cell counts per time point."""
    if target_n is None:
        target_n = adata.obs['age'].value_counts().min()
        logger.info(f"Targeting {target_n} cells per stage based on min count.")
    
    subset_list = []
    for stage, group in adata.obs.groupby('age'):
        if len(group) >= target_n:
            subset_list.append(group.sample(n=target_n, random_state=42))
        else:
            logger.warning(f"Stage {stage} has fewer cells ({len(group)}) than target.")
    
    return adata[pd.concat(subset_list).index].copy()

def compute_taxonomic_metrics(adata, mapping_df):
    """Map subclusters to parents and aggregate counts."""
    obs = adata.obs.merge(mapping_df, on='subcluster_id', how='left')
    
    missing = obs['parent_cluster_id'].isna().sum()
    if missing > 0:
        logger.warning(f"{missing} subclusters failed to map to a parent.")
    
    return obs.groupby(['age', 'parent_cluster_id'])['subcluster_id'].nunique().unstack(fill_value=0)

def calculate_volatility(stats_df):
    """Quantifies cluster composition changes (1 - Jaccard)."""
    volatility = {}
    stages = stats_df.index
    for i in range(len(stages) - 1):
        s1 = stats_df.loc[stages[i]]
        s2 = stats_df.loc[stages[i+1]]
        # Use set of columns (clusters) that have non-zero counts in that stage
        c1 = set(s1[s1 > 0].index)
        c2 = set(s2[s2 > 0].index)
        union = c1.union(c2)
        intersection = c1.intersection(c2)
        volatility[stages[i+1]] = 1 - (len(intersection) / len(union))
    return pd.Series(volatility)

def plot_dynamics(stats, output_dir):
    """Visualize temporal cluster emergence."""
    plt.figure(figsize=(10, 6))
    stats.plot(kind='area', stacked=True, alpha=0.7)
    plt.title("Temporal Dynamics of Subcluster Emergence")
    plt.ylabel("Number of Subclusters")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "cluster_dynamics.png"))
    logger.info(f"Plot saved to {output_dir}")