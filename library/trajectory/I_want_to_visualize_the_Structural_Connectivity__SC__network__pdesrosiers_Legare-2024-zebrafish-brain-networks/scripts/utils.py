"""
Utilities for Zebrafish Brain Atlas Structural Connectivity Processing.
"""
import numpy as np
import os
import logging

def load_data(file_path):
    """Loads numpy data files."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Data file not found: {file_path}")
    return np.load(file_path)

def bilateralize_matrix(sc_unilateral):
    """
    Creates a bilateral SC matrix (2N x 2N) from a unilateral SC matrix (N x N).
    """
    logging.info("Bilateralizing structural connectivity matrix.")
    return np.block([[sc_unilateral, sc_unilateral], [sc_unilateral, sc_unilateral]])

def clean_data(sc_matrix, centroids, excluded_indices):
    """
    Removes excluded regions from both the bilateral matrix and centroid list.
    """
    logging.info(f"Removing {len(excluded_indices)} regions from {sc_matrix.shape[0]} total.")
    all_excluded = np.concatenate([excluded_indices, np.array(excluded_indices) + 70])
    
    sc_final = np.delete(sc_matrix, all_excluded, axis=0)
    sc_final = np.delete(sc_final, all_excluded, axis=1)
    
    centroids_final = np.delete(centroids, all_excluded, axis=0)
    
    return sc_final, centroids_final

def transform_centroids(centroids, y_offset=974):
    """Applies ZBB atlas coordinate transformation."""
    transformed = centroids.copy()
    transformed[:, 1] = y_offset - transformed[:, 1]
    return transformed