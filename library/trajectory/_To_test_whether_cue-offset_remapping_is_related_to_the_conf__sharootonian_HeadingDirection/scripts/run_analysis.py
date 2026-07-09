"""
Analysis script to quantify cue-offset remapping relative to conflict.

Methodology:
1. Extract fly heading offsets from NWB-like data structures.
2. Calculate 'conflict' (offset_both - offset_initial) and 'change' (offset_final - offset_initial).
3. Use a Bayesian Linear Model (Von Mises likelihood) to regress change on conflict.
4. Visualize with scatter plots (black=Cue1, gray=Cue2) and model fit uncertainty.

Requirements: pymc, arviz, numpy, pandas, matplotlib, scipy.
"""

import os
import argparse
import logging
import numpy as np
import pandas as pd
import pymc as pm
import arviz as az
import matplotlib.pyplot as plt

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def circ_dist(a, b):
    """Calculates the signed circular distance between two angles in degrees."""
    return np.degrees(np.arctan2(np.sin(np.radians(a - b)), np.cos(np.radians(a - b))))

def load_simulated_data(n_flies=18):
    """
    Generates synthetic data representing the structure expected from 18 NWB files.
    Replace this with actual NWB parsing logic (e.g., using pynwb).
    """
    data = []
    for fly_id in range(n_flies):
        for cue_id in [1, 2]:
            # Simulate offsets (degrees)
            init = np.random.uniform(-180, 180)
            both = init + np.random.normal(0, 30)
            final = init + np.random.normal(0, 20)
            data.append({
                'fly_id': fly_id,
                'cue_label': cue_id,
                'offset_initial': init,
                'offset_both': both,
                'offset_final': final
            })
    return pd.DataFrame(data)

def run_bayesian_model(df):
    """Fits a linear model with Von Mises residuals using PyMC."""
    with pm.Model() as model:
        # Priors
        beta0 = pm.Normal('beta0', mu=0, sigma=10)
        beta1 = pm.Normal('beta1', mu=0, sigma=1)
        kappa = pm.Exponential('kappa', 0.1)

        # Expected value
        mu = beta0 + beta1 * np.radians(df['conflict'])
        
        # Likelihood
        y_obs = pm.VonMises('y_obs', mu=mu, kappa=kappa, observed=np.radians(df['change']))
        
        # Sampling
        trace = pm.sample(1000, tune=1000, target_accept=0.9, return_inferencedata=True)
    return trace

def main(args):
    # 1. Data Extraction & Preprocessing
    df = load_simulated_data()
    
    # Calculate metrics
    df['conflict'] = circ_dist(df['offset_both'], df['offset_initial'])
    df['change'] = circ_dist(df['offset_final'], df['offset_initial'])
    
    df.to_csv(os.path.join(args.output_dir, "fly_data_summary.csv"), index=False)
    logging.info(f"Processed {len(df)} fly-cue points.")

    # 2. Bayesian Modeling
    logging.info("Fitting Bayesian model...")
    trace = run_bayesian_model(df)
    summary = az.summary(trace)
    summary.to_csv(os.path.join(args.output_dir, "model_summary.csv"))
    
    # 3. Visualization
    fig, ax = plt.subplots(figsize=(6, 5))
    colors = {1: 'black', 2: 'gray'}
    
    for label, group in df.groupby('cue_label'):
        ax.scatter(group['conflict'], group['change'], c=colors[label], label=f'Cue {label}', alpha=0.7)
    
    # Plot Regression Line
    post = trace.posterior
    x_range = np.linspace(df['conflict'].min(), df['conflict'].max(), 50)
    
    b0 = post['beta0'].values.mean()
    b1 = post['beta1'].values.mean()
    y_pred = np.degrees(b0 + b1 * np.radians(x_range))
    
    ax.plot(x_range, y_pred, color='red', lw=2, label='Posterior Mean')
    
    ax.set_xlabel('Cue Conflict (deg)')
    ax.set_ylabel('Offset Change (deg)')
    ax.axhline(0, color='k', linestyle='--', lw=0.5)
    ax.axvline(0, color='k', linestyle='--', lw=0.5)
    ax.legend()
    
    plt.tight_layout()
    plt.savefig(os.path.join(args.output_dir, "remapping_scatter.png"))
    logging.info(f"Analysis complete. Results saved to {args.output_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze cue-offset remapping.")
    parser.add_argument('--output_dir', type=str, default='./results', help='Directory to save outputs')
    
    args = parser.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    
    main(args)