"""
Granule Cell Movement Modulation Analysis
-----------------------------------------
This script addresses the research question: "Do movement-related responses of 
granule cells change between baseline and task stimulus periods?"

Methods alignment:
1. Data Acquisition: Sync TTLs from SpikeGLX logs (Digital Input Channels).
2. Behavioral Analysis: Pixel-wise frame subtraction for Motion Energy.
3. Neural Analysis: GLM: GC_activity ~ B1(ME) + B2(Stim) + B3(ME*Stim).

Usage:
    python gc_modulation_analysis.py --data_dir ./raw_data --output_dir ./results
"""

import os
import numpy as np
import pandas as pd
import scipy.stats as stats
import matplotlib.pyplot as plt
import cv2
import argparse
import logging
from scipy.ndimage import gaussian_filter1d

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def calculate_motion_energy(video_path):
    """Calculates ME = sum |frame_t - frame_{t-1}| (Paper: Behavioral Analysis)."""
    logging.info(f"Computing Motion Energy from {video_path}")
    cap = cv2.VideoCapture(video_path)
    me_series = []
    ret, prev_frame = cap.read()
    if not ret: raise ValueError("Could not read video.")
    
    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    while True:
        ret, frame = cap.read()
        if not ret: break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        diff = cv2.absdiff(gray, prev_gray)
        me_series.append(np.sum(diff))
        prev_gray = gray
    cap.release()
    return np.array(me_series)

def load_spike_glx_sync(sync_path):
    """Parses NI_DO_Set logs to return task/stimulus trial epochs."""
    # Simplified placeholder for parsing SpikeGLX metadata digital input
    logging.info(f"Loading sync data from {sync_path}")
    # In practice, parse binary/metadata files for TTL pulses
    return pd.DataFrame({'start': [100, 500], 'end': [300, 700], 'type': ['Task', 'Passive']})

def fit_glm(activity, me, stim_mask):
    """
    Fits GLM: activity ~ beta1(ME) + beta2(Stim) + beta3(ME * Stim)
    Returns interaction coefficient beta3 (Modulation Index).
    """
    X = np.vstack([me, stim_mask, me * stim_mask]).T
    beta, _, _, _ = np.linalg.lstsq(X, activity, rcond=None)
    return beta[2] # Return interaction term

def main(args):
    # 1. Load Data
    me = calculate_motion_energy(args.video_file)
    trials = load_spike_glx_sync(args.sync_file)
    
    # 2. Extract GC activity (assuming pre-processed csv from Suite2p)
    # In real scenario: load .npy files from Suite2p outputs
    gc_activity = np.random.randn(len(me)) # Placeholder for actual deltaF/F
    
    # 3. Model Analysis (Interaction check)
    stim_mask = np.zeros_like(me)
    for _, row in trials.iterrows():
        if row['type'] == 'Task':
            stim_mask[row['start']:row['end']] = 1
            
    modulation_coeff = fit_glm(gc_activity, me, stim_mask)
    logging.info(f"Interaction Coefficient (beta3): {modulation_coeff:.4f}")
    
    # 4. Visualization
    plt.figure(figsize=(10, 4))
    plt.plot(me, label='Motion Energy')
    plt.plot(gc_activity, label='GC Activity', alpha=0.5)
    plt.title("Granule Cell Response vs Motion Energy")
    plt.legend()
    plt.savefig(os.path.join(args.output_dir, 'modulation_plot.png'))
    logging.info("Analysis complete. Results saved.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze GC movement responses.")
    parser.add_argument('--video_file', required=True, help="Path to high-frame-rate video")
    parser.add_argument('--sync_file', required=True, help="Path to SpikeGLX metadata/log")
    parser.add_argument('--output_dir', default='./results', help="Results output path")
    
    args = parser.parse_args()
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
        
    try:
        main(args)
    except Exception as e:
        logging.error(f"Analysis failed: {e}")