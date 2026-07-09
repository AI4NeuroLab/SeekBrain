"""
utils.py

Reusable utility functions for functional connectivity analysis.
"""

import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import logging

def load_and_preprocess(file_path, excluded_indices, time_limit=600):
    """Loads time series, subsets spontaneous period, and filters regions."""
    try:
        data = np.load(file_path)
        if data.shape[0] < time_limit:
            logging.warning(f"File {file_path} has fewer than {time_limit} time points.")
            return None
        return np.delete(data[:time_limit, :], excluded_indices, axis=1)
    except Exception as e:
        logging.error(f"Error processing {file_path}: {e}")
        return None

def compute_fisher_z(corr_matrix):
    """Applies Fisher-Z transformation with clipping to avoid infinities."""
    return np.arctanh(np.clip(corr_matrix, -0.999, 0.999))

def plot_connectivity_matrix(matrix, output_path, title="Connectivity Matrix"):
    """Generates a heatmap for the connectivity matrix."""
    plt.figure(figsize=(10, 8))
    sns.heatmap(matrix, cmap='RdBu_r', center=0, vmin=-0.5, vmax=0.5, 
                cbar_kws={'label': 'Pearson Correlation'})
    plt.title(title)
    plt.xlabel("Brain Region Index")
    plt.ylabel("Brain Region Index")
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()