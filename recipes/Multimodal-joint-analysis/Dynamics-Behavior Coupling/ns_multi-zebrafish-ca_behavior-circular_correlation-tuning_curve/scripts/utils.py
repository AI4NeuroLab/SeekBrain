"""
utils.py

Reusable helper functions for neural bump phase analysis.
"""

import os
import logging
import pandas as pd
import numpy as np

def load_and_validate_data(data_path, required_cols=None):
    """Loads experimental data and performs basic validation."""
    if required_cols is None:
        required_cols = {'timestamp', 'bump_phase', 'scene_theta', 'epoch'}
        
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Data file not found: {data_path}")
    
    df = pd.read_csv(data_path)
    if not required_cols.issubset(df.columns):
        raise ValueError(f"Missing required columns. Expected {required_cols}")
    
    return df

def wrap_to_2pi(series):
    """Ensures data is mapped to [0, 2π] range."""
    return series % (2 * np.pi)

def setup_directory(directory):
    """Ensures output directory exists."""
    os.makedirs(directory, exist_ok=True)
    return directory