"""
utils.py
Helper functions for BWM stimulus modulation analysis.
"""

import pandas as pd
import numpy as np
from one.api import ONE
from iblatlas.regions import BrainRegions

def load_session_data(one: ONE, eid: str, probe='probe00'):
    """Loads required objects for a BWM session."""
    trials = one.load_object(eid, 'trials', collection='alf')
    spikes = one.load_object(eid, 'spikes', collection=f'alf/{probe}')
    clusters = one.load_object(eid, 'clusters', collection=f'alf/{probe}')
    return trials, spikes, clusters

def get_good_unit_mask(clusters):
    """Filters units based on BWM labeling criteria."""
    return clusters['metrics']['label'] >= 1

def map_clusters_to_regions(clusters, br=None):
    """Maps CCF IDs to Beryl-level acronyms."""
    br = br or BrainRegions()
    region_ids = clusters['channels']['brainLocationIds_ccf_2017']
    return br.id2acronym(region_ids)

def apply_fdr_correction(p_values, alpha=0.01):
    """Wrapper for Benjamini-Hochberg correction."""
    from statsmodels.stats.multitest import multipletests
    _, p_adj, _, _ = multipletests(p_values, alpha=alpha, method='fdr_bh')
    return p_adj, p_adj < alpha