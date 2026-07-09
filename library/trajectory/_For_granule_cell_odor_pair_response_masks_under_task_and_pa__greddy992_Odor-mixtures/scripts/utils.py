"""
utils.py

Provides reusable utility functions for loading scientific datasets, 
computing response metrics, and generating standardized visualizations.
"""

import numpy as np
import matplotlib.pyplot as plt
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

def load_npy_files(data_dir, file_mapping):
    """
    Loads a dictionary of .npy files from a specified directory.
    
    Args:
        data_dir (str/Path): Directory containing the files.
        file_mapping (dict): Dictionary mapping keys to filenames.
        
    Returns:
        dict: Loaded numpy arrays.
    """
    loaded_data = {}
    for key, filename in file_mapping.items():
        path = Path(data_dir) / filename
        if not path.exists():
            logger.error(f"Missing required data file: {filename}")
            sys.exit(1)
        loaded_data[key] = np.load(path)
        logger.info(f"Loaded {filename} with shape {loaded_data[key].shape}")
    return loaded_data

def compute_categorical_distribution(exc_array, sup_array):
    """
    Computes percentages for a tripartite classification system.
    
    Args:
        exc_array (np.ndarray): Binary mask for excitation.
        sup_array (np.ndarray): Binary mask for suppression.
        
    Returns:
        list: [percent_exc, percent_sup, percent_non]
    """
    total_elements = exc_array.size
    n_exc = np.sum(exc_array)
    n_sup = np.sum(sup_array)
    
    if np.any((exc_array == 1) & (sup_array == 1)):
        logger.warning("Mask overlap detected: some entries marked both excited and suppressed.")
        
    p_exc = (n_exc / total_elements) * 100
    p_sup = (n_sup / total_elements) * 100
    p_non = 100 - p_exc - p_sup
    
    return [p_exc, p_sup, p_non]

def plot_side_by_side_pie(data_list, titles, labels, colors, output_path):
    """
    Generates side-by-side pie charts for comparative analysis.
    
    Args:
        data_list (list of lists): Statistics for each pie chart.
        titles (list): Titles for the subplots.
        labels (list): Segment labels.
        colors (list): Segment colors.
        output_path (str): File path to save the resulting figure.
    """
    fig, axes = plt.subplots(1, len(data_list), figsize=(6 * len(data_list), 6))
    
    for i, ax in enumerate(axes):
        ax.pie(data_list[i], labels=labels, autopct='%1.1f%%', colors=colors, startangle=140)
        ax.set_title(titles[i])
    
    plt.tight_layout()
    plt.savefig(output_path)
    logger.info(f"Figure saved to {output_path}")