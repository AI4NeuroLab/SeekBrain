"""
Developmental Expression Trajectory Analysis
--------------------------------------------
Purpose: 
    Model and classify the temporal expression of marker genes in mouse visual 
    cortex cell lineages (Excitatory, Inhibitory, Glial) using GAMs.
    
References:
    Methodology aligns with: Di Bella et al., Science 2021 (Trajectory Modeling).
    Input: AnnData object with 'lineage', 'time_point', and gene expression.
    Output: Trend summary table and faceted trajectory visualizations.
"""

import argparse
import logging
import numpy as np
import pandas as pd
import scanpy as sc
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.gam.api import GLMGam, BSplines

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def fit_gam_trend(y, t, k=4):
    """
    Fits a GAM using B-splines to model expression trajectory.
    Corresponds to: Analysis/trajectories/fit_gam.R methodology.
    """
    bs = BSplines(t, df=[k], degree=3)
    gam = GLMGam.from_formula('y ~ 1', data={'y': y}, smoother=bs)
    res = gam.fit()
    # Predict over a fine grid for plotting
    t_grid = np.linspace(t.min(), t.max(), 50)
    pred = gam.predict(data={'y': np.zeros(len(t_grid))}, exog=np.ones((len(t_grid), 1)))
    return t_grid, pred

def classify_trend(t_grid, pred, threshold=0.1):
    """
    Classifies trajectories based on numerical derivative.
    logic: derivative > threshold (Up), < -threshold (Down), 
           sign change (Transient), otherwise Constant.
    """
    deriv = np.gradient(pred, t_grid)
    if np.all(deriv > threshold): return "Up"
    if np.all(deriv < -threshold): return "Down"
    if np.sign(deriv[0]) != np.sign(deriv[-1]) and np.any(np.abs(deriv) > threshold):
        return "Transient"
    return "Constant"

def run_analysis(adata_path, marker_list_path, output_dir):
    """
    Main processing pipeline.
    """
    adata = sc.read_h5ad(adata_path)
    markers = pd.read_csv(marker_list_path)['gene_symbol'].tolist()
    
    results = []
    
    # Process each lineage and gene
    for lineage in adata.obs['lineage'].unique():
        lineage_data = adata[adata.obs['lineage'] == lineage]
        
        for gene in markers:
            if gene not in adata.var_names:
                continue
                
            # Extract and normalize
            expr = lineage_data[:, gene].X.toarray().flatten()
            time = lineage_data.obs['time_point'].astype(float).values
            
            # Fit GAM
            t_grid, pred = fit_gam_trend(expr, time)
            trend = classify_trend(t_grid, pred)
            
            results.append({'gene': gene, 'lineage': lineage, 'trend': trend})
            
            # Plotting
            plt.figure(figsize=(4, 3))
            sns.lineplot(x=t_grid, y=pred)
            plt.title(f"{gene} - {lineage} ({trend})")
            plt.savefig(f"{output_dir}/{lineage}_{gene}_trend.png")
            plt.close()
            
    pd.DataFrame(results).to_csv(f"{output_dir}/trend_summary.csv", index=False)
    logging.info(f"Analysis complete. Outputs saved to {output_dir}")

def main():
    parser = argparse.ArgumentParser(description="Analyze developmental trajectories.")
    parser.add_argument("--data", required=True, help="Path to h5ad file")
    parser.add_argument("--markers", required=True, help="CSV with 'gene_symbol'")
    parser.add_argument("--out", default="./output", help="Output directory")
    args = parser.parse_args()
    
    import os
    if not os.path.exists(args.out):
        os.makedirs(args.out)
        
    try:
        run_analysis(args.data, args.markers, args.out)
    except Exception as e:
        logging.error(f"Analysis failed: {e}")

if __name__ == '__main__':
    main()