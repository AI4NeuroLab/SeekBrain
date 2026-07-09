"""
Utility module for single-cell DGE analysis workflows.
"""
import scanpy as sc
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os
import logging

logger = logging.getLogger(__name__)

def load_and_filter_data(filepath, min_genes=200, min_cells=3):
    """Loads h5ad data and applies standard QC filtering and normalization."""
    logger.info(f"Loading data from {filepath}")
    adata = sc.read_h5ad(filepath)
    
    sc.pp.filter_cells(adata, min_genes=min_genes)
    sc.pp.filter_genes(adata, min_cells=min_cells)
    
    sc.pp.normalize_total(adata, target_sum=1e4)
    sc.pp.log1p(adata)
    
    return adata

def run_wilcoxon_dge(adata, groupby, reference, groups):
    """Executes Wilcoxon rank-sum test and returns a dataframe."""
    sc.tl.rank_genes_groups(
        adata, 
        groupby=groupby, 
        reference=reference, 
        groups=groups,
        method='wilcoxon'
    )
    return sc.get.rank_genes_groups_df(adata, group=groups[0])

def plot_dge_summary(df, output_path, lfc_thresh=0.5, p_thresh=0.05):
    """Generates bar plots for DGE counts and volcano grid for results."""
    # Annotate direction
    df['Direction'] = np.where(df['logfoldchanges'] > lfc_thresh, 'Up', 
                               np.where(df['logfoldchanges'] < -lfc_thresh, 'Down', 'NS'))
    
    # Bar plot
    summary = df[df['pvals_adj'] < p_thresh].groupby(['subclass', 'Direction']).size().unstack(fill_value=0)
    summary.plot(kind='bar', stacked=True, figsize=(10, 6))
    plt.title("Significant Genes per Subclass")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()

def plot_volcano_facets(df, output_path):
    """Generates a faceted volcano plot."""
    g = sns.FacetGrid(df, col="subclass", col_wrap=3, sharex=False, sharey=False)
    # Transforming p-vals for visualization if needed, here plotting raw
    g.map(sns.scatterplot, "logfoldchanges", "pvals_adj", alpha=0.5)
    plt.savefig(output_path)
    plt.close()