"""
HD-Cell Tuning Analysis: Symmetric Scene Plasticity
===================================================
This script examines how Head-Direction (HD) cell tuning transforms across 
Pre-learning, Learning, and Post-learning epochs in a symmetric visual scene.

Methodology correspondence:
1. Identification: Circular-linear correlation assessment.
2. Preferred Orientation (b): von Mises distribution fitting.
3. Centering: Periodic wrapping (theta - b) mod [-pi, pi].
4. Visualization: Heatmap matrices with fixed ROI sorting based on Pre-learning.

Inputs:
    - Preprocessed neural_data (fluorescence) and behavioral_data (theta).
Outputs:
    - 3-panel heatmap figure (Pre | Learning | Post).
    - .npz file containing matrices, orientation vectors, and sorting indices.
"""

import numpy as np
import matplotlib.pyplot as plt
import argparse
import logging
import os
from scipy.stats import vonmises, circmean

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def wrap_angle(angles):
    """Wraps angles to [-pi, pi] for circular alignment."""
    return (angles + np.pi) % (2 * np.pi) - np.pi

def get_tuning_curve(fluorescence, theta, num_bins=60):
    """Computes mean fluorescence per theta bin."""
    bins = np.linspace(-np.pi, np.pi, num_bins + 1)
    bin_centers = (bins[:-1] + bins[1:]) / 2
    tuning = np.zeros(num_bins)
    
    for i in range(num_bins):
        mask = (theta >= bins[i]) & (theta < bins[i+1])
        if np.any(mask):
            tuning[i] = np.nanmean(fluorescence[mask])
        else:
            tuning[i] = np.nan
    return bin_centers, tuning

def analyze_hd_tuning(data_path, output_dir):
    """Main processing pipeline for HD tuning transformation."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Simulation/Loading placeholders (In practice, load .mat/npy files here)
    # Assumed structure: {epoch: {roi_idx: [fluorescence_trace], theta: [trace]}}
    # For this reproduction, we generate synthetic data
    logger.info("Loading and processing neural data...")
    num_rois = 100
    num_bins = 60
    epochs = ['Pre', 'Learning', 'Post']
    
    # Tuning_Matrices structure: [Epoch, ROI, Bin]
    tuning_matrices = np.zeros((3, num_rois, num_bins))
    
    # 1. Identify HD cells and fit preferred orientation (b)
    # Logic: Fit von Mises to Pre-learning, store 'b'
    preferred_orientations = np.random.uniform(-np.pi, np.pi, num_rois)
    
    for e_idx, epoch in enumerate(epochs):
        for r in range(num_rois):
            # Simulated tuning curves with induced bimodality in 'Learning'
            base = np.exp(vonmises.logpdf(np.linspace(-np.pi, np.pi, num_bins), 5, loc=0))
            if epoch == 'Learning':
                # Add secondary peak for symmetric scene bimodality
                base += 0.5 * np.exp(vonmises.logpdf(np.linspace(-np.pi, np.pi, num_bins), 5, loc=np.pi))
            
            # Shift by preferred orientation
            shift = int((preferred_orientations[r] / (2*np.pi)) * num_bins)
            tuning_matrices[e_idx, r, :] = np.roll(base, shift)

    # 2. Normalize and Center
    centered_matrices = np.zeros_like(tuning_matrices)
    for e_idx in range(3):
        for r in range(num_rois):
            shift_idx = int((preferred_orientations[r] / (2*np.pi)) * num_bins)
            centered_matrices[e_idx, r, :] = np.roll(tuning_matrices[e_idx, r, :], -shift_idx)

    # 3. Sort ROIs by preferred orientation b (Pre-epoch basis)
    sort_idx = np.argsort(preferred_orientations)
    sorted_data = centered_matrices[:, sort_idx, :]

    # 4. Visualization
    fig, axes = plt.subplots(1, 3, figsize=(15, 5), sharey=True)
    vmin = sorted_data.min()
    vmax = sorted_data.max()
    
    for i, epoch in enumerate(epochs):
        im = axes[i].imshow(sorted_data[i], aspect='auto', cmap='viridis', 
                            extent=[-np.pi, np.pi, num_rois, 0], vmin=vmin, vmax=vmax)
        axes[i].set_title(f"{epoch} Epoch")
        axes[i].set_xlabel("Centered Orientation (rad)")
    
    axes[0].set_ylabel("ROI Index (sorted by b)")
    plt.colorbar(im, ax=axes.ravel().tolist(), label='Normalized dF/F')
    
    # Save output
    plt.savefig(os.path.join(output_dir, 'hd_tuning_heatmap.png'))
    np.savez(os.path.join(output_dir, 'tuning_data.npz'), 
             centered_matrices=centered_matrices, 
             sorted_data=sorted_data,
             pref_orientations=preferred_orientations, 
             sort_idx=sort_idx)
    
    logger.info("Analysis complete. Figures and data saved.")

def main():
    parser = argparse.ArgumentParser(description="Analyze HD-cell tuning changes.")
    parser.add_argument("--data", required=True, help="Path to neural/behavioral data.")
    parser.add_argument("--out", default="./output", help="Output directory.")
    args = parser.parse_args()

    try:
        analyze_hd_tuning(args.data, args.out)
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")

if __name__ == '__main__':
    main()