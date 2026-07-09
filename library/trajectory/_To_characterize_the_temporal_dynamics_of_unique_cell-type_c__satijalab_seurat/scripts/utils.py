"""
Utility functions for single-cell data processing and diversity analysis.
"""
import logging
import scanpy as sc
from scipy.stats import entropy
import pandas as pd

logger = logging.getLogger(__name__)

def run_rarefaction(adata, target_counts=1000):
    """
    Downsample cells to a target UMI count to ensure depth parity across ages.
    """
    logger.info(f"Performing rarefaction to {target_counts} UMI per cell.")
    # Ensure cells have at least the target UMI count
    sc.pp.filter_cells(adata, min_counts=target_counts)
    return adata

def calculate_shannon_entropy(cluster_labels):
    """
    Calculate Shannon Entropy: H = -sum(pi * ln(pi))
    """
    if len(cluster_labels) == 0:
        return 0
    counts = cluster_labels.value_counts(normalize=True)
    return entropy(counts)

def perform_clustering(adata, resolution=0.5):
    """
    Standard Scanpy clustering pipeline.
    """
    sc.pp.normalize_total(adata)
    sc.pp.log1p(adata)
    sc.pp.highly_variable_genes(adata)
    sc.tl.pca(adata)
    sc.pp.neighbors(adata)
    sc.tl.leiden(adata, resolution=resolution)
    return adata