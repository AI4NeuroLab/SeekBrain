"""
utils.py

Reusable utility functions for neural encoding analysis, including
model fitting, significance testing, and plotting preparations.
"""

import numpy as np
from scipy.optimize import curve_fit
from statsmodels.distributions.empirical_distribution import ECDF

def exponential_decay(t, A, tau):
    """Model for kernel decay: f(t) = A * exp(-t / tau)."""
    return A * np.exp(-t / tau)

def fit_half_decay(kernel, dt=0.03):
    """
    Extracts tau from a temporal kernel using curve_fit.
    
    Args:
        kernel (np.array): Temporal kernel weights.
        dt (float): Sampling interval in seconds.
        
    Returns:
        float: Estimated decay constant (tau) or np.nan if fitting fails.
    """
    t = np.arange(len(kernel)) * dt
    try:
        # Constraint: A > 0, tau > 0. 
        popt, _ = curve_fit(exponential_decay, t, kernel, p0=(max(kernel), 0.5), 
                            bounds=(0, [np.inf, 2.0]))
        return popt[1]
    except Exception:
        return np.nan

def run_significance_test(spike_counts, beh_trace, n_perms=1000):
    """
    Performs a permutation test to determine if correlation is significant.
    
    Returns:
        bool: True if real correlation > 95th percentile of shuffled null.
    """
    real_corr = np.corrcoef(spike_counts, beh_trace)[0, 1]
    shuffled_corrs = [
        np.corrcoef(np.random.permutation(spike_counts), beh_trace)[0, 1] 
        for _ in range(n_perms)
    ]
    return real_corr > np.percentile(shuffled_corrs, 95)

def compute_population_ecdf(results, tau_grid):
    """
    Computes aggregated ECDF from neuron-level result dictionaries.
    
    Args:
        results (list of dict): List containing keys 'animal_id', 'tau', 'is_significant'.
        tau_grid (np.array): Uniform grid to evaluate ECDF.
        
    Returns:
        tuple: (mean_ecdf, std_ecdf)
    """
    animal_ids = set(r['animal_id'] for r in results)
    ecdf_matrix = []
    
    for aid in animal_ids:
        taus = [r['tau'] for r in results if r['animal_id'] == aid 
                and r['is_significant'] and not np.isnan(r['tau'])]
        if taus:
            ecdf = ECDF(taus)
            ecdf_matrix.append(ecdf(tau_grid))
            
    ecdf_matrix = np.array(ecdf_matrix)
    return np.mean(ecdf_matrix, axis=0), np.std(ecdf_matrix, axis=0)