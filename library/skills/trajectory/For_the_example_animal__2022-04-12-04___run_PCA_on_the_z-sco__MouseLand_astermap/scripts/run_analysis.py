"""
CePNEM Neural Dynamics and Behavioral Tuning Analysis
=====================================================
Purpose:
    1. Perform PCA on z-scored neural traces (T x N).
    2. Cluster neurons using the top-5 PCA loading profiles.
    3. Visualize neural PCA loadings alongside CePNEM-derived behavioral tuning weights.

Inputs:
    - neural_traces.mat: Contains 'neural_traces' (T x N matrix).
    - cepnem_model.mat: Contains 'W' (N x 3 matrix of behavioral weights).

Outputs:
    - figure_neural_tuning.png: Heatmap and bar plot visualization.
"""

import os
import argparse
import logging
import numpy as np
import scipy.io as sio
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.stats import zscore
from scipy.cluster.hierarchy import linkage, leaves_list
from sklearn.decomposition import PCA

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_data(data_path):
    """Loads neural traces and CePNEM model weights."""
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Data file not found: {data_path}")
    return sio.loadmat(data_path)

def perform_pca_and_clustering(z_traces):
    """Runs PCA and clusters based on top 5 loadings."""
    logging.info("Performing PCA...")
    pca = PCA(n_components=5)
    pca.fit(z_traces)
    loadings = pca.components_.T  # (N, 5)
    
    logging.info("Clustering neurons based on PC 1-5 loadings...")
    # Linkage method 'ward' is standard for hierarchical structure discovery in C. elegans
    linkage_matrix = linkage(loadings, method='ward', metric='euclidean')
    neuron_order = leaves_list(linkage_matrix)
    
    return loadings, neuron_order

def plot_results(loadings, weights, neuron_order, output_path):
    """Creates a side-by-side visualization of loadings and behavioral tuning."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 10), gridspec_kw={'width_ratios': [1, 1]})
    
    sorted_loadings = loadings[neuron_order, :]
    sorted_weights = weights[neuron_order, :]
    
    # Heatmap of PCA Loadings
    sns.heatmap(sorted_loadings, ax=ax1, cmap='RdBu_r', center=0, cbar=True)
    ax1.set_title("PC 1-5 Loadings (Sorted)")
    ax1.set_ylabel("Neuron Index (Clustered)")
    ax1.set_xlabel("PC Component")
    
    # Bar plot of CePNEM Weights
    # Plotting stacked bars or grouped bars for the 3 behaviors
    n_neurons = sorted_weights.shape[0]
    indices = np.arange(n_neurons)
    
    colors = ['#1f77b4', '#ff7f0e', '#2ca02c']
    labels = ['Forward', 'Dorsal', 'Feeding']
    
    for i in range(3):
        ax2.barh(indices, sorted_weights[:, i], color=colors[i], alpha=0.6, label=labels[i])
    
    ax2.set_title("CePNEM Behavioral Tuning")
    ax2.set_yticks([])
    ax2.set_xlabel("Weight Magnitude")
    ax2.legend()
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    logging.info(f"Figure saved to {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Reproduce CePNEM PCA and Clustering")
    parser.add_argument("--neural_data", default="data/2022-04-12-04/neural_traces.mat")
    parser.add_argument("--model_data", default="results/2022-04-12-04/cepnem_model.mat")
    parser.add_argument("--output", default="results/2022-04-12-04/neural_tuning_viz.png")
    args = parser.parse_args()

    # 1. Load data
    neural_data = load_data(args.neural_data)['neural_traces']
    model_data = load_data(args.model_data)['W']
    
    # 2. Z-score (Axis 0 = across time)
    z_traces = zscore(neural_data, axis=0)
    
    # 3. PCA & Clustering
    loadings, order = perform_pca_and_clustering(z_traces)
    
    # 4. Visualize
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    plot_results(loadings, model_data, order, args.output)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        logging.error(f"Analysis failed: {e}")