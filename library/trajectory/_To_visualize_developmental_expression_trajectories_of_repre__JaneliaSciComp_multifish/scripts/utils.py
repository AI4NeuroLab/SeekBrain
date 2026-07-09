"""
Utility functions for EASI-FISH Developmental Trajectory Analysis.
"""
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from pathlib import Path

def fit_gam_trajectory(group_data):
    """
    Fits a polynomial trajectory to model temporal dynamics and categorizes expression.
    """
    stage_map = {'E14': 0, 'P0': 1, 'P28': 2}
    group_data = group_data.copy()
    group_data['stage_num'] = group_data['stage'].map(stage_map)
    
    x = group_data['stage_num'].values
    y = group_data['expression'].values
    
    # Calculate simple trend based on quadratic fit
    z = np.polyfit(x, y, 2)
    
    # Logic for categorization:
    # Up: slope > 0, Down: slope < 0, Transient: curve peak/trough
    slope = z[1]
    curvature = z[0]
    
    if abs(curvature) > 0.5:
        return 'Transient'
    elif slope > 0.1:
        return 'Up'
    elif slope < -0.1:
        return 'Down'
    else:
        return 'Constant'

def visualize_trajectories(df, output_path: Path):
    """Generates and saves publication-ready plots."""
    sns.set_theme(style="whitegrid")
    g = sns.FacetGrid(df, col="lineage", sharey=False)
    g.map(sns.scatterplot, "stage", "expression")
    plt.savefig(output_path / "developmental_trajectories.pdf")
    plt.close()

def validate_input(df, required_cols):
    """Validates dataframe structure."""
    if not required_cols.issubset(df.columns):
        raise ValueError(f"Input must contain columns: {required_cols}")