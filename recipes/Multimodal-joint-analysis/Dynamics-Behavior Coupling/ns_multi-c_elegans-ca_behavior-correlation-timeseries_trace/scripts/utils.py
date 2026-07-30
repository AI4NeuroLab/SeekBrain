"""
Utility functions for neural timescale analysis.
"""
import numpy as np
import scipy.signal as signal

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
        filt_v = compute_filtered_velocity(v, tau, dt)
        rate = np.maximum(0, (filt_v - np.mean(filt_v)) * 5 + 10)
        spikes = np.random.poisson(rate * dt)
        spike_times.append(spikes)
    
    return np.array(spike_times), v, t

def compute_filtered_velocity(v, tau, dt):
    """Computes causal exponentially weighted moving average using IIR filter."""
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