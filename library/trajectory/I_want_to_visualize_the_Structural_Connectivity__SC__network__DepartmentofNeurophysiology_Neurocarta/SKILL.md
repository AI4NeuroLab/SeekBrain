---
name: "Zebrafish Structural Connectivity Network Visualization"
description: "Visualizes zebrafish brain structural connectivity by generating a bilateral network from unilateral data and overlaying color-coded regional centroids onto top and side projection views."
triggers:
  - "Visualize the Structural Connectivity network on the zebrafish atlas"
  - "How to map SC matrix values to zebrafish brain centroids"
  - "Create a bilateral SC network from unilateral terminal data"
  - "Plot connectivity edges on zebrafish top and side view brain projections"
  - "Filter excluded regions and render brain network connectivity"
tags:
  - "zebrafish"
  - "neuroscience"
  - "connectomics"
  - "structural-connectivity"
  - "data-visualization"
  - "brain-atlas"
version: "1.0"
---

# Skill: Visualization of Structural Connectivity (SC) Network on Zebrafish Brain Atlas

## Overview
This skill provides a systematic approach to visualizing the structural connectivity of the zebrafish brain by integrating regional connectivity matrices with standardized anatomical projections. By leveraging graph-theoretical representation, it transforms unilateral connectivity data into a bilateral network, facilitating the study of symmetric inter-hemispheric and intra-hemispheric pathways.

The procedure involves mapping regional centroids—calculated from the atlas—onto 2D high-resolution brain projection images. This workflow effectively mirrors standard connectivity analysis techniques, ensuring that connectivity strength is visually represented through edge attributes while adhering to established anatomical exclusion protocols.

## Objective
The objective is to render a bilateral Structural Connectivity (SC) network overlay on 2D top and side-view zebrafish brain projections, ensuring precise spatial alignment and the filtering of unreliable connectivity data.

## Background (from Paper)
### Scientific Context
The structural connectivity network acts as a topological framework for understanding neural information flow. By representing brain regions as nodes at their spatial centroids, researchers can overlay SC weights to visualize high-connectivity pathways against anatomical landmarks, highlighting functional or structural clusters.

### Methods Description
1. **Network Construction:** Convert the undirected unilateral SC matrix into a symmetric bilateral matrix.
2. **Filtering:** Apply a mask based on `Figure1_excluded_regions.npy` to remove regions identified as unreliable or incomplete.
3. **Spatial Transformation:** Align centroid coordinates with 2D brain projection images using a reflection transformation on the y-axis.
4. **Rendering:** Apply SC weight-based normalization to define visual edge properties (e.g., thickness, opacity, color) and overlay these onto the projection background.

### Expected Results
The output produces standardized visualizations (top and lateral views) where brain regions are connected by lines reflecting the SC value between them, with excluded regions visibly omitted from the map.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The provided implementation relies on logical adaptations of the described Neurocarta framework.

### Conceptual Implementation Plan
The implementation uses a three-stage pipeline:
1. **Matrix Synthesis:** Create the bilateral matrix $B$ by mirroring the unilateral matrix $U$ to cover left and right hemispheres.
2. **Masking:** Exclude indices provided in the exclusion file from both hemispheres.
3. **Projection:** Coordinate transformation ($y_{new} = Y_{max} - y_{old}$) followed by iterative line plotting in `matplotlib` using the filtered SC weights.

### Dependencies
* Python 3.x
* `numpy` (for matrix manipulation)
* `matplotlib` (for rendering)
* `scipy` (for data handling)

## Structured Prompt
### Input Specification
1. `SC_matrix_undirected_terminals_expanded.npy`: Unilateral connectivity matrix.
2. `Figure1_excluded_regions.npy`: List of region IDs to exclude.
3. `regional_centroids.npy`: X, Y, Z coordinate list.
4. `background_top.png` / `background_side.png`: Reference projection images.

### Processing Steps
1. **Generate Bilateral Matrix:** Expand unilateral matrix $U$ to $B$ (dimensions $2N \times 2N$).
2. **Filter Regions:** Identify and remove indices in $B$ corresponding to the exclusion list and their contralateral counterparts.
3. **Normalize Coordinates:** Define `Y_max` based on image pixel height and apply `centroids[:, 1] = Y_max - centroids[:, 1]`.
4. **Render Network:** Iterate through the filtered matrix $B$; for every $B_{ij} > threshold$, plot a segment between centroid $i$ and centroid $j$. Map $B_{ij}$ values to a `viridis` colormap.

### Output Specification
* A composite image (.png or .pdf) displaying the SC network overlaid on the zebrafish projection.
* A CSV file (optional) containing the pruned bilateral matrix.

### Validation Criteria
* Connectivity matrix must be symmetric.
* Excluded regions must have zero degree/no nodes visible in the output.
* Centroids must align with the visual anatomy (e.g., eyes/midbrain boundaries).

## File Structure

```
I_want_to_visualize_the_Structural_Connectivity__SC__network__DepartmentofNeurophysiology_Neurocarta/
    references/
        matched_files/
            Documentation_Documentation.md
            Paper_figures_Code_README.md
            Paper_figures_Interactive_figure_README.md
            README.md
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
* `bilateral_mapper.py`: Orchestrates the expansion of the unilateral matrix and applies the exclusion mask.
* `visualize_network.py`: Handles coordinate transformation and the `matplotlib` rendering loop.

## References Documentation
* `SC_matrix_undirected_terminals_expanded.npy`: Raw source of SC connectivity weights.
* `Figure1_excluded_regions.npy`: Metadata mapping of excluded anatomical nodes.

## Usage Example
```bash
python bilateral_mapper.py --input SC_matrix.npy --mask Figure1_excluded_regions.npy
python visualize_network.py --centroids regional_centroids.npy --background top_view.png
```

## Notes & Caveats
* **Scaling:** Ensure `Y_max` is derived from the actual pixel dimensions of your background image, not the coordinate file, to prevent clipping.
* **Bilateral Symmetry:** The mirroring assumes perfectly symmetrical connectivity; if the raw data is natively unilateral, verify that the mapping of left-to-right regions is correct before finalizing the $2N \times 2N$ matrix.