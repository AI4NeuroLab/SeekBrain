"""
Utility functions for Structural Connectivity (SC) network analysis.
"""
import numpy as np
import networkx as nx
import community.community_louvain as community_louvain
import matplotlib.patches as patches
import seaborn as sns
import logging

logger = logging.getLogger(__name__)

def apply_mask(sc_matrix, excluded_indices):
    """Mask SC matrix by removing specified indices."""
    total_nodes = sc_matrix.shape[0]
    all_indices = np.arange(total_nodes)
    remaining = np.setdiff1d(all_indices, excluded_indices)
    return sc_matrix[np.ix_(remaining, remaining)]

def compute_consensus_matrix(matrix, iterations=100, seed=42):
    """Computes co-assignment probability matrix via iterative Louvain."""
    n = matrix.shape[0]
    consensus = np.zeros((n, n))
    G = nx.from_numpy_array(matrix)
    
    np.random.seed(seed)
    for i in range(iterations):
        partition = community_louvain.best_partition(G, random_state=i)
        for u in range(n):
            for v in range(n):
                if partition[u] == partition[v]:
                    consensus[u, v] += 1
    
    return consensus / iterations

def add_module_rectangles(clustermap_obj, labels):
    """Adds highlighting rectangles to a seaborn clustermap based on cluster labels."""
    ordered_labels = labels[clustermap_obj.dendrogram_row.reordered_ind]
    ax = clustermap_obj.ax_heatmap
    
    for l in np.unique(labels):
        indices = np.where(ordered_labels == l)[0]
        if len(indices) > 0:
            start, end = indices[0], indices[-1]
            size = end - start + 1
            rect = patches.Rectangle((start, start), size, size, linewidth=3, 
                                     edgecolor='white', facecolor='none')
            ax.add_patch(rect)