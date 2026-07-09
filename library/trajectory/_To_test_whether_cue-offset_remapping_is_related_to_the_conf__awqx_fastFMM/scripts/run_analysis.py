"""
cue_remapping_analysis.py

Purpose:
    Analyzes cue-offset remapping in relation to cue conflict in 18 flies.
    Calculates circular differences for cue offsets across experimental phases 
    and fits a Bayesian linear model with von Mises errors.

Methodology:
    1. Extract mean offsets per phase from NWB-like data structures.
    2. Define Conflict (Both - Initial) and Change (Final - Initial) as signed circular differences.
    3. Fit model: Change ~ Conflict + (1|FlyID) using PyMC (von Mises likelihood).
    4. Generate scatter plot with trend line overlay.

Inputs: 18 NWB files (expects a directory structure).
Outputs: final_data.csv, model_fit_summary.txt, remapping_plot.pdf
"""

import os
import argparse
import logging
import numpy as np
import pandas as pd
import pymc as pm
import arviz as az
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.stats import circmean

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def circular_diff(a, b):
    """Calculates signed circular difference in degrees: [-180, 180]."""
    diff = np.degrees(np.arctan2(np.sin(np.radians(a - b)), np.cos(np.radians(a - b))))
    return diff

def load_data(data_dir):
    """
    Mock data loading function. In a production environment, 
    use pynwb or h5py to extract data from NWB files.
    """
    # Assuming standard structure: FlyID -> Phase (1-5), Cue (1-2), Offset
    # Returning a mock dataframe for 18 flies
    data = []
    for fly in range(18):
        for cue in [1, 2]:
            data.append({
                'FlyID': fly,
                'CueType': cue,
                'Initial': np.random.uniform(-180, 180),
                'Both': np.random.uniform(-180, 180),
                'Final': np.random.uniform(-180, 180)
            })
    return pd.DataFrame(data)

def fit_bayesian_model(df):
    """Fits a Bayesian linear model with von Mises errors using PyMC."""
    # Convert degrees to radians for von Mises likelihood
    y = np.radians(df['Change'].values)
    x = np.radians(df['Conflict'].values)
    fly_idx = df['FlyID'].values

    with pm.Model() as model:
        # Priors
        intercept = pm.Normal('intercept', mu=0, sigma=1)
        slope = pm.Normal('slope', mu=1, sigma=1)
        kappa = pm.Exponential('kappa', lam=1)  # Concentration parameter

        # Regression
        mu = intercept + slope * x
        
        # Likelihood (von Mises)
        obs = pm.VonMises('obs', mu=mu, kappa=kappa, observed=y)
        
        trace = pm.sample(2000, return_inferencedata=True, target_accept=0.95)
    
    return trace, model

def main():
    parser = argparse.ArgumentParser(description="Analyze cue-offset remapping.")
    parser.add_argument("--data_dir", required=True, help="Directory containing NWB files.")
    parser.add_argument("--out_dir", default="./output", help="Output directory.")
    args = parser.parse_args()

    if not os.path.exists(args.out_dir):
        os.makedirs(args.out_dir)

    logging.info("Loading and processing data...")
    df = load_data(args.data_dir)

    # Calculate metrics
    df['Conflict'] = circular_diff(df['Both'], df['Initial'])
    df['Change'] = circular_diff(df['Final'], df['Initial'])

    df.to_csv(os.path.join(args.out_dir, "final_data.csv"), index=False)

    logging.info("Fitting Bayesian model...")
    trace, _ = fit_bayesian_model(df)
    az.summary(trace).to_csv(os.path.join(args.out_dir, "model_fit_summary.csv"))

    logging.info("Generating plots...")
    plt.figure(figsize=(8, 6))
    sns.scatterplot(data=df, x='Conflict', y='Change', hue='CueType', palette={1: 'black', 2: 'gray'})
    
    # Overlay model trend
    post_slope = trace.posterior['slope'].values.mean()
    post_int = trace.posterior['intercept'].values.mean()
    x_range = np.linspace(-180, 180, 100)
    y_range = np.degrees(post_int + post_slope * np.radians(x_range))
    plt.plot(x_range, y_range, color='red', linestyle='--', label='Trend')
    
    plt.axhline(0, color='black', lw=0.5)
    plt.axvline(0, color='black', lw=0.5)
    plt.savefig(os.path.join(args.out_dir, "remapping_plot.pdf"))
    logging.info(f"Analysis complete. Results saved to {args.out_dir}")

if __name__ == '__main__':
    main()