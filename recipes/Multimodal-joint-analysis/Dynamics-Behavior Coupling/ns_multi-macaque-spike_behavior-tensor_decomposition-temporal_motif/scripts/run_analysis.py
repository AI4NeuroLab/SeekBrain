"""
PMd_Heterogeneity_Analysis.py

This script investigates neuronal heterogeneity in macaque dorsal premotor cortex (PMd).
It uses Canonical Polyadic (CP) Decomposition to decompose neural population activity 
into temporal motifs (factors) and trial-dependent weights, as proposed by 
Williams et al. (tensortools) to resolve the debate on 'ramping' vs 'phasic' activity.

Dependencies: numpy, scipy, tensorly, matplotlib
"""

import argparse
import logging
import numpy as np
import tensorly as tl
from tensorly.decomposition import parafac
import matplotlib.pyplot as plt
import os

# Set logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def generate_synthetic_data(n_neurons=50, n_time=100, n_trials=200):
    """
    Generates synthetic neural data containing heterogeneous profiles:
    1. Ramping (Choice-selective)
    2. Phasic (Stimulus-onset transient)
    3. Non-monotonic (Biphasic)
    """
    logging.info("Generating synthetic PMd population data...")
    t = np.linspace(0, 1, n_time)
    
    # Motifs (The "B" factors in CP decomposition)
    motif_ramp = t  # Ramping
    motif_phasic = np.exp(-((t - 0.2)**2) / 0.01)  # Transient burst
    motif_biphasic = np.sin(2 * np.pi * t) # Non-monotonic
    
    factors = np.array([motif_ramp, motif_phasic, motif_biphasic])
    
    # Create random trial weights (The "C" factors)
    trial_weights = np.random.rand(n_trials, 3)
    
    # Create neuron-to-motif mapping (The "A" factors)
    neuron_map = np.random.rand(n_neurons, 3)
    
    # Construct tensor (N x T x K)
    data = np.einsum('nr, tr, kr -> ntk', neuron_map, factors.T, trial_weights)
    data += np.random.normal(0, 0.1, size=data.shape) # Add noise
    
    return data

def run_cp_decomposition(tensor, rank=3):
    """
    Applies CP decomposition to identify latent temporal factors.
    Ref: Kolda & Bader (2009) / Williams (tensortools)
    """
    logging.info(f"Executing CP decomposition with rank R={rank}...")
    # Parafac performs CP decomposition
    weights, factors = parafac(tensor, rank=rank, init='random', n_iter_max=100)
    return factors # [A, B, C]

def save_results(factors, output_dir):
    """Visualizes the temporal motifs extracted by CP decomposition."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    plt.figure(figsize=(10, 4))
    time_factor = factors[1] # Temporal factor matrix
    for i in range(time_factor.shape[1]):
        plt.plot(time_factor[:, i], label=f"Factor {i+1}")
    
    plt.title("Extracted Temporal Motifs (Heterogeneous Dynamics)")
    plt.xlabel("Time Bins")
    plt.ylabel("Firing Rate (A.U.)")
    plt.legend()
    plt.savefig(os.path.join(output_dir, "temporal_motifs.png"))
    logging.info(f"Results saved to {output_dir}")

def main(args):
    # 1. Prep: Construct Tensor
    data = generate_synthetic_data()
    
    # 2. Decomp: CP Decomposition
    # Using rank=3 to match our synthetic motifs
    factors = run_cp_decomposition(data, rank=args.rank)
    
    # 3. Visualization/Synthesis
    save_results(factors, args.output_dir)
    
    logging.info("Analysis complete. Heterogeneity successfully decomposed into latent factors.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze PMd neural heterogeneity.")
    parser.add_argument('--rank', type=int, default=3, help="Number of latent components (R)")
    parser.add_argument('--output_dir', type=str, default='results', help="Directory for plots")
    
    args = parser.parse_args()
    
    try:
        main(args)
    except Exception as e:
        logging.error(f"Analysis failed: {e}")