"""
Utility module for Bayesian prior decoding and neural data analysis.
"""

import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
from sklearn.preprocessing import StandardScaler
from scipy.stats import pearsonr

def generate_bayes_optimal_prior(stimuli, hazard_rate=0.1):
    """Computes the Bayes-optimal prior probability of 'Right' stimulus."""
    prior = np.zeros(len(stimuli))
    p = 0.5
    for i in range(len(stimuli)):
        prior[i] = p
        p = p * (1 - hazard_rate) + stimuli[i] * hazard_rate
    return prior

def train_decoder(features, target, alpha=1.0, n_splits=5):
    """Trains a Ridge Regression decoder using K-Fold Cross-Validation."""
    scaler = StandardScaler()
    X = scaler.fit_transform(features)
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    predictions = np.zeros_like(target)
    
    for train_idx, test_idx in kf.split(X):
        model = Ridge(alpha=alpha)
        model.fit(X[train_idx], target[train_idx])
        predictions[test_idx] = model.predict(X[test_idx])
    return predictions

def calculate_metrics(y_true, y_pred):
    """Calculates Pearson correlation and raw R^2."""
    r, _ = pearsonr(y_true, y_pred)
    ss_res = np.sum((y_true - y_pred)**2)
    ss_tot = np.sum((y_true - np.mean(y_true))**2)
    r2 = 1 - (ss_res / ss_tot)
    return r, r2

def plot_prior_comparison(block, bayes, decoded, save_path):
    """Visualizes prior trajectories."""
    plt.figure(figsize=(12, 6))
    plt.plot(block, label='True Block Prior', color='k', linestyle='--', alpha=0.5)
    plt.plot(bayes, label='Bayes-Optimal Prior', color='blue', alpha=0.7)
    plt.plot(decoded, label='Decoded Prior', color='red', alpha=0.6)
    plt.xlabel('Trial Index')
    plt.ylabel('Prior Probability')
    plt.legend()
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()