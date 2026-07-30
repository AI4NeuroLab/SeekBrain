"""
Neural-Behavioral Temporal Dynamics Correlation Analysis

Purpose:
    Quantify and compare the temporal persistence of neural latent dynamics 
    (inverse decay constants) with behavioral state dwell-times across 
    experimental sessions.

Methodological Reference:
    - Autocorrelation fitting for neural timescale (tau): 1/lambda = tau.
    - Behavioral Persistence: Dwell-time distribution fitting.
    - Correlation: Spearman/Pearson rank correlation of lambda vectors.

Inputs:
    - Session-specific files containing binned spike counts (neural) 
      and behavioral state durations (behavioral).
    - Metadata/Logs (run.missed_samples) for QC (Paper Method: Robustness).

Output:
    - Scatter plot (lambda_neural vs lambda_behavioral).
    - Statistical report (Pearson/Spearman r and p-values).
"""

import os
import argparse
import logging
import numpy as np
import pandas as pd
import scipy.stats as stats
from scipy.optimize import curve_fit
import matplotlib.pyplot as plt

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def exponential_decay(t, tau):
    """Exponential decay function for fitting."""
    return np.exp(-t / tau)

def get_inverse_decay_constant(time_series, dt=0.02):
    """
    Computes inverse decay constant lambda = 1/tau from autocorrelation.
    Reference: Paper Methods (Time Constants).
    """
    # Compute autocorrelation
    n = len(time_series)
    norm_series = (time_series - np.mean(time_series)) / np.std(time_series)
    acf = np.correlate(norm_series, norm_series, mode='full')[n-1:] / n
    
    # Fit exponential
    lags = np.arange(len(acf)) * dt
    # Limit fit to first 1 second for stability
    idx = int(1.0 / dt)
    popt, _ = curve_fit(exponential_decay, lags[:idx], acf[:idx], p0=[0.1])
    
    tau = popt[0]
    return 1.0 / tau if tau > 0 else np.nan

def analyze_session(neural_data, behavior_data, dt=0.02):
    """
    Performs analytical steps on a single session.
    """
    lambda_neural = get_inverse_decay_constant(neural_data, dt)
    
    # Behavioral lambda: Fit dwell-time distribution
    # Assuming behavior_data contains durations of states
    hist, bin_edges = np.histogram(behavior_data, bins=20, density=True)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    popt, _ = curve_fit(lambda x, l: l * np.exp(-l * x), bin_centers, hist, p0=[1.0])
    lambda_beh = popt[0]
    
    return lambda_neural, lambda_beh

def main():
    parser = argparse.ArgumentParser(description="Neural-Behavioral Correlation Analysis")
    parser.add_argument("--input_dir", required=True, help="Directory containing session data")
    parser.add_argument("--output_dir", required=True, help="Directory to save figures/stats")
    args = parser.parse_args()

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    session_results = []

    # Iterate through sessions (Assuming folder structure session_ID/data.csv)
    for session_folder in os.listdir(args.input_dir):
        try:
            # Load data
            # NOTE: Assumes files processed from SpikeGLX outputs per BIST_Help.md QC standards
            path = os.path.join(args.input_dir, session_folder)
            neural = np.load(os.path.join(path, 'neural_latent.npy'))
            behavior = np.load(os.path.join(path, 'behavior_dwells.npy'))
            
            l_n, l_b = analyze_session(neural, behavior)
            session_results.append({'session': session_folder, 'lambda_neural': l_n, 'lambda_beh': l_b})
            logging.info(f"Analyzed {session_folder}: N={l_n:.2f}, B={l_b:.2f}")
        except Exception as e:
            logging.error(f"Skipping {session_folder}: {e}")

    # Statistical correlation analysis
    df = pd.DataFrame(session_results)
    df.dropna(inplace=True)
    
    corr, p = stats.pearsonr(df['lambda_neural'], df['lambda_beh'])
    
    # Visualization
    plt.figure(figsize=(6, 6))
    plt.scatter(df['lambda_neural'], df['lambda_beh'], alpha=0.7)
    plt.xlabel('Neural Inverse Decay ($\lambda_{neural}$)')
    plt.ylabel('Behavioral Inverse Decay ($\lambda_{beh}$)')
    plt.title(f'Cross-Session Correlation (r={corr:.2f}, p={p:.3f})')
    plt.savefig(os.path.join(args.output_dir, 'correlation_plot.png'))
    
    # Save statistics
    df.to_csv(os.path.join(args.output_dir, 'results.csv'))
    logging.info(f"Analysis complete. Correlation: {corr}, p-value: {p}")

if __name__ == '__main__':
    main()