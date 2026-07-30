"""
Utility functions for neural data analysis.
Includes processing, circular statistics, and plotting helpers.
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy import stats

def compute_delta_f_f(F, baseline_percentile=10):
    """Calculate ΔF/F using percentile-based baseline subtraction."""
    baseline = np.percentile(F, baseline_percentile, axis=0)
    return (F - baseline) / (baseline + 1e-6)

def estimate_bump_position(dff, n_rois=8):
    """Calculate circular bump position via center-of-mass."""
    angles = np.linspace(0, 2 * np.pi, n_rois, endpoint=False)
    sin_comp = np.sum(dff * np.sin(angles), axis=1)
    cos_comp = np.sum(dff * np.cos(angles), axis=1)
    return np.arctan2(sin_comp, cos_comp)

def compute_vector_strength(theta_bump, theta_head):
    """Compute the resultant length (Vector Strength) of angular alignment."""
    diff = theta_bump - theta_head
    return np.abs(np.mean(np.exp(1j * diff)))

def plot_errorbar_summary(data_dict, labels, title, ylabel, output_path):
    """Helper to generate standard group-comparison errorbar plots."""
    fig, ax = plt.subplots(figsize=(6, 4))
    
    means = [np.mean(data_dict[i]) for i in range(len(labels))]
    sems = [stats.sem(data_dict[i]) for i in range(len(labels))]
    x = np.arange(len(labels))
    
    ax.errorbar(x, means, yerr=sems, fmt='k-o', capsize=5, label='Mean ± SEM')
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()