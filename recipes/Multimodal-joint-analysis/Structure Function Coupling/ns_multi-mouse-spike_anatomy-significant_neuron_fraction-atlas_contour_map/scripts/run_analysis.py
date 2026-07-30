"""
Brain-wide Flatmap Visualization: Stimulus Modulation
------------------------------------------------------
This script calculates the fraction of neurons significantly modulated by visual 
stimuli (left vs right) across Beryl-mapped brain regions, performs FDR correction,
and generates a Swanson flatmap visualization in a portrait, right-hemisphere orientation.

References:
- IBL Brain-Wide Map: https://github.com/int-brain-lab/ibl-brain-wide-map
- iblatlas package: https://github.com/int-brain-lab/iblatlas
"""

import logging
import argparse
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import mannwhitneyu
from statsmodels.stats.multitest import multipletests
from iblatlas.plots import plot_swanson_vector
from iblatlas.atlas import AllenAtlas

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def perform_statistical_analysis(df):
    """
    Step 3 & 4: Mann-Whitney U test and FDR correction.
    df columns: ['region', 'neuron_id', 'left_fr', 'right_fr']
    """
    logger.info("Performing Mann-Whitney U tests and FDR correction...")
    
    results = []
    for region, group in df.groupby('region'):
        p_values = []
        for _, neuron in group.iterrows():
            _, p = mannwhitneyu(neuron['left_fr'], neuron['right_fr'], alternative='two-sided')
            p_values.append(p)
        
        # FDR correction per region
        _, q_vals, _, _ = multipletests(p_values, method='fdr_bh')
        sig_mask = q_vals < 0.01
        
        results.append({
            'region': region,
            'fraction': np.mean(sig_mask),
            'significant': np.sum(sig_mask) > 0,
            'n_total': len(sig_mask)
        })
    return pd.DataFrame(results)

def generate_swanson_map(stats_df, output_path):
    """
    Step 6: Visualization using iblatlas Swanson projection.
    """
    ba = AllenAtlas(atlas_name='beryl')
    # Initialize values array with NaNs (White)
    values = {acronym: np.nan for acronym in ba.regions.acronym}
    
    sig_regions = 0
    for _, row in stats_df.iterrows():
        if row['region'] in values:
            if row['significant']:
                values[row['region']] = row['fraction']
                sig_regions += 1
            else:
                values[row['region']] = 0 # Grey (Not significant)

    fig, ax = plot_swanson_vector(values, cmap='YlGn', hemisphere='right', orientation='portrait')
    
    # Add stats overlay
    total_regions = len(stats_df)
    ax.text(0.85, 0.95, f'{sig_regions}/{total_regions}', 
            transform=ax.transAxes, fontsize=12, fontweight='bold',
            bbox=dict(facecolor='white', alpha=0.7))
    
    plt.savefig(output_path, dpi=300)
    logger.info(f"Visualization saved to {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Generate Swanson Flatmap of Stimulus Modulation")
    parser.add_argument("--input", required=True, help="Path to pre-processed CSV (region, neuron_id, left_fr, right_fr)")
    parser.add_argument("--output", default="swanson_flatmap.png", help="Output filename")
    args = parser.parse_args()

    # Step 1 & 2: Data Load and Filtering
    try:
        df = pd.read_csv(args.input)
        # Filter regions: N >= 20 neurons, N >= 2 sessions (assuming 'session_id' column)
        region_counts = df.groupby('region').agg({'neuron_id': 'nunique', 'session_id': 'nunique'})
        valid_regions = region_counts[(region_counts['neuron_id'] >= 20) & (region_counts['session_id'] >= 2)].index
        df = df[df['region'].isin(valid_regions)]
    except Exception as e:
        logger.error(f"Failed to load or filter data: {e}")
        return

    # Statistical pipeline
    stats = perform_statistical_analysis(df)
    
    # Generate Plot
    generate_swanson_map(stats, args.output)

if __name__ == '__main__':
    # To run: python script.py --input data.csv --output map.png
    main()