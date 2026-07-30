import numpy as np
import logging
from scipy.spatial.distance import pdist, squareform
from scipy.stats import pearsonr

def calculate_centroids(masks):
    """Calculates center of mass for each brain region mask."""
    logging.info("Calculating centroids for brain regions...")
    centroids = []
    for i, mask in enumerate(masks):
        indices = np.argwhere(mask > 0)
        if len(indices) == 0:
            raise ValueError(f"Region {i} has no voxels.")
        centroids.append(np.mean(indices, axis=0))
    return np.array(centroids)

def compute_distance_matrix(centroids):
    """Computes Euclidean distance matrix from centroids."""
    logging.info("Computing Euclidean distance matrix.")
    dist_flat = pdist(centroids, metric='euclidean')
    return squareform(dist_flat)

def normalize_connectivity(raw_matrix, volumes):
    """Normalizes connection strength: S_ij = L_ij / (V_i + V_j)."""
    logging.info("Normalizing connection strength.")
    n = raw_matrix.shape[0]
    # Vectorized normalization
    vol_sum = volumes[:, np.newaxis] + volumes[np.newaxis, :]
    normalized = np.divide(raw_matrix, vol_sum, out=np.zeros_like(raw_matrix), where=vol_sum!=0)
    return normalized

def run_correlation(dist_matrix, strength_matrix):
    """Calculates Pearson correlation excluding the diagonal."""
    mask = ~np.eye(dist_matrix.shape[0], dtype=bool)
    dists = dist_matrix[mask]
    strengths = strength_matrix[mask]
    r, p = pearsonr(dists, strengths)
    return r, p, dists, strengths