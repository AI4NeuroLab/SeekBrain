"""
EPG Bump Encoding and Width Analysis Pipeline
---------------------------------------------
This script performs an across-fly statistical analysis to test the hypothesis 
that HD encoding accuracy correlates with EPG bump width.

Methods correspond to:
- "Methods: Data Filtering" (Velocity thresholding)
- "Methods: EPG Decoding" (Circular phase analysis)
- "Methods: HD Accuracy" (1 - Circular Variance)
- "Methods: Bump Width" (Von Mises / Circular Variance fit)

Inputs: 15 directories (one per fly) with behavior.npy and epg_traces.npy.
Outputs: population_metrics.csv, correlation_plot.pdf, and console stats.
"""

import os
import numpy as np
import pandas as pd
import scipy.stats as stats
import matplotlib.pyplot as plt
import argparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def get_circular_variance(diffs):
    """Compute circular variance of angular differences."""
    complex_sum = np.mean(np.exp(1j * diffs))
    return 1 - np.abs(complex_sum)

def estimate_bump_width(epg_data):
    """
    Computes bump width using circular standard deviation (1/kappa approx).
    Ref: Equivalent to von Mises width parameter analysis.
    """
    n_segments = epg_data.shape[1]
    angles = np.linspace(0, 2 * np.pi, n_segments, endpoint=False)
    
    # Calculate phase-weighted circular deviation
    weights = epg_data / (np.sum(epg_data, axis=1, keepdims=True) + 1e-9)
    complex_phase = np.sum(weights * np.exp(1j * angles), axis=1)
    return np.sqrt(-2 * np.log(np.abs(complex_phase)))

def analyze_fly(data_dir):
    """Load, filter, and calculate metrics for a single fly."""
    try:
        behavior = np.load(os.path.join(data_dir, 'behavior.npy'), allow_pickle=True).item()
        epg_traces = np.load(os.path.join(data_dir, 'epg_traces.npy'))
        
        # 1. Filter: Velocity > 2 mm/s
        mask = behavior['ball_velocity'] > 2.0
        if np.sum(mask) < 600: # Assuming 10Hz, <60s data
            return None
            
        filtered_epg = epg_traces[mask]
        head_angle = behavior['head_angle'][mask]
        
        # 2. Decode EPG Phase (Circular mean of segments)
        n_segments = filtered_epg.shape[1]
        angles = np.linspace(0, 2 * np.pi, n_segments, endpoint=False)
        phi_epg = np.angle(np.sum(filtered_epg * np.exp(1j * angles), axis=1))
        
        # 3. Metric A: HD Accuracy (1 - Circular Variance)
        diff = phi_epg - head_angle
        accuracy = 1 - get_circular_variance(diff)
        
        # 4. Metric B: Mean Bump Width
        widths = estimate_bump_width(filtered_epg)
        
        return {'encoding_accuracy': accuracy, 'mean_width': np.mean(widths)}
    except Exception as e:
        logging.error(f"Error processing {data_dir}: {e}")
        return None

def main(args):
    results = []
    for fly_id in range(1, 16):
        d = os.path.join(args.data_root, f"fly_{fly_id}")
        res = analyze_fly(d)
        if res:
            res['fly_id'] = fly_id
            results.append(res)
            
    df = pd.DataFrame(results)
    df.to_csv(os.path.join(args.out_dir, 'population_metrics.csv'), index=False)
    
    # 5. Pearson Correlation
    r, p = stats.pearsonr(df['encoding_accuracy'], df['mean_width'])
    slope, intercept, _, _, _ = stats.linregress(df['encoding_accuracy'], df['mean_width'])
    
    logging.info(f"Pearson r: {r:.3f}, P-value: {p:.3e}")
    
    # 6. Visualization
    plt.figure(figsize=(6, 5))
    plt.scatter(df['encoding_accuracy'], df['mean_width'], alpha=0.7)
    
    x_range = np.array([df['encoding_accuracy'].min(), df['encoding_accuracy'].max()])
    plt.plot(x_range, slope * x_range + intercept, 'r--', label='Regression')
    
    plt.xlabel('HD Encoding Accuracy ($1 - V$)')
    plt.ylabel('Mean EPG Bump Width (rad)')
    plt.title(f'N=15 Flies | r={r:.2f}, p={p:.2e}')
    plt.savefig(os.path.join(args.out_dir, 'correlation_plot.pdf'))
    plt.show()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data_root', default='./data', help='Path to fly data folders')
    parser.add_argument('--out_dir', default='./results', help='Path to save results')
    args = parser.parse_args()
    
    if not os.path.exists(args.out_dir):
        os.makedirs(args.out_dir)
        
    main(args)