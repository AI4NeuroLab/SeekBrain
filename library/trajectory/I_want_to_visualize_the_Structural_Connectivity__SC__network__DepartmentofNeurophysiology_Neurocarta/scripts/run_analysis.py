#!/usr/bin/env python3
"""
Zebrafish Structural Connectivity (SC) Network Visualization

This script visualizes the SC network on zebrafish brain atlas projections.
It performs bilateral matrix expansion, region filtering based on excluded 
sets, coordinate transformation, and network plotting.

Methodological basis:
- Bilateral expansion: Based on Neurocarta's 'loadmap' logic (concatenating sub-matrices).
- Filtering: Based on Neurocarta's 'filtermap' logic.
- Visualization: Custom implementation of structural connectivity overlays.

Inputs:
- SC_matrix_undirected_terminals_expanded.npy
- Figure1_excluded_regions.npy
- centroids.npy
- background_top.png
- background_side.png
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import argparse
import logging
import os
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def generate_bilateral_matrix(unilateral_matrix):
    """Step 1: Bilateral Matrix Generation."""
    logger.info("Generating bilateral matrix...")
    n = unilateral_matrix.shape[0]
    # Create block matrix [[U, U], [U, U]]
    top = np.hstack((unilateral_matrix, unilateral_matrix))
    bot = np.hstack((unilateral_matrix, unilateral_matrix))
    bilateral = np.vstack((top, bot))
    return bilateral

def filter_regions(matrix, centroids, excluded_ids):
    """Step 2: Region Filtering."""
    logger.info(f"Filtering {len(excluded_ids)} regions...")
    n = centroids.shape[0] // 2
    
    # Generate full list of indices to remove (bilateral)
    to_remove = []
    for idx in excluded_ids:
        to_remove.append(idx)     # Left
        to_remove.append(idx + n) # Right
    
    filtered_matrix = np.delete(matrix, to_remove, axis=0)
    filtered_matrix = np.delete(filtered_matrix, to_remove, axis=1)
    
    filtered_centroids = np.delete(centroids, to_remove, axis=0)
    
    return filtered_matrix, filtered_centroids

def adjust_coordinates(centroids, img_height):
    """Step 3: Coordinate Alignment (y-axis flip)."""
    # Assuming centroids[:, 1] is Y
    centroids[:, 1] = img_height - centroids[:, 1]
    return centroids

def visualize_network(matrix, centroids, img_path, output_path, threshold=0.01):
    """Step 4: Edge Mapping and Rendering."""
    logger.info(f"Rendering network on {img_path}...")
    img = mpimg.imread(img_path)
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.imshow(img, cmap='gray')
    
    # Normalize matrix for visualization
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
    logger.info(f"Saved visualization to {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Visualize Zebrafish SC Network")
    parser.add_argument("--data_dir", required=True, help="Directory containing data files")
    parser.add_argument("--out_dir", required=True, help="Directory to save outputs")
    args = parser.parse_args()

    try:
        # Load data
        sc_uni = np.load(os.path.join(args.data_dir, "SC_matrix_undirected_terminals_expanded.npy"))
        excluded = np.load(os.path.join(args.data_dir, "Figure1_excluded_regions.npy"))
        coords = np.load(os.path.join(args.data_dir, "centroids.npy"))
        
        # Process
        bilateral_m = generate_bilateral_matrix(sc_uni)
        filtered_m, filtered_c = filter_regions(bilateral_m, coords, excluded)
        
        # Visualize Top
        img_top = mpimg.imread(os.path.join(args.data_dir, "background_top.png"))
        c_top = adjust_coordinates(filtered_c.copy(), img_top.shape[0])
        visualize_network(filtered_m, c_top[:, :2], 
                          os.path.join(args.data_dir, "background_top.png"), 
                          os.path.join(args.out_dir, "SC_top_view.png"))

        # Visualize Side
        img_side = mpimg.imread(os.path.join(args.data_dir, "background_side.png"))
        c_side = adjust_coordinates(filtered_c.copy(), img_side.shape[0])
        # Use X and Z for side view projection
        visualize_network(filtered_m, c_side[:, [0, 2]], 
                          os.path.join(args.data_dir, "background_side.png"), 
                          os.path.join(args.out_dir, "SC_side_view.png"))

    except Exception as e:
        logger.error(f"Execution failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()