import os
import logging
import numpy as np
import bct
import scipy.cluster.hierarchy as sch
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import seaborn as sns

def load_and_mask_sc(sc_path, mask_path):
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
        ci, _ = bct.community_louvain(sc, gamma=1.0)
        partitions[:, i] = ci
        
    return bct.agreement(partitions)

def plot_modular_matrix(agreement_mat, linkage, labels, save_path):
    """Generates and saves a clustermap with module overlays."""
    g = sns.clustermap(agreement_mat, row_linkage=linkage, col_linkage=linkage, 
                       cmap="viridis", figsize=(10, 10), cbar_kws={'label': 'Co-assignment Prob'})
    
    order = g.dendrogram_row.reordered_ind
    sorted_labels = labels[order]
    
    boundaries = np.where(np.diff(sorted_labels) != 0)[0] + 1
    boundaries = np.r_[0, boundaries, len(sorted_labels)]
    
    ax = g.ax_heatmap
    for i in range(len(boundaries) - 1):
        start = boundaries[i]
        size = boundaries[i+1] - start
        rect = patches.Rectangle((start, start), size, size, 
                                 linewidth=3, edgecolor='white', facecolor='none')
        ax.add_patch(rect)
        
    plt.savefig(save_path)
    plt.close()
    logging.info(f"Plot saved to {save_path}")