"""
Utility functions for circular statistics and neural data analysis.
"""

import numpy as np
import scipy.stats as stats

def compute_circular_offset(phi_bump, theta_scene):
    """
    Compute circular difference within range [-pi, pi].
    """
    return (phi_bump - theta_scene + np.pi) % (2 * np.pi) - np.pi

def get_vonmises_kappa(data):
    """
    Fit von Mises distribution to circular data.
    Returns the concentration parameter kappa.
    """
    # vonmises.fit returns (mu, kappa)
    _, kappa = stats.vonmises.fit(data, fscale=1)
    return kappa

def run_shuffle_test(phi_bump, theta_scene, n_shuffles=1000, min_lag=50):
    """
    Perform circular shuffling to estimate the null distribution of kappa.
    The shuffle maintains temporal correlations by using a large random block shift.
    """
    n_samples = len(phi_bump)
    null_kappas = []
    
    for _ in range(n_shuffles):
        # Shift bump phase by random lag to disrupt trial-structure correlation
        lag = np.random.randint(min_lag, n_samples - min_lag)
        phi_shuffled = np.roll(phi_bump, lag)
        
        offset = compute_circular_offset(phi_shuffled, theta_scene)
        null_kappas.append(get_vonmises_kappa(offset))
        
    return np.array(null_kappas)