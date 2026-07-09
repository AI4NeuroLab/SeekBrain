"""
Utility functions for Granule Cell Movement Modulation Analysis.
"""

import cv2
import numpy as np
import pandas as pd
import logging

def calculate_motion_energy(video_path):
    """Calculates ME = sum |frame_t - frame_{t-1}|."""
    logging.info(f"Computing Motion Energy from {video_path}")
    cap = cv2.VideoCapture(video_path)
    me_series = []
    ret, prev_frame = cap.read()
    if not ret:
        raise ValueError("Could not read video.")
    
    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        diff = cv2.absdiff(gray, prev_gray)
        me_series.append(np.sum(diff))
        prev_gray = gray
    cap.release()
    return np.array(me_series)

def load_spike_glx_sync(sync_path):
    """Parses NI_DO_Set logs to return task/stimulus trial epochs."""
    logging.info(f"Loading sync data from {sync_path}")
    # Placeholder: Implement actual binary/metadata parsing here
    return pd.DataFrame({'start': [100, 500], 'end': [300, 700], 'type': ['Task', 'Passive']})

def fit_glm(activity, me, stim_mask):
    """
    Fits GLM: activity ~ beta1(ME) + beta2(Stim) + beta3(ME * Stim)
    Returns interaction coefficient beta3 (Modulation Index).
    """
    X = np.vstack([me, stim_mask, me * stim_mask]).T
    beta, _, _, _ = np.linalg.lstsq(X, activity, rcond=None)
    return beta[2]