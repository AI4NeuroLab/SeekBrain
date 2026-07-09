"""
Utility functions for cue-offset remapping analysis.
"""
import numpy as np
import pymc as pm

def circ_dist(a, b):
    """Calculates the signed circular distance between two angles in degrees."""
    return np.degrees(np.arctan2(np.sin(np.radians(a - b)), np.cos(np.radians(a - b))))

def run_bayesian_model(df):
    """
    Fits a linear model with Von Mises residuals using PyMC.
    Expects 'conflict' and 'change' columns in degrees.
    """
    with pm.Model() as model:
        # Priors
        beta0 = pm.Normal('beta0', mu=0, sigma=10)
        beta1 = pm.Normal('beta1', mu=0, sigma=1)
        kappa = pm.Exponential('kappa', 0.1)

        # Expected value (linear regression on angles)
        mu = beta0 + beta1 * np.radians(df['conflict'])
        
        # Likelihood
        y_obs = pm.VonMises('y_obs', mu=mu, kappa=kappa, observed=np.radians(df['change']))
        
        # Sampling
        trace = pm.sample(1000, tune=1000, target_accept=0.9, return_inferencedata=True)
    return trace

def plot_remapping(df, trace, ax):
    """Generates scatter plot and regression line on a provided matplotlib axis."""
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