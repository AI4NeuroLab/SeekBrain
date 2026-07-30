"""
Utility functions for ecephys data analysis pipelines.
"""
import numpy as np
import pandas as pd
from scipy.stats import wilcoxon
from sklearn.svm import LinearSVC
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler

def filter_units(session, isi_thresh=0.1, snr_thresh=2.0):
    """Filters units based on quality metrics."""
    units = session.units.copy()
    return units[(units['isi_violations'] < isi_thresh) & (units['snr'] > snr_thresh)]

def get_responsive_units(session, unit_ids, stimulus_name="natural_scenes"):
    """Identifies responsive units via Wilcoxon signed-rank test."""
    presentations = session.get_stimulus_table(stimulus_name)
    spike_counts = session.presentationwise_spike_counts(
        bin_size=0.25,
        stimulus_presentation_ids=presentations.index,
        unit_ids=unit_ids
    )
    
    responsive_units = []
    for uid in unit_ids:
        stim_data = spike_counts.loc[:, uid, :].values.flatten()
        if wilcoxon(stim_data).pvalue < 0.05:
            responsive_units.append(uid)
    return responsive_units

def run_decoding(session, unit_ids, stimulus_name="natural_scenes"):
    """Executes SVM decoding pipeline and returns cross-validated accuracy."""
    presentations = session.get_stimulus_table(stimulus_name)
    X = session.presentationwise_spike_counts(
        bin_size=0.1, 
        stimulus_presentation_ids=presentations.index,
        unit_ids=unit_ids
    ).values.reshape(len(presentations), len(unit_ids))
    
    y = presentations['frame'].values if 'frame' in presentations.columns else presentations.index
    
    X_scaled = StandardScaler().fit_transform(X)
    clf = LinearSVC(dual="auto", random_state=42)
    return np.mean(cross_val_score(clf, X_scaled, y, cv=5))