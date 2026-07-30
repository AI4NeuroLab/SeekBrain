#!/usr/bin/env python3
"""
Scientific Analysis: Relationship Between Inter-Regional Connectivity and Anatomical Distance

Purpose:
    This script calculates the relationship between inter-regional connection strength 
    and anatomical distance in the larval zebrafish brain, as defined by the 
    spatial constraints research objective. It performs centroid calculation, 
    distance matrix construction, normalization of connectivity, and Pearson 
    correlation analysis.

Workflow:
    1. Calculate centroids for 72 regions from voxel masks.
    2. Compute Euclidean distance matrix (72x72).
    3. Normalize raw connection strength by total regional volumes (Si,j = Lij / (Vi + Vj)).
    4. Perform Pearson correlation analysis and visualize results.

Input Requirements:
    - regions_masks: A 3D numpy array or list of masks representing 72 regions.
    - connectivity_matrix: A 72x72 matrix of raw neurite connection lengths.
    - region_volumes: A list/array of 72 voxel counts.

"""

import os
import argparse
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
from scipy.spatial.distance import pdist, squareform

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def calculate_centroids(masks):
    """
    Calculates center of mass for each brain region.
    Step 1 of Reproduction Plan.
    """
    logging.info("Calculating centroids for brain regions...")
    centroids = []
    for i, mask in enumerate(masks):
        indices = np.argwhere(mask > 0)
        if len(indices) == 0:
            raise ValueError(f"Region {i} has no voxels.")
        centroids.append(np.mean(indices, axis=0))
    return np.array(centroids)

def compute_distance_matrix(centroids):
    """
    Step 2: Calculate Euclidean distance between all region pairs.
    """
    logging.info("Computing Euclidean distance matrix.")
    dist_flat = pdist(centroids, metric='euclidean')
    return squareform(dist_flat)

def normalize_connectivity(raw_matrix, volumes):
    """
    Step 3 & 4: Normalize by total volume of the two brain regions.
    S_ij = L_ij / (V_i + V_j)
    """
    logging.info("Normalizing connection strength.")
    n = raw_matrix.shape[0]
    normalized = np.zeros_like(raw_matrix, dtype=float)
    for i in range(n):
        for j in range(n):
            if i != j:
                normalized[i, j] = raw_matrix[i, j] / (volumes[i] + volumes[j])
    return normalized

def run_correlation(dist_matrix, strength_matrix):
    """
    Step 5: Perform Pearson correlation excluding diagonal (intra-regional).
    """
    mask = ~np.eye(dist_matrix.shape[0], dtype=bool)
    dists = dist_matrix[mask]
    strengths = strength_matrix[mask]
    
    r, p = pearsonr(dists, strengths)
    return r, p, dists, strengths

def main():
    parser = argparse.ArgumentParser(description="Zebrafish Connectivity Analysis Pipeline")
    parser.add_argument("--output", default="analysis_output", help="Directory to save outputs")
    args = parser.parse_args()

    if not os.path.exists(args.output):
        os.makedirs(args.output)

    try:
        # Mocking data for a runnable example (72 regions)
        num_regions = 72
        # Random volumes for demonstration
        volumes = np.random.randint(1000, 5000, size=num_regions)
        # Random masks (simulated centroid coordinates)
        mock_centroids = np.random.rand(num_regions, 3) * 100
        # Random raw connectivity
        raw_connectivity = np.random.gamma(shape=2, scale=100, size=(num_regions, num_regions))
        raw_connectivity = (raw_connectivity + raw_connectivity.T) / 2  # Ensure symmetry
        np.fill_diagonal(raw_connectivity, 0)

        # 1. Distances
        dist_matrix = compute_distance_matrix(mock_centroids)

        # 2. Normalization
        strength_matrix = normalize_connectivity(raw_connectivity, volumes)

        # 3. Correlation
        r, p, dists, strengths = run_correlation(dist_matrix, strength_matrix)
        logging.info(f"Analysis Complete. Pearson r: {r:.4f}, p-value: {p:.2e}")

        # 4. Plotting
        plt.figure(figsize=(8, 6))
        plt.scatter(dists, strengths, alpha=0.5, edgecolors='w')
        plt.title(f"Connection Strength vs Distance (r={r:.2f})")
        plt.xlabel("Euclidean Distance ($\mu m$)")
        plt.ylabel("Normalized Connection Strength")
        plt.grid(True, linestyle='--', alpha=0.7)
        plt.savefig(os.path.join(args.output, "distance_vs_strength.png"))
        
        # Save results
        results_df = pd.DataFrame({'Distance': dists, 'Strength': strengths})
        results_df.to_csv(os.path.join(args.output, "correlation_data.csv"), index=False)
        
        logging.info(f"Results saved to {args.output}")

    except Exception as e:
        logging.error(f"Pipeline failed: {e}")

if __name__ == '__main__':
    main()
