"""
Prior-Dependent Neural Analysis Pipeline

Purpose:
    Tests whether post-stimulus neural activity in the SC exhibits prior-dependent 
    shifts in decoded right-stimulus choices. This script performs logistic 
    regression on experimental data to evaluate if neural activity explains
    the Point of Subjective Equality (PSE) shift between high-prior and low-prior blocks.

Paper Reference: 
    "Methods: Data Analysis" (Logistic Regression)
    "Electrophysiology" (Post-stimulus firing rate calculation)
    
Repository Reference:
    - LLStateSystem: Used to generate the synchronized trial events (Prior/Contrast).
    - LLDataDoc: Used to log the trial variables used as input for this analysis.

Inputs:
    A CSV file containing: 'contrast' (signed), 'prior' (categorical: 0 for low, 1 for high), 
    'choice' (0 for left, 1 for right), and 'fr' (z-scored firing rate).

Outputs:
    1. Logistic regression summary (coefficients, p-values).
    2. Neurometric curve plots showing shifts in choice behavior.
"""

import pandas as pd
import numpy as np
import statsmodels.api as sm
import statsmodels.formula.api as smf
import matplotlib.pyplot as plt
import argparse
import logging
import os

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_and_preprocess_data(file_path):
    """Loads and validates trial-level data from Lablib exports."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Data file not found: {file_path}")
    
    df = pd.read_csv(file_path)
    required_columns = {'contrast', 'prior', 'choice', 'fr'}
    if not required_columns.issubset(df.columns):
        raise ValueError(f"Input file must contain columns: {required_columns}")
    
    logging.info("Data loaded successfully.")
    return df

def run_logistic_regression(df):
    """
    Fits the model: logit(P(Right)) = beta0 + beta1(Contrast) + beta2(Prior) + beta3(FR)
    Ref: Paper section "Methods: Data Analysis"
    """
    model = smf.logit("choice ~ contrast + prior + fr", data=df).fit()
    logging.info("Logistic Regression Results:")
    print(model.summary())
    return model

def plot_neurometric_curves(df, output_dir):
    """Plots choice behavior stratified by prior condition."""
    plt.figure(figsize=(8, 6))
    
    for prior_val, label in [(0, 'Low Prior'), (1, 'High Prior')]:
        subset = df[df['prior'] == prior_val]
        # Calculate mean choice per contrast level
        grouped = subset.groupby('contrast')['choice'].mean()
        plt.plot(grouped.index, grouped.values, 'o-', label=label)
    
    plt.xlabel("Signed Contrast")
    plt.ylabel("P(Right Choice)")
    plt.title("Neurometric Curves by Prior Condition")
    plt.legend()
    plt.grid(True)
    
    plot_path = os.path.join(output_dir, "neurometric_curves.png")
    plt.savefig(plot_path)
    logging.info(f"Plot saved to {plot_path}")

def main(args):
    """Main execution entry point."""
    try:
        # Create output directory
        os.makedirs(args.output_dir, exist_ok=True)
        
        # 1. Load Data
        df = load_and_preprocess_data(args.data_file)
        
        # 2. Regression Analysis
        # Bridging "Data Analysis" section: Assessing beta coefficients
        model = run_logistic_regression(df)
        
        # 3. Behavioral Verification
        plot_neurometric_curves(df, args.output_dir)
        
        # Save results to file
        model.summary().as_csv(open(os.path.join(args.output_dir, "regression_results.csv"), 'w'))
        
    except Exception as e:
        logging.error(f"Analysis failed: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SC Prior-Dependent Neural Analysis")
    parser.add_argument("--data_file", required=True, help="Path to synchronized trial CSV file")
    parser.add_argument("--output_dir", default="./results", help="Directory to save outputs")
    
    args = parser.parse_args()
    main(args)