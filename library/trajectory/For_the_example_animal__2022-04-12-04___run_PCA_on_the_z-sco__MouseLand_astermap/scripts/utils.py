"""
Utility module for CePNEM analysis routines.
"""
import logging
import numpy as np
import scipy.io as sio
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import linkage, leaves_list
from sklearn.decomposition import PCA

def load_mat_file(file_path, key):
    """Loads a specific key from a .mat file."""
    try:
        data = sio.loadmat(file_path)
        return data[key]
    except KeyError:
        raise KeyError(f"Key '{key}' not found in {file_path}")

def perform_pca_and_clustering(z_traces, n_components=5):
    """Runs PCA and computes hierarchical neuron ordering."""
    logging.info(f"Performing PCA (n={n_components})...")
    pca = PCA(n_components=n_components)
    pca.fit(z_traces)
    loadings = pca.components_.T
    
    logging.info("Clustering neurons based on PC loadings...")
    linkage_matrix = linkage(loadings, method='ward', metric='euclidean')
    neuron_order = leaves_list(linkage_matrix)
    
    return loadings, neuron_order

def plot_neural_tuning(loadings, weights, neuron_order, output_path):
    """Generates side-by-side PCA loading heatmaps and behavioral tuning bars."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 10), gridspec_kw={'width_ratios': [1, 1]})
    
    sorted_loadings = loadings[neuron_order, :]
    sorted_weights = weights[neuron_order, :]
    
    # Heatmap of PCA Loadings
    sns.heatmap(sorted_loadings, ax=ax1, cmap='RdBu_r', center=0, cbar=True)
    ax1.set_title("PC 1-5 Loadings (Sorted)")
    ax1.set_ylabel("Neuron Index (Clustered)")
    ax1.set_xlabel("PC Component")
    
    # Bar plot of CePNEM Weights
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
    plt.close(fig)