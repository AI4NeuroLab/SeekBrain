"""
Utility module for neuronal classification tasks.
Contains data loading, clustering, and visualization helpers.
"""

import os
import pandas as pd
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from scipy.spatial.distance import squareform
import logging

logger = logging.getLogger(__name__)

def load_similarity_matrix(filepath):
    """Loads and validates the NBLAST matrix from CSV."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Matrix file not found: {filepath}")
    
    df = pd.read_csv(filepath, index_col=0)
    logger.info(f"Loaded {df.shape[0]}x{df.shape[1]} similarity matrix.")
    return df

def perform_clustering(similarity_df, k=8):
    """
    Performs Ward's hierarchical clustering.
    Converts NBLAST similarity (0-1) to distance (1-Similarity).
    """
    similarity_matrix = similarity_df.values
    distance_matrix = 1.0 - similarity_matrix
    
    # Ensure matrix is squareform distance
    dist_sq = squareform(distance_matrix, checks=True)
    
    # Perform Ward clustering
    Z = linkage(dist_sq, method='ward')
    
    # Cut tree into k clusters
    clusters = fcluster(Z, t=k, criterion='maxclust')
    
    return Z, clusters

def save_cluster_assignments(clusters, index, output_dir, filename='cluster_assignments.csv'):
    """Saves the cluster assignments to CSV."""
    os.makedirs(output_dir, exist_ok=True)
    res_df = pd.DataFrame({'Neuron_ID': index, 'Cluster': clusters})
    res_df.to_csv(os.path.join(output_dir, filename), index=False)
    logger.info(f"Assignments saved to {os.path.join(output_dir, filename)}")

def plot_dendrogram(Z, output_dir, filename='dendrogram.png'):
    """Generates and saves the dendrogram visualization."""
    plt.figure(figsize=(15, 8))
    dendrogram(Z, leaf_rotation=90, leaf_font_size=8)
    plt.title("Morphological Classification Dendrogram (Ward's Method)")
    plt.xlabel("Neuron Index")
    plt.ylabel("Euclidean Distance (1 - NBLAST Similarity)")
    plt.tight_layout()
    save_path = os.path.join(output_dir, filename)
    plt.savefig(save_path)
    logger.info(f"Dendrogram plot saved to {save_path}")