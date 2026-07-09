"""
utils.py

Purpose:
    Reusable helper functions for circular statistics and scientific plotting/data processing.
"""

import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

def circular_diff(a, b):
    """
    Calculates signed circular difference in degrees: [-180, 180].
    
    Args:
        a (array-like): First angle(s) in degrees.
        b (array-like): Second angle(s) in degrees.
        
    Returns:
        np.ndarray: Signed circular difference.
    """
    return np.degrees(np.arctan2(np.sin(np.radians(a - b)), np.cos(np.radians(a - b))))

def setup_style():
    """Sets standard aesthetic parameters for scientific plots."""
    sns.set_theme(style="ticks", context="paper")
    plt.rcParams.update({
        'font.size': 12,
        'axes.titlesize': 14,
        'axes.labelsize': 12,
        'figure.dpi': 300
    })

def plot_circular_scatter(df, x_col, y_col, hue_col=None, palette=None):
    """
    Standardized scatter plot for circular data analysis.
    
    Args:
        df (pd.DataFrame): Data containing the plotting variables.
        x_col (str): Column name for x-axis.
        y_col (str): Column name for y-axis.
        hue_col (str, optional): Column name for grouping.
    """
    plt.figure(figsize=(6, 6))
    sns.scatterplot(data=df, x=x_col, y=y_col, hue=hue_col, palette=palette)
    plt.axhline(0, color='black', lw=0.5, linestyle='--')
    plt.axvline(0, color='black', lw=0.5, linestyle='--')
    plt.xlim(-180, 180)
    plt.ylim(-180, 180)
    plt.xlabel(x_col)
    plt.ylabel(y_col)
    return plt.gca()

def ensure_dir(directory):
    """Safely create directory if it does not exist."""
    import os
    if not os.path.exists(directory):
        os.makedirs(directory)