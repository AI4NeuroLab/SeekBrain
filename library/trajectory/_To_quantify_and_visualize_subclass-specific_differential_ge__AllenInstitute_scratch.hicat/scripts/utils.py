"""
Utility module for gene expression analysis tasks.
"""
import pandas as pd
import numpy as np
import statsmodels.formula.api as smf
import logging

def aggregate_pseudobulk(counts, metadata):
    """Aggregate counts per subclass and animal_id."""
    logging.info("Performing pseudobulk aggregation...")
    # Ensure indices align correctly
    df = counts.T.join(metadata.set_index('cell_id'))
    grouped = df.groupby(['subclass', 'animal_id']).sum()
    return grouped

def normalize_log_counts(df):
    """Apply CPM normalization and log2 transformation."""
    cpm = df.div(df.sum(axis=1), axis=0) * 1e6
    return np.log2(cpm + 1)

def run_linear_model(data, formula, target_col):
    """
    Fits an OLS model to a dataframe and returns params and p-values.
    Expects data columns to be genes and one predictor column.
    """
    results = {}
    for gene in data.columns.drop(target_col, errors='ignore'):
        try:
            model = smf.ols(f"{gene} ~ {target_col}", data=data).fit()
            results[gene] = {
                'log2FC': model.params[target_col],
                'padj': model.pvalues[target_col]
            }
        except Exception:
            continue
    return pd.DataFrame.from_dict(results, orient='index')

def classify_dge(df, lfc_threshold=0.5, fdr_threshold=0.05):
    """Assign status based on thresholds."""
    df['status'] = 'NS'
    up = (df['padj'] < fdr_threshold) & (df['log2FC'] > lfc_threshold)
    down = (df['padj'] < fdr_threshold) & (df['log2FC'] < -lfc_threshold)
    df.loc[up, 'status'] = 'Up'
    df.loc[down, 'status'] = 'Down'
    return df