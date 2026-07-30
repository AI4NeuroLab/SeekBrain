"""
Utility functions for neuro-functional data analysis.
"""
import pandas as pd
import os
import seaborn as sns
import matplotlib.pyplot as plt

def load_validated_csv(data_path, required_cols):
    """Load and validate neuro-functional data."""
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Data file {data_path} not found.")
    df = pd.read_csv(data_path)
    if not set(required_cols).issubset(df.columns):
        raise ValueError(f"Missing columns. Expected: {required_cols}")
    return df

def apply_violin_plot(data, x, y, title, ax):
    """Generic violin plotting helper."""
    sns.violinplot(data=data, x=x, y=y, ax=ax)
    ax.set_title(title)
    return ax