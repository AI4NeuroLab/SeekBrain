"""
Utility module for IBL BWM Stimulus Modulation Analysis.
Contains helpers for data fetching, spike processing, and statistical testing.
"""

import numpy as np
import pandas as pd
import scipy.stats as ss
import logging

logger = logging.getLogger(__name__)

def load_session_data(one, eid, collection='alf/probe00'):
    """Load spike data and trial tables for a specific session."""
    try:
        trials = one.load_object(eid, 'trials', collection='alf')
        spikes = one.load_object(eid, 'spikes', collection=collection)
        clusters = one.load_object(eid, 'clusters', collection=collection)
        return trials, spikes, clusters
    except Exception as e:
        logger.error(f"Failed to load session {eid}: {e}")
        return None, None, None

def get_firing_rates(spike_times, event_times, window=(0, 0.1)):
    """Calculate firing rates in a specific post-event window."""
    frs = []
    for t in event_times:
        count = np.sum((spike_times >= t + window[0]) & (spike_times <= t + window[1]))
        frs.append(count / (window[1] - window[0]))
    return np.array(frs)

def perform_mann_whitney(frs_a, frs_b, min_n=5):
    """Run MWU test if sample sizes are sufficient."""
    if len(frs_a) < min_n or len(frs_b) < min_n:
        return np.nan
    _, p_val = ss.mannwhitneyu(frs_a, frs_b)
    return p_val

def aggregate_region_stats(df, p_threshold=0.05):
    """Calculate significant fraction per region."""
    region_stats = []
    for reg, group in df.groupby('acronym'):
        if len(group) >= 5:
            p_vals = group['p_val'].dropna().values
            sig_frac = np.mean(p_vals < p_threshold)
            region_stats.append({'acronym': reg, 'sig_frac': sig_frac, 'p_vals': p_vals})
    return region_stats