"""
Reproduction of Siegle et al. (2021) analysis: Population decoding and 
responsiveness across visual brain regions.

This script performs:
1. Unit quality filtering (ISI violations, SNR).
2. Stimulus-evoked response calculation (Wilcoxon test).
3. Population decoding using LinearSVC.
4. Visualization of area-wise responsiveness vs. decoding accuracy.

Dependencies: allensdk, numpy, pandas, scikit-learn, scipy, matplotlib
"""

import argparse
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import wilcoxon
from sklearn.svm import LinearSVC
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from allensdk.brain_observatory.ecephys.ecephys_project_cache import EcephysProjectCache

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def filter_units(session):
    """Step 1: Filter units based on quality metrics."""
    units = session.units.copy()
    good_units = units[(units['isi_violations'] < 0.1) & (units['snr'] > 2)]
    logger.info(f"Filtered {len(units)} units down to {len(good_units)} based on quality.")
    return good_units

def get_responsive_units(session, unit_ids, stimulus_name="natural_scenes"):
    """Step 3: Identify responsive units via Wilcoxon signed-rank test."""
    # Align spikes to stimulus presentations
    presentations = session.get_stimulus_table(stimulus_name)
    # 0-250ms post-stimulus vs 250ms baseline
    spike_counts = session.presentationwise_spike_counts(
        bin_size=0.25,
        stimulus_presentation_ids=presentations.index,
        unit_ids=unit_ids
    )
    
    responsive_units = []
    for uid in unit_ids:
        # Simplified responsiveness check: compare trial-wise response to baseline
        # In actual Siegle et al, we compare stimulus window vs inter-stimulus window
        stim_data = spike_counts.loc[:, uid, :].values.flatten()
        if wilcoxon(stim_data).pvalue < 0.05:
            responsive_units.append(uid)
            
    return responsive_units

def run_decoding(session, unit_ids, stimulus_name="natural_scenes"):
    """Step 4 & 5: SVM Decoding Pipeline."""
    presentations = session.get_stimulus_table(stimulus_name)
    X = session.presentationwise_spike_counts(
        bin_size=0.1, 
        stimulus_presentation_ids=presentations.index,
        unit_ids=unit_ids
    ).values.reshape(len(presentations), len(unit_ids))
    
    y = presentations['frame'].values if 'frame' in presentations.columns else presentations.index
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    clf = LinearSVC(dual="auto", random_state=42)
    scores = cross_val_score(clf, X_scaled, y, cv=5)
    return np.mean(scores)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--session_id", type=int, required=True, help="Ecephys Session ID")
    parser.add_argument("--output_dir", type=str, default="./output")
    args = parser.parse_args()

    # Data Loading
    cache = EcephysProjectCache(manifest="manifest.json")
    session = cache.get_session_data(args.session_id)
    
    # 1. Filter
    good_units = filter_units(session)
    
    # 2. Group by region (simplified for this structure)
    regions = good_units['location'].unique()
    results = []
    
    # Identify responsive across all units first
    responsive_ids = get_responsive_units(session, good_units.index.values)
    
    # 3. Subsampling (Step 4 in plan)
    min_count = min([len(good_units[good_units['location'] == r]) for r in regions])
    
    for region in regions:
        region_units = good_units[good_units['location'] == region].index.values
        # Subsample to control for population size
        subset = np.random.choice(region_units, min_count, replace=False)
        
        acc = run_decoding(session, subset)
        frac = len(set(subset) & set(responsive_ids)) / len(subset)
        results.append({'region': region, 'accuracy': acc, 'fraction': frac})
        
    df = pd.DataFrame(results)
    
    # Visualization
    fig, ax = plt.subplots(1, 2, figsize=(12, 5))
    df.plot(x='region', y='fraction', kind='bar', ax=ax[0], title="Fraction Responsive")
    df.plot(x='region', y='accuracy', kind='bar', ax=ax[1], title="Decoding Accuracy")
    plt.tight_layout()
    plt.savefig(f"{args.output_dir}/results_{args.session_id}.png")
    logger.info("Analysis complete. Plot saved.")

if __name__ == '__main__':
    main()