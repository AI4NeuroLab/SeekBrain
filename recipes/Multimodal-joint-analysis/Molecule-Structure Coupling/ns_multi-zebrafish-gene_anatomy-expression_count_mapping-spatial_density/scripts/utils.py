"""
Utility module for EASI-FISH spatial analysis pipelines.
"""
import pandas as pd
import json
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def load_data(counts_path, atlas_path):
    """Loads and validates input datasets."""
    if not os.path.exists(counts_path) or not os.path.exists(atlas_path):
        raise FileNotFoundError("Input count or atlas files missing.")
    
    counts = pd.read_csv(counts_path, index_col=0)
    atlas = pd.read_csv(atlas_path)
    return counts, atlas

def classify_cells(df, threshold=3, genes=None):
    """
    Classifies neurons based on gene count thresholds.
    """
    if genes is None:
        genes = ['eomesa', 'pvalb7']
    
    logger.info(f"Classifying cells with threshold: {threshold}")
    
    for gene in genes:
        if gene not in df.columns:
            raise ValueError(f"Missing '{gene}' column in count matrix.")
        df[f'{gene}_pos'] = df[gene] > threshold
        
    df['co_expressed'] = df['eomesa_pos'] & df['pvalb7_pos']
    return df

def generate_spatial_mapping(df, atlas):
    """Integrates binary classification with spatial atlas metadata."""
    return df.merge(atlas, left_index=True, right_on='cell_id')

def save_outputs(data, out_dir, filename="classified_neurons.parquet"):
    """Saves analytical outputs and generated summaries to disk."""
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    data.to_parquet(out_path / filename)
    
    summary = {
        "eomesa_count": int(data['eomesa_pos'].sum()),
        "pvalb7_count": int(data['pvalb7_pos'].sum()),
        "co_expr_count": int(data['co_expressed'].sum())
    }
    
    with open(out_path / "summary.json", 'w') as f:
        json.dump(summary, f, indent=4)
        
    logger.info(f"Outputs saved to {out_dir}")