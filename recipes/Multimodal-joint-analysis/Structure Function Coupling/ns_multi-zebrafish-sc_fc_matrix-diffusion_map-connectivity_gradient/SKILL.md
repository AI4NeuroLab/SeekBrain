---
name: "ns_multi-zebrafish-sc_fc_matrix-diffusion_map-connectivity_gradient"
description: "Compute connectivity gradients from both the structural connectome (SC) and the group-average functional connectivity matrix (FC) of the larval zebrafish brain using the diffusion map embedding algorithm (brainspace.gradient.embedding.diffusion_mapping, alpha=0.5), correlate the first two SC and FC gradients against each other, and project them onto the Mapzebrain atlas as bilateral centroid overlays in top (XY) and side (XZ) views. Reach for this whenever someone asks for connectivity gradients, gradient analysis, diffusion map embedding, diffusion embedding of a connectome, the principal gradient, macroscale gradients, a low-dimensional embedding of SC or FC, 'does structure predict the main axis of function', 'is there a rostro-caudal gradient', 'sensorimotor hierarchy from connectivity', or the correspondence between structural and functional gradients. This is the source of Figure6_SC_gradients.npy, Figure6_SC_eigenvalues.npy, Figure6_FC_gradients.npy and Figure6_FC_eigenvalues.npy"
triggers:
- "Analyze structural and functional connectivity gradients by diffusion map embedding"
- "Generate structural and functional connectivity gradients by diffusion map embedding outputs"
- "Apply the ns_multi-zebrafish-sc_fc_matrix-diffusion_map-connectivity_gradient recipe"
tags:
- "zebrafish"
- "sc"
- "fc"
- "matrix"
- "diffusion"
version: "1.0"
---

# Structural and functional connectivity gradients by diffusion map embedding

Runs diffusion map embedding on the 70×70 SC matrix and the 65×65 group-average FC matrix,
saves both gradient sets and their eigenvalue spectra, correlates gradients 1 and 2 across
modalities, and paints them onto the atlas.

## When to use this

Use this recipe to derive and compare low-dimensional structural and functional connectivity gradients with diffusion-map embedding. Do not use it for unmatched matrices or when the requested output is a community partition rather than continuous gradients.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy` | (65, 65) |
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy` | (70, 70) |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) → `[10 34 44 49 69]` |
| in | `$ATLAS_PATH` → `MapzebrainAtlas.centroids['left'\|'right']`, `.XYprojection`, `.XZprojection` | (70, 3) each |
| out | `$PROCESS_DATA_DIR/Figure6_SC_gradients.npy` | (69, 65) |
| out | `$PROCESS_DATA_DIR/Figure6_SC_eigenvalues.npy` | (69,) |
| out | `$PROCESS_DATA_DIR/Figure6_FC_gradients.npy` | (64, 65) |
| out | `$PROCESS_DATA_DIR/Figure6_FC_eigenvalues.npy` | (64,) |
| out | `$SAVE_DIR/figure.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load the FC matrix, `np.nan_to_num(..., nan=0, posinf=0, neginf=0)`, then
   `np.fill_diagonal(fc_matrix, 0.0)`. The unit diagonal has to go: diffusion mapping treats
   the matrix as an affinity graph, and a self-affinity of 1 against off-diagonal
   correlations around 0.4 would dominate the normalisation. The same cleaning is applied to
   the SC matrix.
2. Load the SC matrix from `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy`
   and the 5-element exclusion list.
3. SC gradients: `diffusion_mapping(sc_matrix, n_components=min(69, N-1), alpha=0.5)` on the
   **full unexcluded 70×70** matrix. Embedding first and excluding afterwards keeps the excluded
   regions contributing their connectivity to the diffusion process, which is what the task
   spec asked for.
4. Delete the excluded rows from the resulting modes (`np.delete(modes_SC, excluded_regions,
   axis=0)`), then transpose so gradients are rows: (69 components, 65 regions). Save the
   gradients and the untrimmed eigenvalue vector.
5. FC gradients: `diffusion_mapping(fc_matrix, n_components=min(64, N-1), alpha=0.5)` on the
   already-excluded 65×65 matrix — no further exclusion, or you would remove regions twice.
   Transpose to (64, 65). Save gradients and eigenvalues.
6. Correlate: `pearsonr(modes_SC_filtered[0, :65], modes_FC[0, :65])` and the same for row 1.
   Both gradient sets now index the same 65 surviving regions in the same order, which is what
   makes an element-wise correlation meaningful.
7. Build bilateral centroids: concatenate `atlas.centroids['left']` and
   `atlas.centroids['right']` → (140, 3). Flip y with `y = 974 - y` to match the image
   orientation of the projections, since atlas coordinates and image row indices run opposite
   ways.
8. Exclude bilaterally: `np.concatenate([excluded_regions, excluded_regions + 70])`, then
   `np.delete(..., axis=0)` → (130, 3). The `+ 70` is the pairing rule — region *i* on the left
   is row *i*, the same region on the right is row *i+70*. Dropping only one side would
   misalign every subsequent centroid against its gradient value.
9. Side-view coordinates: take columns `[2, 1]` (z, y) and flip z with `359 - z`.
10. Duplicate each gradient vector for bilateral plotting with the inline
    `double_vector(vec) = np.concatenate([vec, vec])` — 65 values become 130, matching the
    centroid rows in the same left-then-right order.
11. Plot a 2×10 `subplot2grid` figure, SC on the top row and FC on the bottom: connectivity
    matrix (custom white→blue colormap, `vmin=0.1`, `vmax=0.9`), then gradient 1 top/side and
    gradient 2 top/side. Colour centroids `coolwarm`, `s=35`, black edges, symmetric limits at
    ±`np.percentile(np.abs(grad_bilateral), 90)`. Annotate the two FC gradient panels with the
    SC–FC correlation coefficients.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `alpha` | `0.5` | The diffusion map anisotropic-diffusion parameter. 0.5 is the Fokker–Planck normalisation, which partially removes the influence of the sampling density on the geometry — the standard choice for connectivity gradients. `alpha=0` gives the plain graph Laplacian, `alpha=1` full Laplace–Beltrami. Changing it changes every gradient. |
| `n_components` (SC) | `min(69, 70-1)` = **69** | The requested value was 70 and "do not alter"; the implementation uses 69 because brainspace requests `k = n_components + 1` eigenvectors and `k >= N` breaks the sparse solver. Even at 69 the solver emits a `k >= N` warning and falls back to `scipy.linalg.eigh`. |
| `n_components` (FC) | `min(64, 65-1)` = **64** | Same reasoning; spec said 65. |
| diagonal | zeroed | `np.fill_diagonal(m, 0.0)` on both matrices before embedding, and it persists into the displayed matrices. |
| exclusion timing (SC) | **after** embedding | Rows deleted from the modes, not from the input matrix. |
| exclusion timing (FC) | **already applied upstream** | The 65×65 FC matrix arrives pre-excluded; do not re-exclude. |
| y flip constant | `974` | Atlas y → image row. |
| z flip constant | `359` | Side-view z mirror. |
| colour limits | ±`np.percentile(np.abs(g), 90)` | Per-panel, computed on the bilateral (doubled) vector. Symmetric so the `coolwarm` white point sits at zero. Robust to the handful of extreme regions that would otherwise wash out the map. |
| marker | `s=35`, `edgecolor='black'`, `linewidth=0.5` | |
| matrix cmap | white → `[72/255, 184/255, 208/255]`, `vmin=0.1`, `vmax=0.9` | Built inline by `create_blue_white_cmap()`. |
| atlas background | `cmap='binary'`, `aspect='auto'` | |
| XZ rotation | `np.rot90(atlas.XZprojection, k=3)` | 90° clockwise. |
| `figsize` | `(18, 8)`, dpi 300 | |

## Expected results

From `statistics.json`:

- `sc_gradient_shape` = **[69, 65]**, `fc_gradient_shape` = **[64, 65]**
- `n_regions_sc` = 70, `n_regions_fc` = 65, `n_excluded_regions` = 5,
  `n_centroids_filtered` = **130**
- `correlation_gradient1` = **0.6342**, `correlation_gradient2` = **0.1561**
- `sc_eigenvalues_mean` = **−0.005007**, `fc_eigenvalues_mean` = **−0.012640**
- SC gradient 1: mean 0.09170, std 0.72182 · SC gradient 2: mean 0.01833, std 0.45241
- FC gradient 1: mean 0.00970, std 0.38522 · FC gradient 2: mean 0.01303, std 0.18052

The claims these support: the primary structural and functional gradients are strongly aligned
(r = 0.634) while the secondary gradients are not (r = 0.156), and both first gradients show a
rostro-caudal anterior-to-posterior transition on the atlas.

Cross-check: `Figure6_SC_eigenvalues.npy` re-summarised by
`ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot` gives `mean_eigenvalue`
= −0.005007237508854417, identical to `sc_eigenvalues_mean` here. If those two ever disagree,
the artifact on disk is stale.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/reference_implementation.py
```
