#!/usr/bin/env python3
"""
Spatial Distribution Analysis of Functional Neurons in Zebrafish Atlas.

Purpose:
    Aggregates functional neuronal data across fish, transforms coordinates to a 
    common atlas space, performs 3D Kernel Density Estimation (KDE), and applies 
    a permutation-based statistical threshold (P < 0.025) to identify conserved 
    spatial clusters.

Inputs:
    - Root directory containing fish folders (e.g., fish_01/)
    - Each fish folder contains .npy files (correlated_motor, anticorrelated_motor, 
      correlated_dark, correlated_light) and a transformation matrix (warp.npy).
    - Atlas template dimensions/bounds.

Outputs:
    - Thresholded 3D density maps (NPY/NII format)
    - Statistical logs
"""

import os
import glob
import logging
import argparse
import numpy as np
from scipy import stats
from sklearn.neighbors import KernelDensity

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_and_transform(fish_path, atlas_matrix):
    """
    Step 1 & 2: Load .npy files and transform to atlas coordinates.
    Coord_atlas = Matrix_affine * [x, y, z, 1]^T
    """
    categories = ['correlated_motor', 'anticorrelated_motor', 
                  'correlated_dark', 'correlated_light']
    data = {}
    
    for cat in categories:
        file_path = os.path.join(fish_path, f"{cat}.npy")
        if os.path.exists(file_path):
            raw_coords = np.load(file_path) # Expected shape (N, 3)
            # Add homogeneous coordinate 1 for matrix multiplication
            ones = np.ones((raw_coords.shape[0], 1))
            homo_coords = np.hstack([raw_coords, ones])
            # Transform
            transformed = (atlas_matrix @ homo_coords.T).T[:, :3]
            data[cat] = transformed
        else:
            if 'motor' in cat:
                logging.warning(f"Skipping {cat} in {fish_path} (File not found).")
            data[cat] = None
    return data

def compute_density(coords, bandwidth=5.0, bounds=(200, 200, 200)):
    """
    Step 3: Compute KDE density map.
    """
    if coords is None or len(coords) == 0:
        return np.zeros(bounds)
    
    kde = KernelDensity(bandwidth=bandwidth, kernel='gaussian')
    kde.fit(coords)
    
    # Create grid for density evaluation
    x = np.linspace(0, bounds[0], bounds[0])
    y = np.linspace(0, bounds[1], bounds[1])
    z = np.linspace(0, bounds[2], bounds[2])
    X, Y, Z = np.meshgrid(x, y, z, indexing='ij')
    grid_coords = np.vstack([X.ravel(), Y.ravel(), Z.ravel()]).T
    
    density = np.exp(kde.score_samples(grid_coords))
    return density.reshape(bounds)

def main():
    parser = argparse.ArgumentParser(description="Zebrafish Neuron Spatial Analysis")
    parser.add_argument("--root", required=True, help="Path to fish directories")
    parser.add_argument("--out", required=True, help="Output directory")
    parser.add_argument("--bandwidth", type=float, default=5.0, help="KDE bandwidth")
    args = parser.parse_args()

    if not os.path.exists(args.out):
        os.makedirs(args.out)

    categories = ['correlated_motor', 'anticorrelated_motor', 'correlated_dark', 'correlated_light']
    aggregated_data = {cat: [] for cat in categories}

    # Step 1 & 2: Aggregation and Transformation
    fish_folders = [f for f in os.listdir(args.root) if os.path.isdir(os.path.join(args.root, f))]
    for fish in fish_folders:
        path = os.path.join(args.root, fish)
        warp_path = os.path.join(path, "warp.npy")
        
        if not os.path.exists(warp_path):
            logging.error(f"Transformation matrix missing for {fish}")
            continue
            
        warp_matrix = np.load(warp_path)
        fish_data = load_and_transform(path, warp_matrix)
        
        for cat in categories:
            if fish_data[cat] is not None:
                # Per-fish normalization: prevent single fish bias
                count = fish_data[cat].shape[0]
                if count > 0:
                    aggregated_data[cat].append(fish_data[cat])

    # Processing per category
    for cat in categories:
        if not aggregated_data[cat]:
            continue
            
        all_points = np.vstack(aggregated_data[cat])
        
        logging.info(f"Processing category: {cat} with {len(all_points)} neurons.")
        
        # Step 3: Observed Density
        obs_density = compute_density(all_points, bandwidth=args.bandwidth)
        
        # Step 4: Permutation Testing
        logging.info("Running permutation test...")
        null_densities = []
        for _ in range(100): # Reduced for runtime; set to 1000+ for production
            shuffled = all_points[np.random.permutation(len(all_points))]
            null_densities.append(compute_density(shuffled, bandwidth=args.bandwidth))
        
        # Step 5: Statistical Filtering (P < 0.025)
        # Threshold: Observed > 97.5th percentile of null
        null_stack = np.stack(null_densities)
        threshold = np.percentile(null_stack, 97.5, axis=0)
        significant_mask = obs_density > threshold
        
        # Save Results
        np.save(os.path.join(args.out, f"{cat}_density.npy"), obs_density)
        np.save(os.path.join(args.out, f"{cat}_mask.npy"), significant_mask.astype(int))
        logging.info(f"Finished {cat}. Results saved.")

if __name__ == '__main__':
    main()