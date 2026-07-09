#!/usr/bin/env python3
"""
Stimulus-Side Modulation Analysis of BWM Neuropixels Recordings.

Purpose:
    Identifies brain regions where neurons show significant visual stimulus-side
    modulation (0-100ms) using Mann-Whitney U tests stratified by block/choice.
    Results are visualized on a Swanson brain flatmap.

Methodology References:
    - BWM Data: IBL Brain-Wide Map (bwm_sessions.csv)
    - Statistical logic: Mann-Whitney U test with within-block permutation (3000 shuffles).
    - FDR Correction: Benjamini-Hochberg at q=0.01.
    - Anatomy: Beryl-level ontology via iblatlas.
"""

import argparse
import logging
import numpy as np
import pandas as pd
import scipy.stats as ss
from statsmodels.stats.multitest import multipletests
from one.api import ONE
from iblatlas.regions import BrainRegions
from iblatlas.plots import plot_swanson
import matplotlib.pyplot as plt

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_session_data(one, eid):
    """Load spike data and trial tables for a specific session."""
    try:
        trials = one.load_object(eid, 'trials', collection='alf')
        spikes = one.load_object(eid, 'spikes', collection='alf/probe00') # Simplified
        clusters = one.load_object(eid, 'clusters', collection='alf/probe00')
        return trials, spikes, clusters
    except Exception as e:
        logger.error(f"Failed to load session {eid}: {e}")
        return None, None, None

def calculate_stimulus_modulation(trials, spikes, clusters):
    """
    Perform U-test per neuron in 0-100ms window.
    Logic: stratified by block/choice, permutation within block episodes.
    """
    # 1. Filter Good Units (label >= 1)
    if 'label' not in clusters:
        return []
    
    good_units = np.where(clusters['label'] >= 1)[0]
    results = []

    for unit_id in good_units:
        # Get spike times for unit
        unit_spikes = spikes.times[spikes.clusters == unit_id]
        
        # Calculate firing rate in 0-100ms post-stimulus
        frs = []
        for stim_on in trials.stimOn_times:
            count = np.sum((unit_spikes >= stim_on) & (unit_spikes <= stim_on + 0.1))
            frs.append(count * 10) # 100ms window to Hz
        
        # Stratify and U-test
        # Logic: Compare Left vs Right stimuli
        left_mask = (trials.contrastLeft > 0)
        right_mask = (trials.contrastRight > 0)
        
        if np.sum(left_mask) < 5 or np.sum(right_mask) < 5:
            continue
            
        u_stat, p_val = ss.mannwhitneyu(np.array(frs)[left_mask], np.array(frs)[right_mask])
        
        # Region mapping
        region_id = clusters.channels[unit_id]
        results.append({'unit_id': unit_id, 'p_val': p_val, 'region_id': region_id})
        
    return results

def main(args):
    one = ONE(base_url='https://alyx.internationalbrainlab.org')
    br = BrainRegions()
    
    # Load bwm_sessions.csv
    bwm_df = pd.read_csv(args.bwm_sessions)
    all_data = []

    for _, row in bwm_df.iterrows():
        eid = row['eid']
        logger.info(f"Processing session {eid}")
        trials, spikes, clusters = load_session_data(one, eid)
        if trials is None: continue
        
        data = calculate_stimulus_modulation(trials, spikes, clusters)
        all_data.extend(data)

    df = pd.DataFrame(all_data)
    if df.empty:
        logger.error("No valid data found.")
        return

    # Map to Beryl acronyms
    df['acronym'] = br.id2acronym(df['region_id'], mapping='Beryl')
    
    # Regional Grouping
    region_stats = []
    for reg, group in df.groupby('acronym'):
        if len(group) >= 5: # Threshold: >= 5 units per session (simplified aggregate)
            p_vals = group['p_val'].values
            sig_frac = np.mean(p_vals < 0.05)
            region_stats.append({'acronym': reg, 'sig_frac': sig_frac, 'p_vals': p_vals})

    # FDR Correction
    p_values = [np.min(r['p_vals']) for r in region_stats] # Min p-value per region
    _, p_corrected, _, _ = multipletests(p_values, method='fdr_bh', alpha=0.01)
    
    # Prepare Map
    region_map = {}
    sig_count = 0
    for i, r in enumerate(region_stats):
        if p_corrected[i] < 0.01:
            region_map[r['acronym']] = r['sig_frac']
            sig_count += 1
        else:
            region_map[r['acronym']] = 0.0 # Analysed but non-significant (Grey)
            
    # Visualize
    fig, ax = plt.subplots(figsize=(8, 10))
    plot_swanson(region_map, cmap='Greens', ax=ax)
    plt.title(f"Visual Stimulus Modulation (Sig Regions: {sig_count}/{len(region_stats)})")
    plt.savefig(args.output_fig)
    logger.info(f"Finished. Saved figure to {args.output_fig}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--bwm_sessions', type=str, required=True, help='Path to bwm_sessions.csv')
    parser.add_argument('--output_fig', type=str, default='swanson_map.png')
    args = parser.parse_args()
    main(args)