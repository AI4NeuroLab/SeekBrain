---
name: "Zebrafish Structural Connectivity Network Visualization"
description: "Visualizes the structural connectivity (SC) network by bilateralizing connectivity matrices, filtering excluded brain regions, and overlaying edges onto ZBB brain projections."
triggers:
  - "visualize the zebrafish SC network on the brain atlas"
  - "how do I plot structural connectivity edges on the ZBB template"
  - "create a bilateral SC network plot from my unilateral matrix"
  - "overlay regional connectivity centroids onto zebrafish top and side views"
  - "filter and map structural connectivity data for zebrafish brain visualization"
tags:
  - "zebrafish"
  - "connectomics"
  - "neuroimaging"
  - "network-visualization"
  - "structural-connectivity"
  - "ZBB-atlas"
version: "1.0"
---

# Skill: Visualizing Structural Connectivity (SC) Networks on a Zebrafish Brain Atlas

## Overview
This skill provides a pipeline to project regional structural connectivity (SC) networks onto the Zebrafish Brain Browser (ZBB) atlas. By processing unilateral connectivity matrices into bilateral networks and mapping centroid coordinates onto 2D projection images, this analysis enables the visual inspection of whole-brain connectivity patterns.

The methodology relies on filtering raw SC matrices using region exclusion lists and adjusting anatomical coordinate systems to align with standard ZBB projection orientations. This ensures that the generated visualizations are spatially registered to the morphological background images provided in the brain atlas.

## Objective
To generate a bilateral SC network visualization overlaid on top-view and side-view ZBB projection images, where edge weight and coloring reflect SC intensity derived from `SC_matrix_undirected_terminals_expanded.npy`.

## Background (from Paper)
### Scientific Context
The zebrafish brain atlas serves as a spatial reference for mapping neuronal connections identified via terminal point analysis. Visualizing these networks requires reconciling 3D anatomical centroids with 2D image projections to facilitate the interpretation of circuit-level structural organization.

### Methods Description
1. **Connectivity Expansion:** The unilateral `SC_matrix_undirected_terminals_expanded.npy` is expanded into a symmetric, bilateral connectivity matrix to account for hemispheric symmetry.
2. **Data Pruning:** Regions identified in `Figure1_excluded_regions.npy` are systematically removed, including their bilateral counterparts ($i + N$, where $N$ is the half-brain offset).
3. **Coordinate Transformation:** Regional centroids are loaded and Y-coordinates are inverted using the transformation $Y_{new} = Y_{max} - Y_{old}$ to match ZBB image coordinate systems.
4. **Graph Overlay:** An adjacency-based plotting function iterates through the matrix to draw weighted edges between regional centroids projected onto the atlas background.

### Expected Results
A high-fidelity visualization where structural connections are color-coded by strength, rendered over the anatomical ZBB background. The visualization should show preserved midline symmetry and the absence of excluded regions.

## Implementation Guidance
### Verified Repository Components
*   `Figure1-Layout.ipynb`: Contains logic for loading exclusion lists and performing initial data pruning.
*   `Figure2-Layout.ipynb`: Implements the core bilateralization logic (e.g., `np.tile` or `np.block`) and network visualization calls.
*   `visualization.py`: Contains the `draw_graph` function used to render the network overlay.
*   `Figure1_excluded_regions.npy`: Provided exclusion list for filtering.

### Conceptual Implementation Plan
1. **Load Data:** Import the unilateral matrix and region centroids.
2. **Construct Bilateral Matrix:** Utilize `np.block([[SC, SC_cross], [SC_cross.T, SC]])` to generate the symmetric matrix.
3. **Filter:** Apply a boolean mask derived from `Figure1_excluded_regions.npy` to both the matrix rows/columns and the centroid list.
4. **Adjust:** Perform coordinate inversion on Y-values.
5. **Plot:** Use `draw_graph` to render the network, passing the cleaned matrix and coordinates to the `matplotlib` axes initialized with the ZBB projection.

### Dependencies
*   `numpy`
*   `matplotlib`
*   `scipy`

## Structured Prompt
### Input Specification
1. `SC_matrix_undirected_terminals_expanded.npy` (Structural connectivity matrix)
2. `Figure1_excluded_regions.npy` (Exclusion IDs)
3. Atlas `regionCentroids` (Coordinate data)
4. `projection_top.png` and `projection_side.png` (ZBB background templates)

### Processing Steps
1. **Bilateralize:** Load the unilateral matrix and construct the $2N \times 2N$ symmetric matrix.
2. **Clean:** Load `Figure1_excluded_regions.npy`. Identify all indices $i$ and $i+N$. Use `np.delete` to remove these rows and columns from the matrix and the corresponding entries from the centroid list.
3. **Transform:** Adjust Y-coordinates: `centroids[:, 1] = 974 - centroids[:, 1]`. Verify the constant `974` against your specific atlas image height.
4. **Visualize:** Initialize an axis with the background projection. Call `draw_graph(ax, matrix, centroids)` with appropriate `alpha` and `linewidth` thresholds.

### Output Specification
*   Two `.png` or `matplotlib` objects: A top-view and a side-view projection of the structural network.

### Validation Criteria
*   **Symmetry:** Ensure the resulting connectivity matrix is symmetric across the bilateral diagonal.
*   **Completeness:** Confirm no nodes corresponding to the exclusion list appear on the map.
*   **Registration:** Confirm that regional centroids align with the expected anatomical regions on the grayscale atlas background.

## File Structure

```
I_want_to_visualize_the_Structural_Connectivity__SC__network__pdesrosiers_Legare-2024-zebrafish-brain-networks/
    references/
        matched_files/
            Figure1-Analysis.ipynb
            Figure1-Layout.ipynb
            Figure2-Analysis.ipynb
            Figure2-Layout.ipynb
            Figure3-Analysis.ipynb
            Figure3-Layout.ipynb
            Figure4-Analysis.ipynb
            Figure4-Detrending.ipynb
            Figure4-Layout.ipynb
            Figure5-Analysis.ipynb
            Figure5-Layout.ipynb
            Figure6-Analysis.ipynb
            Figure6-Layout.ipynb
            Figure7-Analysis.ipynb
            Figure7-Layout.ipynb
            README.md
            Supp-Averaging.ipynb
            Supp-ComputingSC.ipynb
            Supp-DatasetsComparison.ipynb
            Supp-FC-vs-Signal.ipynb
            Supp-Figures.ipynb
            Supp-Fingerprinting.ipynb
            Supp-Gradients.ipynb
            Supp-ProcessingLightsheet.ipynb
            Supp-SC-Validations.ipynb
            Supp-SCCM.ipynb
            Supp-SparseSC.ipynb
            genes.py
            main.py
            predictors.py
            stats.py
            visualization.py
        connection_analysis.md
        paper_context.md
        paper_figure_methods.md
        paper_structured_summary.md
        question.md
        repo_context.md
        repo_file_summaries.md
        repo_overview.md
        reproduction_plan.md
    scripts/
        run_analysis.py
        utils.py
```

## Scripts Documentation
*   `visualization.py`: Contains the `draw_graph` utility. Ensure this module is in the Python path before executing the layout notebooks.

## References Documentation
*   `Figure1-Layout.ipynb`: Primary reference for data cleaning logic and coordinate adjustment parameters.
*   `Figure2-Layout.ipynb`: Primary reference for matrix bilateralization and final plotting function calls.

## Usage Example
```python
# Example of core matrix cleaning logic
import numpy as np
excluded = np.load('Figure1_excluded_regions.npy')
all_excluded = np.concatenate([excluded, np.array(excluded) + 70])
sc_final = np.delete(sc_bilateral, all_excluded, axis=0)
sc_final = np.delete(sc_final, all_excluded, axis=1)
```

## Notes & Caveats
*   **Coordinate Constant:** The value `974` for Y-coordinate flipping is specific to a particular version of the ZBB atlas. If the nodes appear incorrectly placed, verify the image dimensions of your `projection` files.
*   **Thresholding:** Without proper edge thresholding, the visualization may appear overly dense. Adjust the percentile threshold in `draw_graph` to isolate the most relevant structural connections.