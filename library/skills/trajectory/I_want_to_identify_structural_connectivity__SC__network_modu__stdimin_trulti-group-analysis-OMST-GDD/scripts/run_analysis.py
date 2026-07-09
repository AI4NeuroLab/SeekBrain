#!/usr/bin/env python3
"""
Structural Connectivity (SC) Network Module Identification
------------------------------------------------------------
This script implements a hierarchical consensus clustering approach to identify
structural modules in zebrafish brain connectivity data.

Workflow:
1. Mask the SC matrix using excluded regions.
2. Iterative Louvain (n=100) to generate a co-assignment probability matrix.
3. Hierarchical Ward's linkage clustering on the consensus matrix.
4. Partitioning into 4 modules.
5. Visualization via seaborn.clustermap with dendrogram and overlay boxes.

References:
- Zebrafish connectome methodology (consensus clustering/hierarchical modularity).
- Input: SC_matrix_directed_terminals_expanded.npy
- Exclusion: Figure1_excluded_regions.npy
"""

import os
import argparse
import logging
import numpy as np
import networkx as nx
import community.community_louvain as community_louvain
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import seaborn as sns
from scipy.cluster.hierarchy import linkage, fcluster, leaves_list

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def load_and_mask_data(sc_path, exclude_path):
    """Step 1: Mask SC matrix based on excluded regions."""
    if not os.path.exists(sc_path) or not os.path.exists(exclude_path):
        raise FileNotFoundError("Check ZEBRAFISH_PATH and PROCESS_DATA_DIR.")
    
    sc = np.load(sc_path)
    excluded = np.load(exclude_path)
    
    # Ensure symmetry for Louvain (undirected)
    sc = (sc + sc.T) / 2
    
    total_nodes = sc.shape[0]
    all_indices = np.arange(total_nodes)
    remaining = np.setdiff1d(all_indices, excluded)
    
    sc_clean = sc[np.ix_(remaining, remaining)]
    logger.info(f"Masked SC matrix shape: {sc_clean.shape}")
    return sc_clean

def compute_consensus_matrix(matrix, iterations=100, seed=42):
    """Step 2 & 3: Iterative Louvain and Consensus computation."""
    n = matrix.shape[0]
    consensus = np.zeros((n, n))
    G = nx.from_numpy_array(matrix)
    
    np.random.seed(seed)
    for i in range(iterations):
        # Run Louvain
        partition = community_louvain.best_partition(G, random_state=i)
        # Update co-assignment
        for u in range(n):
            for v in range(n):
                if partition[u] == partition[v]:
                    consensus[u, v] += 1
    
    return consensus / iterations

def plot_consensus_heatmap(consensus, linkage_matrix, labels, output_dir):
    """Step 5 & 6: Clustermap with 4-module box highlights."""
    g = sns.clustermap(consensus, row_linkage=linkage_matrix, col_linkage=linkage_matrix,
                       cmap="viridis", figsize=(12, 12), cbar_kws={'label': 'Co-assignment Probability'})
    
    # Identify block positions based on leaves order
    ordered_labels = labels[g.dendrogram_row.reordered_ind]
    ax = g.ax_heatmap
    
    unique_labels = np.unique(labels)
    for l in unique_labels:
        indices = np.where(ordered_labels == l)[0]
        if len(indices) > 0:
            start, end = indices[0], indices[-1]
            size = end - start + 1
            rect = patches.Rectangle((start, start), size, size, linewidth=3, 
                                     edgecolor='white', facecolor='none')
            ax.add_patch(rect)
    
    plt.savefig(os.path.join(output_dir, "SC_Modules_4.pdf"))
    logger.info("Visualization saved as SC_Modules_4.pdf")

def main():
    parser = argparse.ArgumentParser(description="Zebrafish SC Module Identification")
    parser.add_argument("--sc_path", required=True, help="Path to SC_matrix_directed_terminals_expanded.npy")
    parser.add_argument("--exclude_path", required=True, help="Path to Figure1_excluded_regions.npy")
    parser.add_argument("--out_dir", default=".", help="Directory to save outputs")
    args = parser.parse_args()

    # 1. Masking
    sc_clean = load_and_mask_data(args.sc_path, args.exclude_path)
    
    # 2. Consensus Matrix
    consensus = compute_consensus_matrix(sc_clean)
    np.save(os.path.join(args.out_dir, "co_assignment_matrix.npy"), consensus)
    
    # 3. Hierarchical Clustering (Ward's)
    dist_matrix = 1 - consensus  # Convert probability to distance
    Z = linkage(dist_matrix, method='ward')
    
    # 4. Partitioning
    module_labels = fcluster(Z, 4, criterion='maxclust')
    
    # 5. Visualization
    plot_consensus_heatmap(consensus, Z, module_labels, args.out_dir)

if __name__ == '__main__':
    main()