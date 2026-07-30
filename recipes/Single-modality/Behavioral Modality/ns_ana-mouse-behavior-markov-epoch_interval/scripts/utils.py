"""
Utility functions for GLM-HMM behavioral analysis.
"""
import os
import numpy as np
import matplotlib.pyplot as plt
from scipy.special import expit

def sigmoid(z):
    """Numerically stable sigmoid function."""
    return expit(z)

def ensure_directory(path):
    """Creates directory if it does not exist."""
    if not os.path.exists(path):
        os.makedirs(path)

def plot_state_posteriors(posteriors, output_path, state_names=None):
    """Plots and saves the posterior probability traces."""
    plt.figure(figsize=(10, 4))
    plt.plot(sigmoid(posteriors))
    plt.title("State Posterior Probability Traces")
    plt.xlabel("Trial")
    plt.ylabel("P(State)")
    if state_names:
        plt.legend(state_names)
    plt.savefig(output_path)
    plt.close()

def generate_synthetic_data(n_trials, n_features=3):
    """Generates synthetic choice data based on latent states."""
    X = np.random.randn(n_trials, n_features)
    X[:, 0] = 1  # Intercept
    true_betas = np.array([[0, 2, 0.5], [2, 0, 0], [-2, 0, 0]])
    # Simulate states and choices
    state_seq = np.random.choice(len(true_betas), n_trials)
    logits = np.sum(X * true_betas[state_seq], axis=1)
    choices = (sigmoid(logits) > 0.5).astype(int)
    return X, choices