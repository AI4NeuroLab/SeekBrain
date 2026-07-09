"""
Utility functions for IBL neurological data analysis.
Includes wrappers for API interactions, statistical corrections, and regional plotting helpers.
"""

import logging
import numpy as np
from statsmodels.stats.multitest import multipletests
from iblatlas.regions import BrainRegions

logger = logging.getLogger(__name__)

def apply_fdr_correction(p_values, alpha=0.01):
    """
    Applies Benjamini-Hochberg FDR correction.
    
    Args:
        p_values (np.ndarray): Array of p-values.
        alpha (float): Significance threshold.
    Returns:
        tuple: (reject_mask, corrected_p_values)
    """
    reject, p_fdr, _, _ = multipletests(p_values, alpha=alpha, method='fdr_bh')
    return reject, p_fdr

def filter_regions(df, min_neurons=20, min_sessions=2):
    """
    Filters regional data based on quality metrics.
    
    Args:
        df (pd.DataFrame): DataFrame containing 'beryl_id', 'session_id', 'neuron_id'.
    Returns:
        pd.DataFrame: Filtered subset.
    """
    counts = df.groupby('beryl_id').agg(
        n_neurons=('neuron_id', 'nunique'),
        n_sessions=('session_id', 'nunique')
    )
    valid_ids = counts[(counts['n_neurons'] >= min_neurons) & 
                       (counts['n_sessions'] >= min_sessions)].index
    return df[df['beryl_id'].isin(valid_ids)]

def initialize_region_map(fill_value=np.nan):
    """Initializes an array representing all Beryl regions."""
    br = BrainRegions()
    return np.full(len(br.id), fill_value)

def format_plot_metadata(ax, sig_count, total_count):
    """Adds standardized metadata text to the plot."""
    ax.text(0.8, 0.95, f"Significant Regions / Total Analyzed: {sig_count}/{total_count}",
            transform=ax.transAxes, fontsize=10, bbox=dict(facecolor='white', alpha=0.5))