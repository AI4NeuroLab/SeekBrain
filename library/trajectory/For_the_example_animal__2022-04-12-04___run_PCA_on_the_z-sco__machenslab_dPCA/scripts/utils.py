"""
Utility module for neural manifold analysis.
Provides helper functions for data loading, PCA processing, and plotting.
"""

import numpy as np
import pickle
import logging
import seaborn as sns
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from scipy.cluster.hierarchy import linkage, leaves_list

logger = logging.getLogger(__name__)

def load_neural_data(neural_path, cepnem_path):
    """Load neural matrix and CePNEM model fits."""
    try:
        neural_data = np.load(neural_path)
        with open(cepnem_path, 'rb') as f:
            cepnem_fits = pickle.load(f)
        return neural_data, cepnem_fits
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        raise

def run_pca_and_cluster(neural_data, n_components=5):
    """Perform z-scoring, PCA, and hierarchical clustering."""
    scaler = StandardScaler(axis=1)
    z_scored_data = scaler.fit_transform(neural_data.T).T
    
    pca = PCA(n_components=n_components)
    pca_loadings = pca.fit_transform(z_scored_data.T)
    
    logger.info(f"Explained variance: {pca.explained_variance_ratio_}")
    
    linked = linkage(pca_loadings, method='ward')
    order = leaves_list(linked)
    
    return pca_loadings, order

def plot_manifold_summary(pca_loadings, behavioral_weights, order, output_path):
    """Generate side-by-side heatmaps of manifold loadings and tuning weights."""
    sorted_loadings = pca_loadings[order]
    sorted_weights = behavioral_weights[order]
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 10))
    
    sns.heatmap(sorted_loadings, cmap='vlag', center=0, ax=ax1, cbar=False)
    ax1.set_title("PC Loadings")
    
    sns.heatmap(sorted_weights, cmap='viridis', ax=ax2)
    ax2.set_title("Behavioral Tuning")
    ax2.set_yticks([])
    
    plt.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)