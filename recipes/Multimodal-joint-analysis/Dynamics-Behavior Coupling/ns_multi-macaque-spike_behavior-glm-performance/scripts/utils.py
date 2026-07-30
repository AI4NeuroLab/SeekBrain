"""
Utility functions for neural data analysis pipeline.
"""
import pandas as pd
import os
import logging
import statsmodels.formula.api as smf
import matplotlib.pyplot as plt

def load_and_preprocess_data(file_path, required_columns={'contrast', 'prior', 'choice', 'fr'}):
    """Loads and validates trial-level data."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Data file not found: {file_path}")
    
    df = pd.read_csv(file_path)
    if not required_columns.issubset(df.columns):
        raise ValueError(f"Input file must contain columns: {required_columns}")
    
    logging.info(f"Data loaded from {file_path} successfully.")
    return df

def run_logistic_regression(df, formula="choice ~ contrast + prior + fr"):
    """Fits a logistic regression model using statsmodels."""
    model = smf.logit(formula, data=df).fit(disp=0)
    logging.info("Logistic Regression model fitted successfully.")
    return model

def plot_neurometric_curves(df, output_path, x_col='contrast', y_col='choice', group_col='prior'):
    """Plots behavior curves stratified by a grouping variable."""
    plt.figure(figsize=(8, 6))
    
    for group_val in df[group_col].unique():
        subset = df[df[group_col] == group_val]
        grouped = subset.groupby(x_col)[y_col].mean()
        plt.plot(grouped.index, grouped.values, 'o-', label=f"{group_col.capitalize()} {group_val}")
    
    plt.xlabel(x_col.replace('_', ' ').title())
    plt.ylabel(f"P({y_col.capitalize()})")
    plt.title(f"Neurometric Curves by {group_col.capitalize()}")
    plt.legend()
    plt.grid(True)
    
    plt.savefig(output_path)
    plt.close()
    logging.info(f"Plot saved to {output_path}")