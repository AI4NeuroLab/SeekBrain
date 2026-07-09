#!/usr/bin/env python3
"""
Functional Connectivity (FC) Analysis for Zebrafish Larvae

Purpose:
    Compute individual and group-averaged functional connectivity matrices from
    spontaneous calcium imaging time-series data. This script filters out 
    predefined excluded regions and utilizes `brainconn` utilities for 
    matrix thresholding and visualization.

Usage:
    python fc_analysis.py --data_dir ./data --out_dir ./output --atlas_coords ./atlas_coords.npy

References:
    - BCT (Brain Connectivity Toolbox) for Python: brainconn library.
    - Analysis pipeline follows standard Pearson correlation FC methodology
      using the first 600 timepoints.
"""

import os
import logging
import argparse
import numpy as np
import matplotlib.pyplot as plt
from brainconn.utils.matrix import threshold_absolute
from brainconn.utils.visualization import adjacency_plot_und

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def compute_fc(data_slice):
    """
    Compute Pearson correlation matrix from (N_regions, Timepoints) array.
    """
    return np.corrcoef(data_slice)

def apply_mask(fc_matrix, excluded_indices):
    """
    Remove excluded regions from the FC matrix.
    """
    all_indices = np.arange(fc_matrix.shape[0])
    keep_indices = np.delete(all_indices, excluded_indices)
    return fc_matrix[np.ix_(keep_indices, keep_indices)], keep_indices

def main():
    parser = argparse.ArgumentParser(description="Compute and visualize FC matrices.")
    parser.add_argument("--data_dir", required=True, help="Directory containing fish subfolders with region_series_dff.npy")
    parser.add_argument("--process_dir", required=True, help="Directory containing Figure1_excluded_regions.npy")
    parser.add_argument("--out_dir", required=True, help="Directory to save results")
    parser.add_argument("--atlas_coords", required=True, help="Path to atlas_coords.npy")
    args = parser.parse_args()

    # Create output directory
    os.makedirs(args.out_dir, exist_ok=True)

    # 1. Load exclusion indices
    try:
        excluded = np.load(os.path.join(args.process_dir, 'Figure1_excluded_regions.npy'))
        coords = np.load(args.atlas_coords)
    except Exception as e:
        logger.error(f"Failed to load supporting files: {e}")
        return

    # 2. Iterate through fish larvae
    fc_list = []
    fish_folders = [f for f in os.listdir(args.data_dir) if os.path.isdir(os.path.join(args.data_dir, f))]
    
    for fish_id in fish_folders:
        file_path = os.path.join(args.data_dir, fish_id, 'region_series_dff.npy')
        if not os.path.exists(file_path):
            continue
            
        data = np.load(file_path)
        if data.shape[1] < 600:
            logger.warning(f"Fish {fish_id} has fewer than 600 timepoints. Skipping.")
            continue
            
        # Slice spontaneous period
        data_slice = data[:, :600]
        
        # Compute FC
        fc = compute_fc(data_slice)
        
        # Apply masking
        filtered_fc, kept = apply_mask(fc, excluded)
        
        # Save individual FC
        np.save(os.path.join(args.out_dir, f"{fish_id}_fc.npy"), filtered_fc)
        fc_list.append(filtered_fc)
        logger.info(f"Processed {fish_id}")

    if not fc_list:
        logger.error("No valid FC matrices computed.")
        return

    # 3. Group Average
    avg_fc = np.mean(np.stack(fc_list), axis=0)
    np.save(os.path.join(args.out_dir, "group_average_FC.npy"), avg_fc)

    # 4. Refinement: Thresholding
    # Remove weak noise, clear diagonal
    thresholded_fc = threshold_absolute(avg_fc, thr=0.2)

    # 5. Visualization
    # Subset coordinates to match the filtered FC matrix
    kept_coords = coords[kept]
    
    try:
        fig = plt.figure(figsize=(8, 6))
        plt.imshow(thresholded_fc, cmap='RdBu_r', vmin=-1, vmax=1)
        plt.colorbar(label='Correlation Coefficient')
        plt.title("Average Thresholded FC Matrix")
        plt.savefig(os.path.join(args.out_dir, "group_average_heatmap.png"))
        logger.info("Group average visualization saved.")
        
        # Optional 3D plot if environment supports mayavi
        # adjacency_plot_und(thresholded_fc, kept_coords)
        
    except Exception as e:
        logger.error(f"Visualization failed: {e}")

if __name__ == '__main__':
    main()