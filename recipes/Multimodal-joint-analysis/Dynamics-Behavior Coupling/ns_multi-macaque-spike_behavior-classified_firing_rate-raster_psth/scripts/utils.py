"""
Utility functions for PMd Neural Dynamics Analysis.
Provides helpers for data synthesis, PSTH calculation, and tensor decomposition.
"""

import numpy as np
import logging
import tensorly as tl
from tensorly.decomposition import parafac

logger = logging.getLogger(__name__)

def generate_synthetic_data(n_neurons=50, n_bins=100, n_trials=200):
    """Generates synthetic neural data mimicking PMd activity [Neurons x Time x Trials]."""
    logger.info("Generating synthetic neural data...")
    data = np.random.normal(0, 0.1, (n_neurons, n_bins, n_trials))
    # Inject latent structure
    data[:, :, 100:] += 0.5 
    return data

def compute_psth(data, labels, condition_key):
    """Calculates trial-averaged PSTH for a specific condition."""
    condition_indices = np.where(labels == condition_key)[0]
    if len(condition_indices) == 0:
        raise ValueError(f"No trials found for condition {condition_key}")
    return np.mean(data[:, :, condition_indices], axis=2)

def run_cp_decomposition(data, rank=3):
    """Performs CP Decomposition using Tensorly."""
    logger.info(f"Running CP decomposition with rank={rank}")
    tensor = tl.tensor(data)
    return parafac(tensor, rank=rank, init='random', tol=1e-6)