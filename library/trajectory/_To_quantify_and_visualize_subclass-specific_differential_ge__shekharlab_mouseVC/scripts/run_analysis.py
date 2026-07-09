#!/usr/bin/env python3
"""
Subclass-specific Differential Gene Expression (DGE) Analysis
across Developmental Windows (Pre vs Post Eye-Opening).

This script performs differential expression analysis on an integrated
cortical cell atlas, quantifying changes between pre-eye-opening (P7-P10)
and post-eye-opening (P14+) developmental windows.

Outputs:
1. Summary CSV: Upregulated/Downregulated gene counts per subclass.
2. Volcano Plot Panels: One per subclass.
3. Summary Dotplot: Global view of top DEGs.
"""

import os
import logging
import argparse
import pandas as pd
import numpy as np
import scanpy as sc
import seaborn as sns
import matplotlib.pyplot as plt

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def perform_dge(adata, subclass, group_col='EO_Window'):
    """Performs Wilcoxon test for a specific subclass."""
    sub_adata = adata[adata.obs['Subclass'] == subclass].copy()
    
    # Validation: Minimum cells required for statistical power
    if sub_adata.n_obs < 50:
        logger.warning(f"Subclass {subclass} has {sub_adata.n_obs} cells. Skipping.")
        return None

    sc.tl.rank_genes_groups(sub_adata, groupby=group_col, reference='Pre', method='wilcoxon')
    
    # Extract results as DataFrame
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

def plot_volcano(de_df, subclass, out_dir):
    """Generates a volcano plot for the subclass."""
    plt.figure(figsize=(6, 5))
    de_df['sig'] = (de_df['pvals_adj'] < 0.05) & (de_df['logfoldchanges'].abs() > 0.5)
    sns.scatterplot(data=de_df, x='logfoldchanges', y=-np.log10(de_df['pvals_adj']), 
                    hue='sig', palette={False: 'gray', True: 'red'}, s=10)
    plt.title(f"Volcano Plot: {subclass}")
    plt.xlabel("log2 Fold Change")
    plt.ylabel("-log10(adj P-value)")
    plt.savefig(os.path.join(out_dir, f"volcano_{subclass}.png"))
    plt.close()

def main(args):
    # Load Data
    logger.info(f"Loading data from {args.input_path}")
    adata = sc.read_h5ad(args.input_path)
    
    # Step 1: Metadata Preparation
    # Mapping Age: Pre (P7-P10), Post (P14+)
    adata.obs['EO_Window'] = adata.obs['Age'].apply(lambda x: 'Pre' if int(x) <= 10 else 'Post')
    
    results_summary = []
    all_de_dfs = []
    
    # Step 2: Iterative DGE
    for subclass in adata.obs['Subclass'].unique():
        logger.info(f"Processing Subclass: {subclass}")
        de_df = perform_dge(adata, subclass)
        
        if de_df is not None:
            stats = summarize_degs(de_df)
            stats['Subclass'] = subclass
            results_summary.append(stats)
            all_de_dfs.append(de_df)
            
            # Visualization
            plot_volcano(de_df, subclass, args.output_dir)
            
    # Save Summary
    summary_df = pd.DataFrame(results_summary)
    summary_df.to_csv(os.path.join(args.output_dir, "dge_summary.csv"), index=False)
    
    # Final global dotplot (Top 5 up/down per subclass)
    combined_de = pd.concat(all_de_dfs)
    top_genes = combined_de.groupby('Subclass').apply(lambda x: x.nlargest(5, 'logfoldchanges')).index.get_level_values(1)
    
    plt.figure(figsize=(10, 8))
    sc.pl.dotplot(adata, top_genes.unique().tolist(), groupby='Subclass', color='EO_Window')
    logger.info("Analysis complete.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Subclass-specific DGE analysis.")
    parser.add_argument('--input_path', type=str, required=True, help="Path to AnnData .h5ad file.")
    parser.add_argument('--output_dir', type=str, default="./results", help="Directory for outputs.")
    
    args = parser.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    
    main(args)