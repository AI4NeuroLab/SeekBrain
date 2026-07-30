"""
Utility module for behavioral and neural data processing in chemogenetic studies.
"""
import logging
import numpy as np
import pandas as pd
from oasis.functions import deconvolve
from scipy.stats import ttest_ind

logger = logging.getLogger(__name__)

def perform_deconvolution(raw_traces, penalty=1):
    """
    Apply OASIS deconvolution to fluorescence traces to infer spike probability.
    
    Args:
        raw_traces (np.ndarray): 2D array of raw dF/F traces (neurons x time).
        penalty (int): L1 sparsity penalty for deconvolution.
    Returns:
        np.ndarray: Deconvolved spike trains.
    """
    logger.info("Deconvolving neural signals using OASIS...")
    spike_trains = []
    for trace in raw_traces:
        c, s, b, g, lam = deconvolve(trace, penalty=penalty)
        spike_trains.append(s)
    return np.array(spike_trains)

def compute_behavioral_metrics(df, window_size=20):
    """
    Calculate rolling accuracy and epoch-based statistics.
    
    Args:
        df (pd.DataFrame): Behavioral log containing 'outcome' and 'cno_status'.
        window_size (int): Smoothing window for rolling accuracy.
    Returns:
        pd.DataFrame: Aggregated performance metrics by epoch.
    """
    df['rolling_acc'] = df['outcome'].rolling(window=window_size).mean()
    return df.groupby('cno_status')['outcome'].agg(['mean', 'std', 'count'])

def test_reversibility(group_a, group_b):
    """
    Perform independent t-test to check for statistical recovery.
    """
    t_stat, p_val = ttest_ind(group_a, group_b)
    return p_val

def save_plot(plt, path):
    """Generic helper to save plots."""
    plt.savefig(path)
    logger.info(f"Plot saved to {path}")