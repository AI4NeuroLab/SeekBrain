"""
Utility functions for neural imaging analysis.
"""
import numpy as np
import pandas as pd
from astropy.stats import circular_var

def compute_encoding_accuracy(phase_epg, head_dir):
    """Computes accuracy as 1 - circular variance of the offset."""
    diff = np.mod(phase_epg - head_dir, 2 * np.pi)
    circ_var = circular_var(diff)
    return 1.0 - circ_var

def process_fly_data(df, v_threshold=0.1):
    """Processes per-fly data into aggregate metrics."""
    # Filter Movement
    df_mov = df[df['velocity'] > v_threshold]
    
    if len(df_mov) < 100:
        return None
    
    # Compute Metrics
    accuracy = compute_encoding_accuracy(df_mov['bump_phase'], df_mov['head_dir'])
    mean_width = df_mov['bump_width'].mean()
    
    return pd.Series({'encoding_accuracy': accuracy, 'mean_bump_width': mean_width})