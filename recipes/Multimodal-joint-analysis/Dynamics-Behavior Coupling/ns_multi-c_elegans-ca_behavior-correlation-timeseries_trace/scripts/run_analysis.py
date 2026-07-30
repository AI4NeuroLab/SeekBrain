#!/usr/bin/env python3
"""
Multi-Timescale Velocity Encoding Analysis
------------------------------------------
This script reproduces the analysis of individual neurons encoding velocity 
over different timescales. It binning spikes, filters velocity with causal 
exponential kernels of varying decay constants, and correlates the two to 
identify the optimal integration timescale for each neuron.

Reference: Based on standard methods for analyzing velocity-tuned populations 
in spatial navigation studies.

Input: Synthetic spike trains and animal trajectory.
Output: Correlation heatmap (Neurons x Tau), Example traces, and Tau distribution.
"""

import numpy as np
import scipy.signal as signal
import matplotlib.pyplot as plt
import argparse
import logging
import os
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def generate_synthetic_data(n_neurons=50, n_samples=5000, dt=0.02):
    """Generates synthetic animal trajectory and spiking data."""
    t = np.arange(n_samples) * dt
    # Smooth velocity profile
    v = np.abs(np.cumsum(np.random.randn(n_samples)) * 0.1 + 2.0)
    
    spike_times = []
    # Assign each neuron a ground-truth preferred timescale
    pref_taus = np.logspace(-1, 1, n_neurons) 
    
    for tau in pref_taus:
        # Firing rate tracks filtered velocity + some noise
        filt_v = signal.lfilter([1/tau], [1, -1 + 1/tau], v)
        rate = np.maximum(0, (filt_v - np.mean(filt_v)) * 5 + 10)
        spikes = np.random.poisson(rate * dt)
        spike_times.append(spikes)
    
    return np.array(spike_times), v, t

def compute_filtered_velocity(v, tau, dt):
    """Computes causal exponentially weighted moving average."""
    # Kernel: exp(-t/tau). 
    # Using lfilter for recursive implementation of causal exponential filter
    # alpha = dt / (tau + dt) 
    alpha = dt / (tau + dt)
    return signal.lfilter([alpha], [1, -(1 - alpha)], v)

def run_analysis(spike_counts, velocity, dt, tau_range):
    """Performs correlation analysis across timescales."""
    n_neurons = spike_counts.shape[0]
    n_taus = len(tau_range)
    corr_matrix = np.zeros((n_neurons, n_taus))
    
    # Discard warmup period (500ms / dt samples)
    warmup = int(0.5 / dt)
    
    for j, tau in enumerate(tau_range):
        filt_v = compute_filtered_velocity(velocity, tau, dt)
        for i in range(n_neurons):
            # Calculate Pearson correlation
            r = np.corrcoef(spike_counts[i, warmup:], filt_v[warmup:])[0, 1]
            corr_matrix[i, j] = r
            
    return corr_matrix

def main():
    parser = argparse.ArgumentParser(description="Multi-timescale velocity encoding analysis.")
    parser.add_argument("--dt", type=float, default=0.02, help="Bin size in seconds")
    parser.add_argument("--outdir", type=str, default="results", help="Output directory")
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    
    # 1. Setup
    dt = args.dt
    tau_range = np.logspace(-1, 1, 30) # 0.1s to 10s
    
    logging.info("Generating synthetic data...")
    spike_counts, velocity, time = generate_synthetic_data(dt=dt)
    
    # 2. Analysis
    logging.info("Computing correlations for %d neurons...", spike_counts.shape[0])
    corr_matrix = run_analysis(spike_counts, velocity, dt, tau_range)
    
    # 3. Find optimal timescales
    opt_tau_indices = np.argmax(corr_matrix, axis=1)
    opt_taus = tau_range[opt_tau_indices]
    
    # 4. Visualization
    fig = plt.figure(figsize=(12, 8))
    
    # Heatmap
    ax1 = plt.subplot(2, 2, 1)
    im = ax1.imshow(corr_matrix, aspect='auto', extent=[tau_range[0], tau_range[-1], 0, len(corr_matrix)], cmap='viridis')
    ax1.set_xscale('log')
    ax1.set_xlabel('Decay Constant (s)')
    ax1.set_ylabel('Neuron Index')
    plt.colorbar(im, ax=ax1, label='Correlation')
    
    # Histogram of optimal taus
    ax2 = plt.subplot(2, 2, 2)
    ax2.hist(opt_taus, bins=np.logspace(-1, 1, 15), color='gray')
    ax2.set_xscale('log')
    ax2.set_xlabel('Optimal Tau (s)')
    ax2.set_ylabel('Count')
    ax2.set_title('Distribution of Optimal Timescales')
    
    # Example Neuron Plots
    indices_to_plot = [0, len(opt_taus)//2, -1]
    for k, idx in enumerate(indices_to_plot):
        ax = plt.subplot(3, 2, 2*k + 2 if k > 0 else 6) # Simple layout adjustment
        v_filt = compute_filtered_velocity(velocity, opt_taus[idx], dt)
        ax.plot(time[::10], velocity[::10], 'k-', alpha=0.3, label='Raw V')
        ax.plot(time[::10], v_filt[::10], 'r-', label=f'Filt V ($\\tau$={opt_taus[idx]:.2f}s)')
        ax.legend()
        ax.set_title(f'Neuron {idx} Optimal Response')

    plt.tight_layout()
    plt.savefig(os.path.join(args.outdir, "timescale_analysis.png"))
    logging.info(f"Analysis complete. Results saved to {args.outdir}")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        logging.error(f"Execution failed: {e}")