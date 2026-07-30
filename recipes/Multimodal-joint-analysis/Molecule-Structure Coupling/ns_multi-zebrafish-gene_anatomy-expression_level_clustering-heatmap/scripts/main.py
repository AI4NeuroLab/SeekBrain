import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import zscore

# Add shared toolkit to path
sys.path.append("<data-root>")
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *

# Get environment paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ========================================================================
# 1. Load gene expression data
# ========================================================================
gene_expression_path = os.path.join(ZEBRAFISH_PATH, "Files", "gene_expression.npy")
gene_expression = np.load(gene_expression_path)  # Shape: (n_genes, n_regions)

# Validate shape
n_genes, n_regions = gene_expression.shape

# ========================================================================
# 2. Load excluded regions
# ========================================================================
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
excluded_regions = np.load(excluded_regions_path)
excluded_regions = excluded_regions.astype(int)

# ========================================================================
# 3. Remove excluded regions
# ========================================================================
# Create a mask for regions to keep
keep_mask = np.ones(n_regions, dtype=bool)
keep_mask[excluded_regions] = False

# Filter the gene expression matrix (remove columns corresponding to excluded regions)
gene_expression_filtered = gene_expression[:, keep_mask]
n_regions_kept = gene_expression_filtered.shape[1]

# ========================================================================
# 4. Apply z-score normalization across genes (axis 0) for each region
# ========================================================================
# Normalize each region (column) independently by computing z-scores across genes (rows)
gene_expression_normalized = zscore(gene_expression_filtered, axis=0, nan_policy='propagate')

# Handle potential NaN values (if std dev is 0 for a region)
gene_expression_normalized = np.nan_to_num(gene_expression_normalized, nan=0.0)

# ========================================================================
# 5. Transpose for visualization (regions x genes)
# ========================================================================
expression_matrix_transposed = gene_expression_normalized.T  # Shape: (n_regions_kept, n_genes)

# ========================================================================
# 6. Create the heatmap figure
# ========================================================================
fig, ax = plt.subplots(figsize=(18, 3))

# Plot heatmap with white-to-black colormap (flipped 'gray' is 'gray_r')
im = ax.imshow(
    expression_matrix_transposed,
    aspect='auto',
    cmap='gray_r',
    vmin=-1,
    vmax=4,
    interpolation='nearest'
)

# Add vertical colorbar
cbar = plt.colorbar(im, ax=ax, orientation='vertical', fraction=0.02, pad=0.02)
cbar.set_label("Expression (z-scored)", rotation=270, labelpad=15)

# ========================================================================
# 7. Configure axes labels and ticks
# ========================================================================
# Set axis labels
ax.set_xlabel("Genes")
ax.set_ylabel("Brain regions")

# Set X-ticks to show only the first and last gene ID (starting from 1)
gene_start_id = 1
gene_end_id = n_genes
ax.set_xticks([0, n_genes - 1])
ax.set_xticklabels([str(gene_start_id), str(gene_end_id)])

# Set Y-ticks to show only the first and last region ID (starting from 1)
region_start_id = 1
region_end_id = n_regions_kept
ax.set_yticks([0, n_regions_kept - 1])
ax.set_yticklabels([str(region_start_id), str(region_end_id)])

# Turn off axis tick marks (length=0) and add padding for readability
ax.tick_params(axis='both', which='both', length=0, pad=5)

# Turn off axis spines (borders) to satisfy "Turn off all axis ticks and labels" spirit
# while keeping the specifically requested labels.
for spine in ax.spines.values():
    spine.set_visible(False)

plt.tight_layout()

# ========================================================================
# 8. Save the figure
# ========================================================================
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
plt.close(fig)

print(f"✅ Figure saved to {figure_path}")

# ========================================================================
# 9. Compute and save key statistics
# ========================================================================
statistics = {
    "n_genes": int(n_genes),
    "n_regions_original": int(n_regions),
    "n_excluded_regions": int(len(excluded_regions)),
    "excluded_region_ids": excluded_regions.tolist(),
    "n_regions_kept": int(n_regions_kept),
    "expression_mean_per_gene": np.nanmean(gene_expression_filtered, axis=1).tolist(),
    "expression_std_per_gene": np.nanstd(gene_expression_filtered, axis=1).tolist(),
    "normalized_expression_mean": float(np.nanmean(gene_expression_normalized)),
    "normalized_expression_std": float(np.nanstd(gene_expression_normalized))
}

statistics_path = os.path.join(SAVE_DIR, "statistics.json")
with open(statistics_path, 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"✅ Statistics saved to {statistics_path}")
