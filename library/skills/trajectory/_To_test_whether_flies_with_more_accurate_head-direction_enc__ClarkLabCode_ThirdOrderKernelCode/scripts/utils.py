import numpy as np
from scipy.optimize import curve_fit
from astropy.stats import circvar

def von_mises(x, mu, kappa, amplitude, baseline):
    """Von Mises distribution function for EPG bump fitting."""
    return amplitude * np.exp(kappa * np.cos(x - mu)) / (2 * np.pi * np.i0(kappa)) + baseline

def fit_bump_width(activity_profile):
    """
    Fits activity profile to Von Mises distribution.
    Returns kappa (concentration).
    """
    x = np.linspace(-np.pi, np.pi, len(activity_profile))
    try:
        # Initial guess for fitting
        popt, _ = curve_fit(von_mises, x, activity_profile, p0=[0, 1, 1, 0])
        return popt[1]
    except Exception:
        return np.nan

def compute_hd_accuracy(bump_phase, hd_angle):
    """Computes 1 - circular variance of the phase offset."""
    offset = (bump_phase - hd_angle) % (2 * np.pi)
    cv = circvar(offset)
    return 1 - cv

def analyze_fly_data(activity_data, hd_data, vel_data, vel_threshold=20):
    """Processes single fly data during movement periods."""
    mask = vel_data > vel_threshold
    
    if np.sum(mask) == 0:
        return None, None
    
    valid_activity = activity_data[mask]
    valid_hd = hd_data[mask]
    
    kappas = [fit_bump_width(profile) for profile in valid_activity]
    # Argmax used as proxy for bump phase
    accuracies = [compute_hd_accuracy(p, h) for p, h in zip(valid_activity.argmax(axis=1), valid_hd)]
    
    return np.nanmean(kappas), np.nanmean(accuracies)