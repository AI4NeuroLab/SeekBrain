#!/usr/bin/env python3
"""
PMd Neural Dynamics Analysis: Single-Neuron PSTH and CP Decomposition.

This script processes neural spike data to:
1. Generate trial-averaged PSTHs (Peristimulus Time Histograms) sorted by behavior.
2. Perform CP (Canonical Polyadic) decomposition to extract latent population dynamics.

Reference:
- Paper: Dorsal Premotor Cortex (PMd) perceptual decision-making.
- Method: Tensor decomposition as described by Alex H. Williams (TensorToolbox approach).
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import tensorly as tl
from tensorly.decomposition import parafac
import logging
import argparse
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def generate_synthetic_data(n_neurons=50, n_bins=100, n_trials=200):
    """
    Generates synthetic neural data mimicking PMd activity.
    Structure: [Neurons x Time x Trials]
    """
    logger.info("Generating synthetic neural data...")
    # Simulate a signal that differentiates by choice and difficulty
    data = np.random.normal(0, 0.1, (n_neurons, n_bins, n_trials))
    
    # Inject latent structure: some neurons respond to trial type
    # Trials 0-99: Choice Left, 100-199: Choice Right
    data[:, :, 100:] += 0.5  # Differential bias
    return data

def compute_psth(data, labels, condition_key):
    """
    Step 1 & 2: Trial grouping and PSTH calculation.
    """
    logger.info(f"Computing PSTH for condition: {condition_key}")
    condition_indices = np.where(labels == condition_key)[0]
    psth = np.mean(data[:, :, condition_indices], axis=2)
    return psth

def run_cp_decomposition(tensor, rank=3):
    """
    Step 3: CP Decomposition.
    Matches the logic of `cp_als` in the referenced implementation.
    """
    logger.info(f"Running CP decomposition with rank={rank}")
    # Canonical Polyadic Decomposition
    factors = parafac(tensor, rank=rank, init='random', tol=1e-6)
    return factors

def main():
    parser = argparse.ArgumentParser(description="Analyze PMd neural data using tensor decomposition.")
    parser.add_argument("--output_dir", type=str, default="./output", help="Directory for plots")
    parser.add_argument("--rank", type=int, default=3, help="Number of latent factors")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    # 1. Prepare Data
    n_trials = 200
    data = generate_synthetic_data(n_trials=n_trials)
    # Metadata: 0=Easy, 1=Hard
    labels = np.array([0] * (n_trials // 2) + [1] * (n_trials // 2))

    # 2. Compute PSTHs (Example Neuron 0)
    plt.figure(figsize=(8, 4))
    for cond in [0, 1]:
        psth = compute_psth(data, labels, cond)
        plt.plot(psth[0, :], label=f"Difficulty {cond}")
    plt.title("Single Neuron 0 PSTH (Condition Sorted)")
    plt.xlabel("Time Bin")
    plt.ylabel("Firing Rate (norm)")
    plt.legend()
    plt.savefig(os.path.join(args.output_dir, "single_neuron_psth.png"))
    logger.info("Saved single neuron PSTH visualization.")

    # 3. CP Decomposition (Population level)
    # Standardize data for decomposition
    tensor = tl.tensor(data)
    factors = run_cp_decomposition(tensor, rank=args.rank)

    # 4. Visualize Temporal Factors
    # This represents the shared dynamics across the population
    plt.figure(figsize=(8, 4))
    temporal_factors = factors[1]  # The B factor matrix (time)
    plt.plot(temporal_factors)
    plt.title("Latent Temporal Factors (CP Decomposition)")
    plt.xlabel("Time Bin")
    plt.ylabel("Factor Weight")
    plt.savefig(os.path.join(args.output_dir, "latent_dynamics.png"))
    logger.info("Saved CP decomposition temporal factors.")

    logger.info("Analysis complete.")

if __name__ == '__main__':
    """
    To run this script:
    python script.py --output_dir ./results --rank 4
    """
    try:
        main()
    except Exception as e:
        logger.error(f"Analysis failed: {e}")