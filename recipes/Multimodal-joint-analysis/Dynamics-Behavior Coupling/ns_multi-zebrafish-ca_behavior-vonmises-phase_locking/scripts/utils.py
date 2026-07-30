"""
Utility functions for neural navigation data analysis.
Includes common signal processing, circular statistics, and statistical bootstrapping.
"""

import numpy as np
import scipy.stats as stats

def wrap_to_pi(angles):
    """Wraps angles to the range [-pi, pi]."""
    return (angles + np.pi) % (2 * np.pi) - np.pi

def get_kappa(angles):
    """
    Fits a von Mises distribution to data and returns kappa (concentration).
    Using scipy.stats.vonmises.fit with fixed scale (1).
    """
    _, kappa = stats.vonmises.fit(angles, fscale=1)
    return kappa

def run_shuffle_control(bump_phase, scene_orientation, mask, n_shuffles=1000):
    """
    Performs circular shifts (rolling) on bump_phase to preserve local 
    autocorrelation while breaking phase locking to the scene.
    """
    epoch_data = wrap_to_pi(bump_phase[mask] - scene_orientation[mask])
    null_kappas = []
    
    for _ in range(n_shuffles):
        # Circular shift by random amount
        shift = np.random.randint(1, len(bump_phase))
        shuffled_bump = np.roll(bump_phase, shift)
        shuffled_delta = wrap_to_pi(shuffled_bump[mask] - scene_orientation[mask])
        null_kappas.append(get_kappa(shuffled_delta))
        
    return np.percentile(null_kappas, 95), np.median(null_kappas)