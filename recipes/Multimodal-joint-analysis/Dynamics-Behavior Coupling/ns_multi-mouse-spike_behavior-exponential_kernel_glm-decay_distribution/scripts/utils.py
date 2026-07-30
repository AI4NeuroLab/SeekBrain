"""
Utility functions for neural decay constant estimation and GLM analysis.
"""
import numpy as np
import scipy.stats as stats

def get_history_matrix(trials_data, tau_values):
    """Constructs the design matrix based on exponentially decaying history."""
    history = trials_data['previous_choice'].values
    n_trials = len(history)
    X = np.zeros((n_trials, len(tau_values)))
    
    for i, tau in enumerate(tau_values):
        t = np.arange(n_trials)
        kernel = np.exp(-t / tau)
        X[:, i] = np.convolve(history, kernel, mode='full')[:n_trials]
    return X

def poisson_nll(params, X, Y):
    """Negative Log-Likelihood for Poisson GLM."""
    rate = np.exp(np.dot(X, params)) + 1e-6
    return np.sum(rate - Y * np.log(rate))

def fit_neural_tau(neural_data, history_matrix):
    """Finds the tau that maximizes the correlation for a neuron."""
    best_tau_idx = None
    max_r2 = -np.inf
    
    for i in range(history_matrix.shape[1]):
        X = history_matrix[:, i].flatten()
        res = stats.linregress(X, neural_data)
        r2 = res.rvalue**2
        if r2 > max_r2:
            max_r2 = r2
            best_tau_idx = i
    return best_tau_idx