"""
Analyze Neural Manifold Structure for Animal 2022-04-12-04.

This script performs dimensionality reduction (PCA) on z-scored neural population 
data and clusters neurons based on their functional profiles. It integrates 
behavioral tuning weights derived from the CePNEM framework.

References:
- Dimensionality Reduction: Based on standard methods for neural manifold analysis.
- Behavioral Tuning: Uses pre-computed CePNEM weights (not correlation-based).
"""

import argparse
import logging
import numpy as np
import pandas as pd
import pickle
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from scipy.cluster.hierarchy import linkage, dendrogram, leaves_list

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def load_data(neural_path, cepnem_path):
    """Load neural matrix and CePNEM model fits."""
    try:
        neural_data = np.load(neural_path)  # Expecting (N_neurons, T_time)
        with open(cepnem_path, 'rb') as f:
            cepnem_fits = pickle.load(f)
        return neural_data, cepnem_fits
    except FileNotFoundError as e:
        logger.error(f"Data file not found: {e}")
        raise
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        raise

def perform_analysis(neural_data, cepnem_weights):
    """
    1. Z-score neural activity.
    2. Run PCA (n=5).
    3. Cluster neurons using Ward linkage on PC loadings.
    """
    # Preprocessing: Z-score per neuron
    scaler = StandardScaler(axis=1)
    z_scored_data = scaler.fit_transform(neural_data.T).T
    
    # PCA
    pca = PCA(n_components=5)
    # Fit components (5, N) -> Transpose to (N, 5) for clustering
    pca_loadings = pca.fit_transform(z_scored_data.T)
    logger.info(f"Explained variance ratio: {pca.explained_variance_ratio_}")
    
    # Hierarchical Clustering
    linked = linkage(pca_loadings, method='ward')
    order = leaves_list(linked)
    
    return pca_loadings, linked, order

def plot_results(pca_loadings, cepnem_weights, order, output_dir):
    """Generate heatmap of PC loadings and CePNEM behavioral tunings."""
    sorted_loadings = pca_loadings[order]
    sorted_weights = cepnem_weights[order]
    
    fig = plt.figure(figsize=(12, 10))
    
    # Heatmap of loadings
    ax1 = plt.subplot(1, 2, 1)
    sns.heatmap(sorted_loadings, cmap='vlag', center=0, ax=ax1, cbar=False)
    ax1.set_title("PC1-PC5 Loadings")
    ax1.set_ylabel("Sorted Neurons")
    
    # Bar/Heatmap of tuning weights
    ax2 = plt.subplot(1, 2, 2)
    sns.heatmap(sorted_weights, cmap='viridis', ax=ax2)
    ax2.set_title("CePNEM Tuning (Fwd, Dors, Feed)")
    ax2.set_yticks([])
    
    plt.tight_layout()
    fig.savefig(f"{output_dir}/neuron_manifold_analysis.png")
    logger.info(f"Analysis plot saved to {output_dir}")

def main():
    parser = argparse.ArgumentParser(description="PCA and Cluster Analysis for Animal 2022-04-12-04")
    parser.add_argument("--neural_path", required=True, help="Path to NPY neural data")
    parser.add_argument("--cepnem_path", required=True, help="Path to PKL CePNEM fits")
    parser.add_argument("--output_dir", default=".", help="Directory to save figures")
    args = parser.parse_args()

    # 1. Load
    neural_data, cepnem_fits = load_data(args.neural_path, args.cepnem_path)
    # Extract weights: Assuming dictionary key 'weights' holds (N, 3) matrix
    weights = cepnem_fits['weights'] 
    
    # 2. Analyze
    pca_loadings, _, order = perform_analysis(neural_data, weights)
    
    # 3. Visualize
    plot_results(pca_loadings, weights, order, args.output_dir)

if __name__ == '__main__':
    main()