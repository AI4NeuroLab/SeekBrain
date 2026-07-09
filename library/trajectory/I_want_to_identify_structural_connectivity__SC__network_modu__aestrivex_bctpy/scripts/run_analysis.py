"""
Structural Connectivity Modularity Analysis
-------------------------------------------
This script performs:
1. Data cleaning based on excluded regions.
2. Iterative Louvain modularity detection to generate a co-assignment matrix.
3. Hierarchical consensus clustering (Ward's linkage) to find modules.
4. Visualization of the co-assignment matrix with a dendrogram and cluster overlays.

Dependencies: numpy, scipy, matplotlib, seaborn, bctpy.
"""

import os
import argparse
import logging
import numpy as np
import bct
import scipy.cluster.hierarchy as sch
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import seaborn as sns

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_data(sc_path, mask_path):
    """Loads SC matrix and excludes specified regions."""
    if not os.path.exists(sc_path) or not os.path.exists(mask_path):
        raise FileNotFoundError("Check input paths for SC matrix and mask.")
    
    sc = np.load(sc_path)
    mask = np.load(mask_path)
    
    # Mask regions (zero out rows and columns)
    sc[mask, :] = 0
    sc[:, mask] = 0
    logging.info(f"Loaded and masked SC matrix with shape: {sc.shape}")
    return sc

def compute_consensus_matrix(sc, iterations=1000):
    """Runs iterative Louvain and computes the co-assignment (agreement) matrix."""
    n_nodes = sc.shape[0]
    partitions = np.zeros((n_nodes, iterations), dtype=int)
    
    logging.info(f"Running {iterations} iterations of Louvain...")
    for i in range(iterations):
        # bct.community_louvain: Maximizes modularity Q
        ci, _ = bct.community_louvain(sc, gamma=1.0)
        partitions[:, i] = ci
        
    # bct.agreement: Calculates N x N co-assignment probabilities
    agreement_matrix = bct.agreement(partitions)
    return agreement_matrix

def main():
    parser = argparse.ArgumentParser(description="SC Network Modularization")
    parser.add_argument("--zebrafish_path", required=True, help="Base data directory")
    parser.add_argument("--out_dir", default="./output", help="Output directory")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    # 1. Prepare Data
    sc_file = os.path.join(args.zebrafish_path, "SC_matrix_directed_terminals_expanded.npy")
    mask_file = os.path.join(args.zebrafish_path, "Figure1_excluded_regions.npy")
    
    sc_matrix = load_data(sc_file, mask_file)

    # 2. Consensus Clustering
    agreement_mat = compute_consensus_matrix(sc_matrix)
    np.save(os.path.join(args.out_dir, "consensus_matrix.npy"), agreement_mat)

    # 3. Hierarchical Clustering
    # Convert agreement to distance (1 - similarity)
    dist_mat = 1 - agreement_mat
    linkage = sch.linkage(sch.distance.squareform(dist_mat), method='ward')
    labels = sch.fcluster(linkage, t=4, criterion='maxclust')

    # 4. Visualization
    logging.info("Generating clustermap...")
    g = sns.clustermap(agreement_mat, row_linkage=linkage, col_linkage=linkage, 
                       cmap="viridis", figsize=(10, 10), cbar_kws={'label': 'Co-assignment Prob'})
    
    # Highlight 4 modules with rectangles
    # Sort nodes by dendrogram order to place boxes correctly
    order = g.dendrogram_row.reordered_ind
    sorted_labels = labels[order]
    
    # Find block boundaries
    boundaries = np.where(np.diff(sorted_labels) != 0)[0] + 1
    boundaries = np.r_[0, boundaries, len(sorted_labels)]
    
    ax = g.ax_heatmap
    for i in range(len(boundaries) - 1):
        start = boundaries[i]
        size = boundaries[i+1] - start
        rect = patches.Rectangle((start, start), size, size, 
                                 linewidth=3, edgecolor='white', facecolor='none')
        ax.add_patch(rect)

    plt.savefig(os.path.join(args.out_dir, "SC_modules_4.png"))
    np.save(os.path.join(args.out_dir, "module_labels.npy"), labels)
    logging.info("Analysis complete. Outputs saved to " + args.out_dir)

if __name__ == '__main__':
    main()