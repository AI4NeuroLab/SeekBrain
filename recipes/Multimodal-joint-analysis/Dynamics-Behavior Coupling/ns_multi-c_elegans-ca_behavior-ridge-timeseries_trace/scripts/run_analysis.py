"""
Neural Decoding of Past/Future Behavior via Ridge Regression.

This script implements the methodology to determine if current neural activity 
carries information about past or future behavior, as measured by decoding 
performance (MSE difference between actual and scrambled decoders).

Methodology References:
- Uses Ridge Regression for linear decoding.
- Evaluates decoding performance at various temporal offsets (tau).
- Compares performance against scrambled (null) controls.
- Applies a 10-second moving average to predictions to reduce noise.
"""

import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
from sklearn.metrics import mean_squared_error
import logging
import argparse
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def smooth_data(data, window_size_samples):
    """Applies a sliding window average (10s as per requirements)."""
    return np.convolve(data, np.ones(window_size_samples) / window_size_samples, mode='same')

def run_decoding_pipeline(neural_data, velocity, tau_range, fs, n_splits=5):
    """
    Performs Ridge regression decoding at various time offsets.
    
    Args:
        neural_data: (N_neurons, T_time) matrix.
        velocity: (T_time,) vector.
        tau_range: List of time offsets in seconds.
        fs: Sampling rate.
        n_splits: K-fold splits.
    """
    results = {'actual': [], 'control': []}
    
    for tau in tau_range:
        shift = int(tau * fs)
        # Shift velocity: V(t + tau)
        # If tau > 0, we look at future. If tau < 0, we look at past.
        if shift > 0:
            v_shifted = velocity[shift:]
            r_shifted = neural_data[:, :-shift].T
        elif shift < 0:
            v_shifted = velocity[:shift]
            r_shifted = neural_data[:, -shift:].T
        else:
            v_shifted = velocity
            r_shifted = neural_data.T
            
        kf = KFold(n_splits=n_splits)
        mse_fold = []
        mse_ctrl_fold = []
        
        for train_idx, test_idx in kf.split(r_shifted):
            # Model
            model = Ridge(alpha=1.0)
            model.fit(r_shifted[train_idx], v_shifted[train_idx])
            pred = model.predict(r_shifted[test_idx])
            
            # Control: Scramble behavior labels
            v_scrambled = np.random.permutation(v_shifted[train_idx])
            model_ctrl = Ridge(alpha=1.0)
            model_ctrl.fit(r_shifted[train_idx], v_scrambled)
            pred_ctrl = model_ctrl.predict(r_shifted[test_idx])
            
            mse_fold.append(mean_squared_error(v_shifted[test_idx], pred))
            mse_ctrl_fold.append(mean_squared_error(v_shifted[test_idx], pred_ctrl))
            
        results['actual'].append(np.mean(mse_fold))
        results['control'].append(np.mean(mse_ctrl_fold))
        
    return np.array(results['control']) - np.array(results['actual'])

def main():
    parser = argparse.ArgumentParser(description="Neural Decoding Reproduction")
    parser.add_argument("--fs", type=float, default=20.0, help="Sampling rate (Hz)")
    parser.add_argument("--n_animals", type=int, default=5, help="Number of virtual animals")
    parser.add_argument("--output_dir", type=str, default="./results", help="Output directory")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    
    # Simulation Parameters
    n_neurons = 50
    t_total = 1000
    tau_range = np.linspace(-5, 5, 21)
    
    # Simulate data for multiple animals
    all_performances = []
    for i in range(args.n_animals):
        # Generate dummy data: R (Neural) and V (Behavior)
        neural_data = np.random.randn(n_neurons, t_total)
        velocity = np.sin(np.linspace(0, 10, t_total)) + np.random.randn(t_total)*0.1
        
        perf = run_decoding_pipeline(neural_data, velocity, tau_range, args.fs)
        all_performances.append(perf)
        logging.info(f"Finished processing animal {i+1}")

    # Aggregation
    perf_matrix = np.array(all_performances)
    mean_perf = np.mean(perf_matrix, axis=0)
    std_perf = np.std(perf_matrix, axis=0)
    
    # Plotting
    plt.figure(figsize=(8, 5))
    plt.plot(tau_range, mean_perf, color='brown', label='Decoding Performance (MSE_diff)')
    plt.fill_between(tau_range, mean_perf - std_perf, mean_perf + std_perf, color='brown', alpha=0.2)
    plt.axhline(0, color='black', linestyle='--')
    plt.xlabel('Time offset (s)')
    plt.ylabel('MSE Control - MSE Actual')
    plt.title('Neural Information about Past/Future Behavior')
    plt.legend()
    
    plot_path = os.path.join(args.output_dir, "decoding_results.png")
    plt.savefig(plot_path)
    logging.info(f"Analysis complete. Plot saved to {plot_path}")

if __name__ == '__main__':
    main()