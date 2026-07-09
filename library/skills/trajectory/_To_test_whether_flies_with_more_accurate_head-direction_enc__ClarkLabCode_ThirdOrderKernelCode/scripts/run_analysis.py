#!/usr/bin/env python3
"""
Analysis of Head-Direction (HD) Encoding Accuracy vs. EPG Bump Width.

Purpose:
    Examines the relationship between HD encoding accuracy and EPG bump width 
    in Drosophila under low-contrast (dim-cue) conditions during movement.
    
References:
    - Biological context: Studies in Drosophila navigation (e.g., Green et al., 2017).
    - Statistical approach: Pearson correlation of per-fly aggregate metrics.
    - Repositories: Incorporates standard scipy/numpy analysis, conceptually 
      aligned with ITE-based dependency analysis for non-linear checks.

Outputs:
    - Scatter plot (PNG) with regression line and Pearson p-value.
    - CSV file containing the per-fly data.
    - Console logs of statistical significance.
"""

import os
import argparse
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import pearsonr, linregress
from scipy.optimize import curve_fit
from astropy.stats import circvar

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def von_mises(x, mu, kappa, amplitude, baseline):
    """Von Mises distribution function for EPG bump fitting."""
    return amplitude * np.exp(kappa * np.cos(x - mu)) / (2 * np.pi * np.i0(kappa)) + baseline

def fit_bump_width(activity_profile):
    """
    Fits activity profile to Von Mises distribution.
    Returns kappa (concentration), where width is inversely proportional to kappa.
    """
    x = np.linspace(-np.pi, np.pi, len(activity_profile))
    try:
        popt, _ = curve_fit(von_mises, x, activity_profile, p0=[0, 1, 1, 0])
        return popt[1]  # Return kappa
    except:
        return np.nan

def compute_hd_accuracy(bump_phase, hd_angle):
    """Computes 1 - circular variance of the phase offset."""
    offset = (bump_phase - hd_angle) % (2 * np.pi)
    cv = circvar(offset)
    return 1 - cv

def analyze_fly_data(activity_data, hd_data, vel_data, vel_threshold=20):
    """Processes single fly data during movement periods."""
    mask = vel_data > vel_threshold
    
    if np.sum(mask) == 0:
        return None, None
    
    valid_activity = activity_data[mask]
    valid_hd = hd_data[mask]
    
    # Calculate kappa for each time point
    kappas = [fit_bump_width(profile) for profile in valid_activity]
    # Calculate accuracy
    accuracies = [compute_hd_accuracy(p, h) for p, h in zip(valid_activity.argmax(axis=1), valid_hd)]
    
    return np.nanmean(kappas), np.nanmean(accuracies)

def main(args):
    # 1. Load data placeholders (Simulated for reproducibility)
    # In practice: load from CSV/HDF5 per fly (N=15)
    flies_data = []
    for i in range(15):
        # Simulated data for demonstration
        activity = np.random.rand(100, 8) 
        hd = np.random.uniform(0, 2*np.pi, 100)
        vel = np.random.uniform(0, 50, 100)
        
        k, acc = analyze_fly_data(activity, hd, vel)
        if k is not None:
            flies_data.append({'fly_id': i, 'bump_kappa': k, 'accuracy': acc})
            
    df = pd.DataFrame(flies_data)
    df.to_csv(os.path.join(args.output_dir, 'fly_metrics.csv'), index=False)
    
    # 2. Statistical Testing
    r, p = pearsonr(df['accuracy'], df['bump_kappa'])
    logging.info(f"Pearson Correlation: r={r:.3f}, p={p:.4f}")
    
    # 3. Visualization
    plt.figure(figsize=(6, 5))
    slope, intercept, _, _, _ = linregress(df['accuracy'], df['bump_kappa'])
    x_range = np.linspace(df['accuracy'].min(), df['accuracy'].max(), 100)
    
    plt.scatter(df['accuracy'], df['bump_kappa'], color='k', alpha=0.7)
    plt.plot(x_range, slope * x_range + intercept, color='r', linestyle='--')
    plt.xlabel('HD Encoding Accuracy (1 - CircVar)')
    plt.ylabel('Mean Bump Concentration ($\kappa$)')
    plt.title(f'N=15 Flies: Correlation\nPearson P = {p:.4f}')
    
    plt.savefig(os.path.join(args.output_dir, 'hd_accuracy_vs_width.png'))
    logging.info(f"Results saved to {args.output_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze fly HD encoding vs bump width.")
    parser.add_argument('--output_dir', type=str, default='./results', help='Directory to save outputs')
    args = parser.parse_args()
    
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
        
    main(args)