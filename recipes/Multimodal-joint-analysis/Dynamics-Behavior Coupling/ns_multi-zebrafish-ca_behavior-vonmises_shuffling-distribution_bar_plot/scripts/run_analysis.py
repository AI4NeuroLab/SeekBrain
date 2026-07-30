#!/usr/bin/env python3
"""
Bump Stability Statistical Analysis Script
==========================================

This script performs statistical validation of neural bump phase-locking to external 
scene orientation, as described in the ring-attractor model research. 

It calculates the concentration parameter (kappa) of the bump-scene offset 
using circular statistics and compares it against a shuffled null distribution.

Paper Reference: 
- Results/Methods: Bump Stability and Circular Statistics
- Repo Reference: Encoding_Certainty_Functions.py (for model understanding)
- Repo Reference: SampleCode_Stochastic.ipynb (for noise epoch handling)

Usage:
    python bump_stability_analysis.py --data_path <path> --output_dir <path>
"""

import numpy as np
import scipy.stats as stats
import matplotlib.pyplot as plt
import argparse
import logging
import os
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def compute_circular_offset(phi_bump, theta_scene):
    """
    Compute circular difference within range [-pi, pi].
    Method: (phi - theta + pi) % (2*pi) - pi
    """
    return (phi_bump - theta_scene + np.pi) % (2 * np.pi) - np.pi

def get_vonmises_kappa(data):
    """
    Fit von Mises distribution to circular data.
    Returns the concentration parameter kappa.
    """
    # vonmises.fit returns (mu, kappa)
    _, kappa = stats.vonmises.fit(data, fscale=1)
    return kappa

def run_shuffle_test(phi_bump, theta_scene, n_shuffles=1000):
    """
    Perform circular shuffling to estimate the null distribution of kappa.
    The shuffle maintains temporal correlations by using a large random block shift.
    """
    n_samples = len(phi_bump)
    null_kappas = []
    
    # Pre-calculate circular buffer to avoid repeated operations
    for _ in range(n_shuffles):
        # Shift bump phase by random lag > 5 seconds (assuming 10Hz sampling -> lag > 50)
        lag = np.random.randint(50, n_samples - 50)
        phi_shuffled = np.roll(phi_bump, lag)
        
        offset = compute_circular_offset(phi_shuffled, theta_scene)
        null_kappas.append(get_vonmises_kappa(offset))
        
    return np.array(null_kappas)

def analyze_condition(phi_bump, theta_scene, condition_name):
    """Runs full pipeline for a given condition."""
    logger.info(f"Analyzing condition: {condition_name}")
    
    # 1. Compute empirical offset
    offset = compute_circular_offset(phi_bump, theta_scene)
    kappa_exp = get_vonmises_kappa(offset)
    
    # 2. Shuffle for null distribution
    null_kappas = run_shuffle_test(phi_bump, theta_scene)
    
    k_median = np.median(null_kappas)
    k_95 = np.percentile(null_kappas, 95)
    
    return kappa_exp, k_median, k_95

def main(args):
    # Create directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Mock data generation (Replace with file loading in production)
    # In reality, load from data_path using numpy or pandas
    t = np.linspace(0, 100, 1000)
    phi_bump = np.sin(0.1 * t) + np.random.normal(0, 0.2, 1000)
    theta_scene = np.sin(0.1 * t)
    
    # Analysis
    k_exp, k_med, k_95 = analyze_condition(phi_bump, theta_scene, "Jump Epoch")
    
    # Plotting
    plt.figure(figsize=(6, 6))
    conditions = ['Empirical', 'Shuffle Median', 'Shuffle 95th']
    values = [k_exp, k_med, k_95]
    colors = ['tab:purple', 'tab:gray', 'tab:red']
    
    plt.bar(conditions, values, color=colors)
    plt.ylabel('Concentration Parameter ($\kappa$)')
    plt.title('Bump Phase Stability Validation')
    
    output_file = Path(args.output_dir) / "stability_plot.png"
    plt.savefig(output_file)
    logger.info(f"Analysis complete. Plot saved to {output_file}")
    
    # Summary report
    print(f"\n--- Statistics for Jump Epoch ---")
    print(f"Experimental Kappa: {k_exp:.4f}")
    print(f"Shuffle 95th Percentile: {k_95:.4f}")
    if k_exp > k_95:
        print("Result: Significant phase locking detected.")
    else:
        print("Result: No significant phase locking detected.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze bump stability in zebrafish data.")
    parser.add_argument("--data_path", type=str, required=True, help="Path to experimental data.")
    parser.add_argument("--output_dir", type=str, default="results", help="Directory for plots and logs.")
    
    args = parser.parse_args()
    
    try:
        main(args)
    except Exception as e:
        logger.error(f"Execution failed: {e}")