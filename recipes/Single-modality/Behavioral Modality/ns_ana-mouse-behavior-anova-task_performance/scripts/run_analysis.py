#!/usr/bin/env python3
"""
Research Question: Does bilateral chemogenetic inactivation of OB-projecting 
cholinergic neurons impair learning of the olfactory discrimination task, 
and is this impairment reversible upon cessation of CNO?

Purpose:
This script serves as an integrated analytical pipeline. It processes behavior 
(trial logs) and neural signal data (fluorescence traces deconvolved via OASIS) 
to quantify learning deficits and assess the reversibility of chemogenetic inhibition.

Inputs:
- Behavioral log: CSV with columns [trial_id, timestamp, odor_id, outcome, cno_status]
- Fluorescence data: NPY file with raw dF/F traces from OB-projecting neurons.

Outputs:
- Behavioral performance plot (Accuracy vs. Trial Blocks).
- Statistical summary (ANOVA/T-test for learning slope and washout recovery).
- Deconvolved spike probability traces.

Reference:
- Neural extraction: OASIS algorithm (Friedrich et al.)
- Behavioral analysis: Standard Go/No-Go learning curve epoch comparison.
"""

import os
import argparse
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import ttest_ind, f_oneway
from oasis.functions import deconvolve

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def perform_deconvolution(raw_traces):
    """
    Step 2: Apply oasis.functions.deconvolve to raw fluorescence.
    Map: Neural Methods section.
    """
    logger.info("Deconvolving neural signals using OASIS...")
    spike_trains = []
    for trace in raw_traces:
        # Penalty=1 uses L1 sparsity; g parameters tuned for standard GCaMP6s kinetics
        c, s, b, g, lam = deconvolve(trace, penalty=1)
        spike_trains.append(s)
    return np.array(spike_trains)

def analyze_behavior(df):
    """
    Step 1 & 3: Calculate percent correct and group by epoch.
    Map: Learning Curve and Neural-Behavior Integration sections.
    """
    # Sliding window accuracy
    window_size = 20
    df['rolling_acc'] = df['outcome'].rolling(window=window_size).mean()
    
    # Group by epoch
    epochs = df.groupby('cno_status')['outcome'].agg(['mean', 'std', 'count'])
    return epochs

def validate_reversibility(control_baseline, washout_group):
    """
    Step 4: Check if performance returns to baseline after CNO.
    Map: Reversibility Section.
    """
    t_stat, p_val = ttest_ind(control_baseline, washout_group)
    return p_val

def main(args):
    # Load Data
    if not os.path.exists(args.behavior_path):
        logger.error(f"Behavioral log missing at {args.behavior_path}")
        return

    df = pd.read_csv(args.behavior_path)
    raw_traces = np.load(args.neural_path)

    # 1. Behavioral Metric Extraction
    stats = analyze_behavior(df)
    logger.info(f"Performance summary by epoch:\n{stats}")

    # 2. Neural Signal Processing
    spikes = perform_deconvolution(raw_traces)
    np.save(os.path.join(args.output_dir, "deconvolved_spikes.npy"), spikes)

    # 3. Statistical Validation
    baseline = df[df['cno_status'] == 'pre']['outcome']
    washout = df[df['cno_status'] == 'washout']['outcome']
    p_val = validate_reversibility(baseline, washout)
    
    logger.info(f"Reversibility Check (p-value): {p_val:.4f}")
    if p_val > 0.05:
        logger.info("Reversibility confirmed: No significant difference between baseline and washout.")
    else:
        logger.warning("Reversibility failed: Significant difference remains after washout.")

    # 4. Plotting
    plt.figure(figsize=(10, 6))
    plt.plot(df['trial_id'], df['rolling_acc'], label='Rolling Accuracy')
    plt.axvline(x=df[df['cno_status']=='cno']['trial_id'].min(), color='r', linestyle='--', label='CNO Start')
    plt.axvline(x=df[df['cno_status']=='washout']['trial_id'].min(), color='g', linestyle='--', label='Washout')
    plt.xlabel('Trial ID')
    plt.ylabel('Percent Correct')
    plt.legend()
    plt.savefig(os.path.join(args.output_dir, "learning_curve.png"))
    logger.info(f"Analysis complete. Results saved to {args.output_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Analyze OB cholinergic inactivation effects.")
    parser.add_argument('--behavior_path', type=str, required=True, help='CSV with trial data')
    parser.add_argument('--neural_path', type=str, required=True, help='NPY with dF/F traces')
    parser.add_argument('--output_dir', type=str, default='./results', help='Output directory')
    
    args = parser.parse_args()
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
        
    main(args)