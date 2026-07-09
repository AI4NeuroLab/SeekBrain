"""
functional_connectivity_analysis.py

This script computes the Functional Connectivity (FC) matrix from larval zebrafish 
calcium imaging data (`region_series_dff.npy`). It follows the methodology of 
Fisher-Z transformation for group-level averaging of Pearson correlations.

Methodology:
1. Subset spontaneous activity (first 600 time points).
2. Filter out excluded regions using a provided index mask.
3. Compute Pearson correlation matrices (FC) for each larva.
4. Perform Fisher-Z transformation: z = arctanh(r).
5. Compute group-averaged Z-matrix.
6. Inverse transform: r_avg = tanh(z_avg).

Usage:
    python functional_connectivity_analysis.py --data_dir ./data --output_dir ./results
"""

import os
import glob
import logging
import argparse
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.stats import fisherz

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_and_preprocess(file_path, excluded_indices):
    """Loads time series and removes excluded regions."""
    try:
        data = np.load(file_path)  # Expected shape [T, N]
        if data.shape[0] < 600:
            logging.warning(f"File {file_path} has fewer than 600 time points.")
            return None
        
        # Step 1: Subset spontaneous period
        data = data[:600, :]
        
        # Step 2: Filter regions
        data = np.delete(data, excluded_indices, axis=1)
        return data
    except Exception as e:
        logging.error(f"Error processing {file_path}: {e}")
        return None

def compute_fc_matrix(data):
    """Computes Pearson correlation matrix."""
    # Step 3: Compute R matrix (rowvar=False implies columns are variables/regions)
    return np.corrcoef(data, rowvar=False)

def main():
    parser = argparse.ArgumentParser(description="Larval Zebrafish FC Analysis")
    parser.add_argument("--data_dir", required=True, help="Directory containing region_series_dff.npy files")
    parser.add_argument("--mask_path", required=True, help="Path to Figure1_excluded_regions.npy")
    parser.add_argument("--output_dir", required=True, help="Directory to save results")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    # Load exclusion mask
    try:
        excluded = np.load(args.mask_path)
    except Exception as e:
        logging.error(f"Failed to load exclusion mask: {e}")
        return

    # Gather data files
    file_list = glob.glob(os.path.join(args.data_dir, "*region_series_dff.npy"))
    if not file_list:
        logging.error("No data files found.")
        return

    z_matrices = []
    
    # Process each fish
    for i, file_path in enumerate(file_list):
        data = load_and_preprocess(file_path, excluded)
        if data is None: continue
        
        corr_matrix = compute_fc_matrix(data)
        
        # Step 4: Fisher-Z Transform to handle non-normal distribution of R
        # Note: Clip to avoid inf at +/- 1
        corr_matrix = np.clip(corr_matrix, -0.999, 0.999)
        z_matrix = np.arctanh(corr_matrix)
        
        # Save individual FC
        np.save(os.path.join(args.output_dir, f"FC_fish_{i}.npy"), corr_matrix)
        z_matrices.append(z_matrix)

    # Step 5 & 6: Compute Group Average
    if z_matrices:
        z_avg = np.mean(np.array(z_matrices), axis=0)
        r_avg = np.tanh(z_avg)
        
        # Save group result
        np.save(os.path.join(args.output_dir, "group_avg_FC.npy"), r_avg)
        
        # Step 7: Visualization
        plt.figure(figsize=(10, 8))
        sns.heatmap(r_avg, cmap='RdBu_r', center=0, vmin=-0.5, vmax=0.5, cbar_kws={'label': 'Pearson Correlation'})
        plt.title("Group-Averaged Functional Connectivity Matrix")
        plt.xlabel("Brain Region Index")
        plt.ylabel("Brain Region Index")
        plt.savefig(os.path.join(args.output_dir, "group_avg_FC_heatmap.png"), dpi=300)
        logging.info(f"Analysis complete. Results saved in {args.output_dir}")
    else:
        logging.error("No valid data processed to compute group average.")

if __name__ == '__main__':
    main()