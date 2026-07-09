"""
Utilities for Brain-wide Stimulus Encoding Analysis.
Contains data processing, statistical methods, and shared configuration.
"""

import pandas as pd
import numpy as np
from scipy.stats import mannwhitneyu
from statsmodels.stats.multitest import multipletests
import logging

logger = logging.getLogger(__name__)

def load_ibl_data(data_path):
    """Placeholder for ONE API loading logic."""
    logger.info(f"Loading IBL data from {data_path}...")
    return pd.DataFrame() 

def compute_mann_whitney(df, alpha=0.01):
    """
    Computes FDR-corrected p-values for stimulus modulation per region.
    """
    # Placeholder logic
    return {}

def compute_trajectory_dist(df):
    """Computes Euclidean distance between stimulus conditions."""
    return {}

def compute_latency(df, max_dist_dict, threshold=0.7):
    """Calculates latency to reach a threshold of peak distance."""
    return {}

def compute_glm_improvement(df):
    """Calculates model fit improvement (delta R^2)."""
    return {}

def filter_regions(df, min_neurons=20, min_sessions=2):
    """Filters data for robust regional analysis."""
    region_counts = df.groupby('region_id').agg({'neuron_id': 'nunique', 'session_id': 'nunique'})
    valid_regions = region_counts[(region_counts.neuron_id >= min_neurons) & 
                                 (region_counts.session_id >= min_sessions)]
    return df[df['region_id'].isin(valid_regions.index)]