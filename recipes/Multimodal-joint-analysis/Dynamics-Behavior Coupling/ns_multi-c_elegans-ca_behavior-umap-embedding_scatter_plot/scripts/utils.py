"""
Utility module for neural manifold analysis.
Provides reusable functions for UMAP embedding, data framing, and visualization.
"""

import numpy as np
import pandas as pd
import umap
import matplotlib.pyplot as plt
import seaborn as sns
import logging

def perform_umap_embedding(data: np.ndarray, n_neighbors: int = 30, random_state: int = 42) -> np.ndarray:
    """Perform UMAP dimensionality reduction."""
    logging.info(f"Computing UMAP with n_neighbors={n_neighbors}...")
    reducer = umap.UMAP(n_neighbors=n_neighbors, min_dist=0.1, random_state=random_state)
    return reducer.fit_transform(data)

def integrate_data(umap_coords: np.ndarray, tuning_indices: np.ndarray) -> pd.DataFrame:
    """Convert raw coordinates and metadata into a DataFrame."""
    return pd.DataFrame({
        'UMAP_1': umap_coords[:, 0],
        'UMAP_2': umap_coords[:, 1],
        'tuning_index': tuning_indices
    })

def visualize_manifold(df: pd.DataFrame, output_path: str, title: str = "Neural Tuning in Manifold"):
    """Plot UMAP coordinates colored by continuous tuning index."""
    logging.info(f"Generating visualization at {output_path}...")
    plt.figure(figsize=(10, 8))
    
    scatter = sns.scatterplot(
        data=df, x='UMAP_1', y='UMAP_2', 
        hue='tuning_index', palette='vlag', 
        alpha=0.6, s=15, edgecolor=None
    )
    
    plt.title(title)
    plt.colorbar(scatter.collections[0], label='Tuning Index')
    plt.savefig(output_path, dpi=300)
    plt.close()