"""
Utility functions for single-cell Differential Expression Analysis.
"""
import os
import logging
import pandas as pd
import numpy as np
import scanpy as sc
import seaborn as sns
import matplotlib.pyplot as plt

logger = logging.getLogger(__name__)

def perform_dge(adata, subclass, group_col='EO_Window', min_cells=50):
    """Performs Wilcoxon test for a specific subclass."""
    sub_adata = adata[adata.obs['Subclass'] == subclass].copy()
    
    if sub_adata.n_obs < min_cells:
        logger.warning(f"Subclass {subclass} has {sub_adata.n_obs} cells. Skipping.")
        return None

    sc.tl.rank_genes_groups(sub_adata, groupby=group_col, reference='Pre', method='wilcoxon')
    de_df = sc.get.rank_genes_groups_df(sub_adata, group='Post')
    de_df['Subclass'] = subclass
    return de_df

def summarize_degs(de_df, fc_thresh=0.5, p_thresh=0.05):
    """Summarizes counts of up/downregulated genes."""
    up = de_df[(de_df['logfoldchanges'] > fc_thresh) & (de_df['pvals_adj'] < p_thresh)]
    down = de_df[(de_df['logfoldchanges'] < -fc_thresh) & (de_df['pvals_adj'] < p_thresh)]
    
    return {
        'Upregulated_Count': len(up),
        'Downregulated_Count': len(down),
        'Total_DEGs': len(up) + len(down)
    }

def plot_volcano(de_df, subclass, out_dir, fc_thresh=0.5, p_thresh=0.05):
    """Generates a volcano plot for the subclass."""
    plt.figure(figsize=(6, 5))
    de_df['sig'] = (de_df['pvals_adj'] < p_thresh) & (de_df['logfoldchanges'].abs() > fc_thresh)
    sns.scatterplot(data=de_df, x='logfoldchanges', y=-np.log10(de_df['pvals_adj']), 
                    hue='sig', palette={False: 'gray', True: 'red'}, s=10)
    plt.title(f"Volcano Plot: {subclass}")
    plt.xlabel("log2 Fold Change")
    plt.ylabel("-log10(adj P-value)")
    plt.savefig(os.path.join(out_dir, f"volcano_{subclass}.png"))
    plt.close()