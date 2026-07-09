"""
Script: subclass_dge_analysis.py
Description: Performs subclass-specific differential gene expression (DGE) analysis
             across two developmental bins (P7-P10 vs P11-P15) in mouse cortex.

Workflow:
1. Load single-cell expression data and metadata.
2. Filter cells based on QC metrics (nCount_RNA, nFeature_RNA).
3. Normalize data via library size correction.
4. Perform Wilcoxon rank-sum test for each subclass.
5. Visualize results (Volcano plots and DGE counts).

Dependencies: scanpy, pandas, matplotlib, seaborn, numpy
"""

import scanpy as sc
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import argparse
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_and_filter_data(filepath, min_genes=200, min_cells=3):
    """Loads h5ad data and applies standard QC filtering."""
    logger.info(f"Loading data from {filepath}")
    adata = sc.read_h5ad(filepath)
    
    # QC Filtering
    sc.pp.filter_cells(adata, min_genes=min_genes)
    sc.pp.filter_genes(adata, min_cells=min_cells)
    
    # Normalization
    sc.pp.normalize_total(adata, target_sum=1e4)
    sc.pp.log1p(adata)
    
    return adata

def perform_dge(adata, output_dir):
    """Performs DGE analysis per subclass and saves results."""
    subclasses = adata.obs['cell_subclass'].unique()
    dge_results = []
    
    os.makedirs(output_dir, exist_ok=True)
    
    for subclass in subclasses:
        logger.info(f"Analyzing subclass: {subclass}")
        sub_adata = adata[adata.obs['cell_subclass'] == subclass].copy()
        
        # Check if enough cells exist in both age bins
        if len(sub_adata.obs['age_bin'].unique()) < 2:
            logger.warning(f"Skipping {subclass}: Insufficient age bins.")
            continue
            
        sc.tl.rank_genes_groups(
            sub_adata, 
            groupby='age_bin', 
            reference='P7-P10', 
            groups=['P11-P15'],
            method='wilcoxon'
        )
        
        res = sc.get.rank_genes_groups_df(sub_adata, group='P11-P15')
        res['subclass'] = subclass
        dge_results.append(res)
        
    return pd.concat(dge_results)

def visualize_dge(df, output_dir):
    """Generates a summary bar plot and volcano plot facets."""
    # 1. Quantification Summary
    df['Direction'] = np.where(df['logfoldchanges'] > 0.5, 'Up', 
                               np.where(df['logfoldchanges'] < -0.5, 'Down', 'NS'))
    
    summary = df[df['pvals_adj'] < 0.05].groupby(['subclass', 'Direction']).size().unstack(fill_value=0)
    summary.plot(kind='bar', stacked=True, figsize=(10, 6))
    plt.title("Number of Significant Genes per Subclass")
    plt.savefig(os.path.join(output_dir, "dge_summary.png"))
    
    # 2. Volcano Plot Snippet
    g = sns.FacetGrid(df, col="subclass", col_wrap=3, sharex=False, sharey=False)
    g.map(sns.scatterplot, "logfoldchanges", "pvals_adj", alpha=0.5)
    plt.savefig(os.path.join(output_dir, "volcano_plots.png"))
    logger.info(f"Visualizations saved to {output_dir}")

def main():
    parser = argparse.ArgumentParser(description="Subclass-specific DGE analysis.")
    parser.add_argument("--data", required=True, help="Path to .h5ad single-cell file")
    parser.add_argument("--out", default="./output", help="Output directory")
    args = parser.parse_args()

    # Execution
    adata = load_and_filter_data(args.data)
    dge_df = perform_dge(adata, args.out)
    
    # Export stats
    dge_df.to_csv(os.path.join(args.out, "dge_results.csv"), index=False)
    visualize_dge(dge_df, args.out)
    logger.info("Analysis complete.")

if __name__ == '__main__':
    main()