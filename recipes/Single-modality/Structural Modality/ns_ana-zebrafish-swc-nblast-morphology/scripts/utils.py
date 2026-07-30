"""
Utility module for Neuronal Morphological Clustering.
Provides helper functions for data handling, clustering, and visualization.
"""

import os
import logging
import navis
import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, fcluster

logger = logging.getLogger(__name__)

def load_neurons(folder_path, expected_count=2143):
    """Load SWC files from a directory into a navis.NeuronList."""
    logger.info(f"Loading SWC files from {folder_path}...")
    neurons = navis.read_swc(folder_path)
    if len(neurons) != expected_count:
        logger.warning(f"Expected {expected_count} neurons, loaded {len(neurons)}.")
    return neurons

def compute_nblast(neurons):
    """Compute all-by-all NBLAST similarity matrix."""
    logger.info("Computing all-by-all NBLAST scores...")
    return navis.nblast_allbyall(neurons, normalized=True)

def perform_clustering(scores, n_clusters=22):
    """Perform hierarchical clustering based on NBLAST similarity matrix."""
    logger.info(f"Performing hierarchical clustering to extract {n_clusters} clusters...")
    dist = 1 - scores
    Z = linkage(dist, method='ward')
    cluster_ids = fcluster(Z, t=n_clusters, criterion='maxclust')
    return Z, cluster_ids

def save_cluster_mapping(neurons, cluster_ids, output_dir):
    """Save the association between neuron IDs and cluster IDs."""
    mapping = pd.DataFrame({'neuron_id': neurons.id, 'cluster_id': cluster_ids})
    mapping.to_csv(os.path.join(output_dir, "cluster_mapping.csv"), index=False)
    logger.info(f"Mapping saved to {output_dir}")

def render_cluster_visuals(neurons, cluster_ids, output_dir, brain_mesh=None):
    """Render clusters to static images."""
    os.makedirs(output_dir, exist_ok=True)
    for cluster_id in np.unique(cluster_ids):
        cluster_indices = np.where(cluster_ids == cluster_id)[0]
        subset = neurons[cluster_indices]
        logger.info(f"Rendering Cluster {cluster_id} ({len(subset)} neurons)...")
        
        # Note: Implementation depends on specific navis/vispy backend capabilities
        # navis.plot3d(subset, template=brain_mesh, alpha=0.3, color='orange')
        pass