"""
Utility functions for Zebrafish Structural Connectivity Analysis.
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import logging

logger = logging.getLogger(__name__)

def generate_bilateral_matrix(unilateral_matrix):
    """Concatenate unilateral sub-matrices into a bilateral structure."""
    n = unilateral_matrix.shape[0]
    top = np.hstack((unilateral_matrix, unilateral_matrix))
    bot = np.hstack((unilateral_matrix, unilateral_matrix))
    return np.vstack((top, bot))

def filter_regions(matrix, centroids, excluded_ids):
    """Remove specific nodes (bilateral) from matrix and coordinate arrays."""
    n = centroids.shape[0] // 2
    to_remove = [idx for i in excluded_ids for idx in (i, i + n)]
    
    filtered_matrix = np.delete(matrix, to_remove, axis=0)
    filtered_matrix = np.delete(filtered_matrix, to_remove, axis=1)
    filtered_centroids = np.delete(centroids, to_remove, axis=0)
    
    return filtered_matrix, filtered_centroids

def adjust_coordinates(centroids, img_height):
    """Align spatial coordinates with image orientation (y-axis flip)."""
    coords = centroids.copy()
    coords[:, 1] = img_height - coords[:, 1]
    return coords

def plot_network_overlay(matrix, centroids, img_path, output_path, threshold=0.01):
    """Render network edges and nodes onto a background atlas image."""
    img = mpimg.imread(img_path)
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.imshow(img, cmap='gray')
    
    max_val = np.max(matrix)
    for i in range(len(centroids)):
        for j in range(i + 1, len(centroids)):
            weight = matrix[i, j]
            if weight > threshold:
                ax.plot([centroids[i, 0], centroids[j, 0]], 
                        [centroids[i, 1], centroids[j, 1]], 
                        color='red', alpha=0.3 * (weight / max_val), linewidth=0.5)
    
    ax.scatter(centroids[:, 0], centroids[:, 1], s=5, c='blue', alpha=0.6)
    plt.savefig(output_path)
    plt.close(fig)
    logger.info(f"Visualization saved: {output_path}")