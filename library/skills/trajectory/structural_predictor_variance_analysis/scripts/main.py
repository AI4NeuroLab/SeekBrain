import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
from scipy.spatial.distance import pdist, squareform

# Add library path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")
from zebrafish_Ca_utils import MapzebrainAtlas
# STRICT IMPORT as requested
from zebrafish_Ca_utils_predictors_xps import *

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ROOT_DIR = os.getenv("ZEBRAFISH_PATH", "/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data/dataverse_files")
ATLAS_PATH = os.getenv("ATLAS_PATH", os.path.join(ROOT_DIR, "Atlas"))

def analyze_structural_predictors():
    print("Starting analysis pipeline...")
    stats = {}

    # ============================================================================
    # 1. Load data and preprocessing
    # ============================================================================
    
    # Load FC matrix
    fc_path = os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")
    fc_matrix = np.load(fc_path)
    
    # Load SC matrices (check paths)
    sc_dir_path = os.path.join(ROOT_DIR, "Files", "SC_matrix_directed_terminals_expanded.npy")
    if not os.path.exists(sc_dir_path):
         sc_dir_path = os.path.join(ROOT_DIR, "SC_matrix_directed_terminals_expanded.npy")
    
    sc_und_path = os.path.join(ROOT_DIR, "Files", "SC_matrix_undirected_terminals_expanded.npy")
    if not os.path.exists(sc_und_path):
        sc_und_path = os.path.join(ROOT_DIR, "SC_matrix_undirected_terminals_expanded.npy")

    sc_directed = np.load(sc_dir_path)
    sc_undirected = np.load(sc_und_path)
    
    # Load excluded regions
    excl_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")
    excluded_regions = np.load(excl_path).astype(int)
    
    # Load Atlas and compute distances
    atlas = MapzebrainAtlas(ATLAS_PATH)
    left_centroids = np.asarray(atlas.regionCentroids["left"], dtype=float)
    right_centroids = np.asarray(atlas.regionCentroids["right"], dtype=float)
    centroids_full = 0.5 * (left_centroids + right_centroids)
    
    distance_matrix_full = squareform(pdist(centroids_full, metric="euclidean"))
    np.fill_diagonal(distance_matrix_full, 0.0)
    
    # --- Filter Matrices ---
    n_atlas = distance_matrix_full.shape[0]
    n_fc = fc_matrix.shape[0]
    
    # Create exclusion mask (False means remove)
    keep_mask = np.ones(n_atlas, dtype=bool)
    # Filter valid indices only
    valid_excl = excluded_regions[excluded_regions < n_atlas]
    keep_mask[valid_excl] = False
    
    # 1. Filter SC and Distance (assuming they are full atlas size)
    sc_directed_filtered = sc_directed[keep_mask][:, keep_mask]
    sc_undirected_filtered = sc_undirected[keep_mask][:, keep_mask]
    distance_matrix_filtered = distance_matrix_full[keep_mask][:, keep_mask]
    
    # 2. Handle FC Matrix (check if already filtered)
    if n_fc == n_atlas:
        # FC is raw, apply filter
        fc_matrix_filtered = fc_matrix[keep_mask][:, keep_mask]
    elif n_fc == np.sum(keep_mask):
        # FC is already filtered
        fc_matrix_filtered = fc_matrix
    else:
        # Unexpected shape
        print(f"Warning: FC shape {fc_matrix.shape} does not match expected filtered shape {np.sum(keep_mask)}. proceeding carefully.")
        fc_matrix_filtered = fc_matrix

    # Zero diagonals
    np.fill_diagonal(fc_matrix_filtered, 0.0)
    np.fill_diagonal(sc_directed_filtered, 0.0)
    np.fill_diagonal(sc_undirected_filtered, 0.0)
    
    print(f"Final matrix shapes: FC {fc_matrix_filtered.shape}, SC {sc_directed_filtered.shape}")

    # ============================================================================
    # 2. Compute structural predictors from SC
    # ============================================================================
    
    # Instantiate Predictors class (imported via *)
    # Pass excluded=None because we have manually filtered the matrices
    predictor_model = Predictors(
        A_dir=sc_directed_filtered,
        A_und=sc_undirected_filtered,
        ED=distance_matrix_filtered,
        excluded=None,
        directed=True
    )
    
    predictor_model.compute_predictors(directed=True)
    
    pred_names = predictor_model.predictors_names
    pred_matrices = predictor_model.predictors_list
    
    # Save predictors
    np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_names.npy"), np.array(pred_names, dtype=object))
    np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictors.npy"), np.array(pred_matrices, dtype=object))

    # ============================================================================
    # 3. Correlate each predictor with FC
    # ============================================================================
    
    upper_inds = np.triu_indices(fc_matrix_filtered.shape[0], k=1)
    fc_flat = fc_matrix_filtered[upper_inds]
    
    r_squared_single = []
    
    for mat in pred_matrices:
        mat_flat = mat[upper_inds]
        mask = np.isfinite(fc_flat) & np.isfinite(mat_flat)
        if np.sum(mask) > 10:
            r, _ = pearsonr(fc_flat[mask], mat_flat[mask])
            r_squared_single.append(r**2)
        else:
            r_squared_single.append(np.nan)
            
    r_squared_single = np.array(r_squared_single)
    np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_rsquared_single.npy"), r_squared_single)
    
    # ============================================================================
    # 4. Compute baseline explained variance
    # ============================================================================
    
    sc_und_flat = sc_undirected_filtered[upper_inds]
    mask_base = np.isfinite(fc_flat) & np.isfinite(sc_und_flat)
    
    r_base, _ = pearsonr(fc_flat[mask_base], sc_und_flat[mask_base])
    r2_base = r_base**2
    
    np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_rsquared_baseline.npy"), r2_base)
    print(f"Baseline R2: {r2_base}")

    # ============================================================================
    # 5. Calculate relative explained variance
    # ============================================================================
    
    delta_r2 = r_squared_single - r2_base

    # ============================================================================
    # 6. Visualization
    # ============================================================================
    
    fig, ax = plt.subplots(figsize=(12, 5))
    
    x = np.arange(len(pred_names))
    ax.bar(x, delta_r2, width=0.5, color='black')
    
    # Reference line
    ax.axhline(0, color='black', linewidth=0.75)
    
    # Formatting
    ax.set_xticks(x)
    # Using ha='center' for vertical labels ensures they align with the tick mark
    ax.set_xticklabels(pred_names, rotation=90, fontsize=7, ha='center')
    
    ax.set_xlim(-0.5, len(pred_names) - 0.5)
    ax.set_ylabel("△Exp. var.")
    
    # Remove spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    plt.tight_layout()
    plt.savefig(os.path.join(SAVE_DIR, "figure_refine.png"), dpi=300, bbox_inches='tight')
    
    # Save Stats
    stats['baseline_r2'] = float(r2_base)
    stats['relative_r2'] = [float(v) if np.isfinite(v) else None for v in delta_r2]
    
    with open(os.path.join(SAVE_DIR, "statistics.json"), 'w') as f:
        json.dump(stats, f, indent=2)

if __name__ == "__main__":
    analyze_structural_predictors()
