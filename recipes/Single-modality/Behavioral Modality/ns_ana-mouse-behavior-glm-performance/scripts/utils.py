"""
Utility functions for behavioral model fitting and Bayesian Model Selection.
"""

import numpy as np
import os
import pandas as pd

def calculate_bic(log_likelihood, n_params, n_trials):
    """Calculates the Bayesian Information Criterion (BIC)."""
    return -2 * log_likelihood + n_params * np.log(n_trials)

def perform_rfx_bms(bic_matrix, n_iter=100):
    """
    Performs Random-Effects Bayesian Model Selection (Rigoux et al., 2014).
    
    Args:
        bic_matrix: np.ndarray of shape (n_subjects, n_models)
        n_iter: number of iterations for variational bayes update
        
    Returns:
        model_freq: Dirichlet posterior parameters representing model frequencies
    """
    # Convert BIC to log-evidence (approximate: p(y|m) approx exp(-0.5 * BIC))
    log_evidence = -0.5 * bic_matrix
    
    n_subjects, n_models = log_evidence.shape
    alpha = np.ones(n_models)  # Dirichlet prior
    
    for _ in range(n_iter):
        # Responsibilities (log-space for numerical stability)
        log_u = log_evidence + (np.log(alpha) - np.sum(np.log(alpha)))
        u = np.exp(log_u - np.max(log_u, axis=1, keepdims=True))
        r = u / np.sum(u, axis=1, keepdims=True)
        
        # Update Dirichlet posterior
        alpha = 1 + np.sum(r, axis=0)
        
    return alpha / np.sum(alpha)

def save_results(results_df, output_dir, filename='bms_results.csv'):
    """Ensures directory exists and saves dataframe."""
    os.makedirs(output_dir, exist_ok=True)
    results_df.to_csv(os.path.join(output_dir, filename), index=False)