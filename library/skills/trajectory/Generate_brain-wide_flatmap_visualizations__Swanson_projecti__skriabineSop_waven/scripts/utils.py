"""
Utility functions for IBL brain-wide analysis and Swanson visualization.
"""
import logging
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
from iblatlas.regions import BerylMap
from iblatlas.plots import plot_swanson

logger = logging.getLogger(__name__)

def load_and_preprocess_data(data_path: Path) -> pd.DataFrame:
    """
    Load and filter IBL BWM dataset for region-level analysis.
    """
    logger.info(f"Loading data from {data_path}...")
    # Implementation placeholder for IBL ONE-API logic
    return pd.DataFrame()

def compute_regional_metrics(data: pd.DataFrame) -> dict:
    """
    Compute statistical metrics for brain regions.
    Includes Mann-Whitney tests, trajectory distances, and GLM fits.
    """
    logger.info("Computing regional metrics...")
    # Placeholder for statistical routines
    return {
        'prop_sig': {},
        'traj_dist': {},
        'latency': {},
        'd_r2': {}
    }

def plot_swanson_panel(ax: plt.Axes, region_values: dict, title: str, cmap_name: str = 'YlGn'):
    """
    Maps regional values to Swanson projection and adds plot formatting.
    """
    # plot_swanson uses internal BerylMap mapping logic
    plot_swanson(region_values, hemisphere='right', orientation='portrait', ax=ax, cmap=cmap_name)
    ax.set_title(title)
    ax.text(0.95, 0.95, "N_sig/N_tot", transform=ax.transAxes, ha='right', va='top')