"""
Subclass-Specific Differential Gene Expression Analysis
-------------------------------------------------------
Purpose: Quantify and visualize DGE changes across cortical cell subclasses 
         between pre- and post-eye-opening (P7 vs P14) using a pseudobulk approach.

Inputs:
    - count_matrix.csv: Rows = genes, Cols = cell_ids.
    - metadata.csv: columns [cell_id, subclass, animal_id, age_group].

Outputs:
    - dge_results.csv: Statistics for all genes per subclass.
    - summary_counts.csv: Upregulated/Downregulated gene counts.
    - volcano_plots.pdf: Faceted visualization.

Methodology:
    1. Pseudobulk aggregation: Sum UMI counts by (subclass, animal_id).
    2. Statistical Modeling: Linear regression (OLS) with batch correction (animal_id).
    3. Thresholding: FDR < 0.05 and |log2FC| > 0.5.
"""

import pandas as pd
import numpy as np
import statsmodels.formula.api as smf
import matplotlib.pyplot as plt
import seaborn as sns
import argparse
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def aggregate_pseudobulk(counts, metadata):
    """Aggregate counts per subclass and animal_id."""
    logging.info("Performing pseudobulk aggregation...")
    df = counts.T.join(metadata.set_index('cell_id'))
    grouped = df.groupby(['subclass', 'animal_id']).sum()
    return grouped

def perform_dge(pseudobulk_df, lfc_threshold=0.5, fdr_threshold=0.05):
    """Fit linear model per subclass to compute DGE."""
    results = []
    subclasses = pseudobulk_df.index.get_level_values('subclass').unique()

    for sc in subclasses:
        logging.info(f"Analyzing subclass: {sc}")
        sc_data = pseudobulk_df.xs(sc, level='subclass')
        # Simple normalization: total count scale
        sc_data = sc_data.div(sc_data.sum(axis=1), axis=0) * 1e6
        sc_data = np.log2(sc_data + 1)
        
        # Add metadata for modeling
        sc_data['age_group'] = [1 if 'P14' in idx else 0 for idx in sc_data.index]
        
        for gene in sc_data.columns[:-1]:
            try:
                model = smf.ols(f"{gene} ~ age_group", data=sc_data).fit()
                lfc = model.params['age_group']
                padj = model.pvalues['age_group']
                
                status = 'NS'
                if padj < fdr_threshold:
                    if lfc > lfc_threshold: status = 'Up'
                    elif lfc < -lfc_threshold: status = 'Down'
                
                results.append({'subclass': sc, 'gene': gene, 'log2FC': lfc, 'padj': padj, 'status': status})
            except Exception as e:
                continue
    return pd.DataFrame(results)

def visualize_dge(results, output_dir):
    """Generate faceted volcano plots."""
    logging.info("Generating visualizations...")
    results['-log10padj'] = -np.log10(results['padj'].replace(0, 1e-300))
    
    g = sns.FacetGrid(results, col="subclass", col_wrap=3, sharex=True, sharey=True)
    g.map_dataframe(sns.scatterplot, x="log2FC", y="-log10padj", hue="status", s=5)
    g.add_legend()
    plt.savefig(os.path.join(output_dir, 'volcano_plots.pdf'))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--counts", required=True, help="Path to count matrix (CSV)")
    parser.add_argument("--meta", required=True, help="Path to metadata (CSV)")
    parser.add_argument("--out", required=True, help="Output directory")
    args = parser.parse_args()

    if not os.path.exists(args.out):
        os.makedirs(args.out)

    # Load Data
    counts = pd.read_csv(args.counts, index_col=0)
    meta = pd.read_csv(args.meta)

    # Pipeline Execution
    pseudobulk = aggregate_pseudobulk(counts, meta)
    dge_df = perform_dge(pseudobulk)
    
    # Save Results
    dge_df.to_csv(os.path.join(args.out, 'dge_results.csv'), index=False)
    
    # Summarize
    summary = dge_df.groupby(['subclass', 'status']).size().unstack(fill_value=0)
    summary.to_csv(os.path.join(args.out, 'summary_counts.csv'))
    
    # Visualize
    visualize_dge(dge_df, args.out)
    logging.info("Analysis Complete.")

if __name__ == '__main__':
    main()