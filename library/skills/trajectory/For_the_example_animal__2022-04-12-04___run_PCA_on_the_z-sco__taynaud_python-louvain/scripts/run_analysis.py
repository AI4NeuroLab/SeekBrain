#!/usr/bin/env python3
"""
PCA and Behavioral Clustering Pipeline for Animal 2022-04-12-04.

This script performs the following:
1. Loads raw neural activity (mat format).
2. Z-scores the activity matrix (N x T).
3. Performs PCA to extract the top-5 loading vectors (N x 5).
4. Loads CePNEM behavioral tuning scores (Fwd, Dorsal, Feed).
5. Performs Ward's hierarchical clustering on the PC loading matrix.
6. Generates a clustered heatmap of concatenated PC loadings and behavioral tunings.

Dependencies: numpy, pandas, scipy, sklearn, matplotlib, seaborn.
"""

import argparse
import logging
import numpy as np
import scipy.io as sio
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.decomposition import PCA
from scipy.cluster.hierarchy import linkage, dendrogram
from scipy.spatial.distance import pdist

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def load_data(neural_path, cepnem_path):
    """Loads neural data and behavioral tuning scores."""
    try:
        neural_data = sio.loadmat(neural_path)['neural_activity'] # N x T
        cepnem_data = sio.loadmat(cepnem_path)
        # Assuming keys 'fwd', 'dorsal', 'feed' exist in the mat file
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

def process_pipeline(neural_data, behavioral_tuning):
    """Executes the PCA and Hierarchical Clustering steps."""
    # 1. Z-score neural traces
    # Ensure mean=0, std=1 across time dimension (axis 1)
    z_scored = (neural_data - np.mean(neural_data, axis=1, keepdims=True)) / \
               (np.std(neural_data, axis=1, keepdims=True) + 1e-9)
    
    # 2. PCA Execution (N x T matrix -> Loadings N x 5)
    pca = PCA(n_components=5)
    # PCA fits samples as rows, so we transpose (T x N)
    pca.fit(z_scored.T)
    loadings = pca.components_.T  # Shape (N, 5)
    logger.info(f"Explained variance by top-5 PCs: {np.sum(pca.explained_variance_ratio_):.2%}")

    # 3. Hierarchical Clustering (Ward's linkage on loadings)
    feature_matrix = np.hstack([loadings, behavioral_tuning])
    Z = linkage(loadings, method='ward', metric='euclidean')
    
    return feature_matrix, Z

def plot_results(feature_matrix, Z, output_path):
    """Visualizes the sorted neurons using a heatmap."""
    # Convert linkage to dendrogram to get ordering
    dendro = dendrogram(Z, no_plot=True)
    ordered_indices = dendro['leaves']
    sorted_data = feature_matrix[ordered_indices]

    # Create figure
    plt.figure(figsize=(10, 12))
    sns.heatmap(sorted_data, cmap='RdBu_r', center=0, 
                xticklabels=['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'Fwd', 'Dorsal', 'Feed'])
    plt.title("Neuron Clustering: PC Loadings and Behavioral Tuning")
    plt.xlabel("Features")
    plt.ylabel("Neurons (Clustered)")
    plt.tight_layout()
    plt.savefig(output_path)
    logger.info(f"Plot saved to {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Run PCA-based clustering for CePNEM neural data.")
    parser.add_argument("--neural", required=True, help="Path to neural_data.mat")
    parser.add_argument("--cepnem", required=True, help="Path to CePNEM_results.mat")
    parser.add_argument("--out", default="cluster_heatmap.png", help="Output plot filename")
    
    args = parser.parse_args()

    # Execution flow
    try:
        neural, behavior = load_data(args.neural, args.cepnem)
        features, Z = process_pipeline(neural, behavior)
        plot_results(features, Z, args.out)
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")

if __name__ == '__main__':
    main()