"""
Utility module for brain-wide map analysis.
Contains reusable statistical and visualization helpers.
"""

import numpy as np
import pandas as pd
from scipy.stats import mannwhitneyu
from statsmodels.stats.multitest import multipletests
from iblatlas.atlas import AllenAtlas
from iblatlas.plots import plot_swanson_vector
import matplotlib.pyplot as plt

def compute_region_modulation(df, alpha=0.01):
    """
    Performs Mann-Whitney U tests per region and applies FDR correction.
    
    Args:
        df: DataFrame containing ['region', 'neuron_id', 'left_fr', 'right_fr']
        alpha: FDR significance threshold
    """
    results = []
    for region, group in df.groupby('region'):
        # Mann-Whitney U test per neuron
        p_values = [mannwhitneyu(n['left_fr'], n['right_fr'], alternative='two-sided').pvalue 
                    for _, n in group.iterrows()]
        
        # FDR correction
        _, q_vals, _, _ = multipletests(p_values, method='fdr_bh')
        sig_mask = q_vals < alpha
        
        results.append({
            'region': region,
            'fraction': np.mean(sig_mask),
            'significant': np.sum(sig_mask) > 0,
            'n_total': len(sig_mask)
        })
    return pd.DataFrame(results)

def plot_swanson_from_stats(stats_df, output_path, cmap='YlGn'):
    """
    Maps regional stats to an AllenAtlas Swanson projection.
    """
    ba = AllenAtlas(atlas_name='beryl')
    values = {acronym: np.nan for acronym in ba.regions.acronym}
    
    for _, row in stats_df.iterrows():
        if row['region'] in values:
            values[row['region']] = row['fraction'] if row['significant'] else 0

    fig, ax = plot_swanson_vector(values, cmap=cmap, hemisphere='right', orientation='portrait')
    
    # Overlay metrics
    sig_count = stats_df['significant'].sum()
    ax.text(0.85, 0.95, f'{sig_count}/{len(stats_df)}', 
            transform=ax.transAxes, fontsize=12, fontweight='bold',
            bbox=dict(facecolor='white', alpha=0.7))
    
    plt.savefig(output_path, dpi=300)
    plt.close()