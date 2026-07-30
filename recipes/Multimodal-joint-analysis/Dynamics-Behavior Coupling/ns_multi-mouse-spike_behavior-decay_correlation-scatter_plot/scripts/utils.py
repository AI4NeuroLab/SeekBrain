"""
Utility functions for Neural-Behavioral Temporal Dynamics Analysis.
"""
import numpy as np
from scipy.optimize import curve_fit

def exponential_decay(t, tau):
    """Exponential decay function for autocorrelation fitting."""
    return np.exp(-t / tau)

def exponential_pdf(x, l):
    """Exponential probability density function for dwell-time fitting."""
    return l * np.exp(-l * x)

def get_inverse_decay_constant(time_series, dt=0.02):
    """
    Computes inverse decay constant lambda = 1/tau from autocorrelation.
    """
    n = len(time_series)
    norm_series = (time_series - np.mean(time_series)) / np.std(time_series)
    acf = np.correlate(norm_series, norm_series, mode='full')[n-1:] / n
    
    lags = np.arange(len(acf)) * dt
    idx = int(1.0 / dt)
    try:
        popt, _ = curve_fit(exponential_decay, lags[:idx], acf[:idx], p0=[0.1])
        tau = popt[0]
        return 1.0 / tau if tau > 0 else np.nan
    except RuntimeError:
        return np.nan

def fit_behavioral_lambda(behavior_data, bins=20):
    """
    Fits dwell-time distribution to determine behavioral lambda.
    """
    hist, bin_edges = np.histogram(behavior_data, bins=bins, density=True)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    try:
        popt, _ = curve_fit(exponential_pdf, bin_centers, hist, p0=[1.0])
        return popt[0]
    except RuntimeError:
        return np.nan