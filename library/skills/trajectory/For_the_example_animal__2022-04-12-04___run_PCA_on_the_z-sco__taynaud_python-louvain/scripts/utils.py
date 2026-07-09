"""
utils.py: Reusable utilities for neural data analysis and visualization.
"""

import numpy as np
import scipy.io as sio
import seaborn as sns
import matplotlib.pyplot as plt
import logging

logger = logging.getLogger(__name__)

def load_mat_data(neural_path, cepnem_path):
    """Loads neural activity and behavioral tuning from .mat files."""
    try:
        neural_data = sio.loadmat(neural_path)['neural_activity']
        cepnem_data = sio.loadmat(cepnem_path)
        
        behavioral_tuning = np.column_stack([
            cepnem_data['fwd'].flatten(),
            cepnem_data['dorsal'].flatten(),
            cepnem_data['feed'].flatten()
        ])
        return neural_data, behavioral_tuning
    except KeyError as e:
        logger.error(f"Missing expected key in .mat file: {e}")
        raise
    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        raise

def z_score_normalize(data, axis=1):
    """Z-scores data matrix along a specified axis."""
    return (data - np.mean(data, axis=axis, keepdims=True)) / \
           (np.std(data, axis=axis, keepdims=True) + 1e-9)

def plot_clustered_heatmap(feature_matrix, ordered_indices, xticklabels, output_path):
    """Generates and saves a clustered heatmap."""
    sorted_data = feature_matrix[ordered_indices]
    
    plt.figure(figsize=(10, 12))
    sns.heatmap(sorted_data, cmap='RdBu_r', center=0, xticklabels=xticklabels)
    plt.title("Neuron Clustering: PC Loadings and Behavioral Tuning")
    plt.xlabel("Features")
    plt.ylabel("Neurons (Clustered)")
    plt.tight_layout()
    plt.savefig(output_path)
    logger.info(f"Plot saved to {output_path}")