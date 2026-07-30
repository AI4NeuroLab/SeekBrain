"""
Cerebellar Efferent Neuron Classification Pipeline

Purpose:
    This script performs hierarchical clustering on pairwise NBLAST similarity 
    scores for 121 larval zebrafish cerebellar efferent neurons.
    It replicates the clustering analysis described in the research methodology:
    - Input: Pairwise similarity matrix (from NBLAST output).
    - Method: Ward's Minimum Variance Clustering (Ward.D2).
    - Output: Cluster dendrogram, cluster assignments (CSV), and statistics.

Prerequisites:
    1. Neurons must be registered to the template brain (via MakeAverageBrain).
    2. NBLAST scores must be computed (e.g., in R via nat.nblast).
    3. Similarity matrix must be provided as a CSV.

Usage:
    python neuron_classifier.py --input similarity_matrix.csv --output_dir ./results --k 8
"""

import argparse
import logging
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from scipy.spatial.distance import squareform

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def load_similarity_matrix(filepath):
    """Loads the NBLAST matrix from CSV."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Matrix file not found: {filepath}")
    
    df = pd.read_csv(filepath, index_col=0)
    logger.info(f"Loaded {df.shape[0]}x{df.shape[1]} similarity matrix.")
    return df

def perform_clustering(similarity_df, k=8):
    """
    Performs Ward's hierarchical clustering.
    Method: Linkage uses 'ward' which is equivalent to 'ward.D2' in R.
    Distance: Defined as 1 - Similarity.
    """
    # NBLAST scores are typically 0 to 1; convert to distance
    similarity_matrix = similarity_df.values
    distance_matrix = 1.0 - similarity_matrix
    
    # Ensure symmetry and remove diagonal
    dist_sq = squareform(distance_matrix, checks=True)
    
    # Perform Ward clustering
    Z = linkage(dist_sq, method='ward')
    
    # Cut tree into k clusters
    clusters = fcluster(Z, t=k, criterion='maxclust')
    
    return Z, clusters

def save_results(clusters, index, output_dir):
    """Saves the cluster assignments to CSV."""
    os.makedirs(output_dir, exist_ok=True)
    res_df = pd.DataFrame({'Neuron_ID': index, 'Cluster': clusters})
    res_df.to_csv(os.path.join(output_dir, 'cluster_assignments.csv'), index=False)
    logger.info(f"Assignments saved to {output_dir}")

def plot_dendrogram(Z, output_dir):
    """Generates and saves the dendrogram visualization."""
    plt.figure(figsize=(15, 8))
    dendrogram(Z, leaf_rotation=90, leaf_font_size=8)
    plt.title("Morphological Classification Dendrogram (Ward's Method)")
    plt.xlabel("Neuron Index")
    plt.ylabel("Euclidean Distance (1 - NBLAST Similarity)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'dendrogram.png'))
    logger.info("Dendrogram plot saved.")

def main():
    parser = argparse.ArgumentParser(description="Classify cerebellar efferent neurons.")
    parser.add_argument("--input", required=True, help="Path to NBLAST similarity CSV.")
    parser.add_argument("--output_dir", default="./results", help="Dir for outputs.")
    parser.add_argument("--k", type=int, default=8, help="Number of clusters.")
    
    args = parser.parse_args()

    try:
        # 1. Load Data
        sim_df = load_similarity_matrix(args.input)
        
        # 2. Compute Clusters
        logger.info(f"Performing Ward's clustering into {args.k} groups...")
        Z, clusters = perform_clustering(sim_df, k=args.k)
        
        # 3. Save and Plot
        save_results(clusters, sim_df.index, args.output_dir)
        plot_dendrogram(Z, args.output_dir)
        
        logger.info("Analysis Complete.")
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")

if __name__ == '__main__':
    main()