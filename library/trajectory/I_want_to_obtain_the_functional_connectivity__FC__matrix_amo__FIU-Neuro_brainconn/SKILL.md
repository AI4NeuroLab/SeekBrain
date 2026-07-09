---
name: "Zebrafish Functional Connectivity Matrix Analysis and Visualization"
description: "Computes Pearson correlation-based functional connectivity matrices for zebrafish larvae, applies spatial masking based on excluded brain regions, and calculates the group-averaged connectivity."
triggers:
  - "calculate the functional connectivity matrix for my zebrafish data"
  - "how do I compute the average FC matrix across all larvae?"
  - "mask excluded brain regions in my functional connectivity analysis"
  - "process region_series_dff.npy to get spontaneous functional connectivity"
  - "generate and visualize group-level FC matrices from calcium imaging"
tags:
  - "functional-connectivity"
  - "zebrafish"
  - "calcium-imaging"
  - "neuroscience"
  - "pearson-correlation"
  - "data-processing"
version: "1.0"
---

# Skill: Functional Connectivity Matrix Computation and Group-Level Visualization

## Overview
Functional connectivity (FC) analysis reveals the statistical interdependence between spatially separated brain regions. This skill outlines the methodology for quantifying brain-wide coordination in zebrafish larvae by calculating Pearson correlation matrices from calcium imaging time-series data. The process emphasizes extracting the spontaneous activity period, masking noise-prone regions, and synthesizing individual connectivity patterns into a comprehensive group-level map.

The implementation relies on integrating custom data processing pipelines for temporal slicing and masking with standard graph-theory operations. While the `brainconn` library provides the structural framework for thresholding and network visualization, the core correlation computation is performed using robust NumPy operations to ensure data integrity during the calculation of pairwise coupling.

## Objective
To generate individual functional connectivity matrices for zebrafish larvae, apply regional exclusion masks, compute the group-averaged connectivity matrix, and visualize the resulting network structure.

## Background (from Paper)
### Scientific Context
The zebrafish brain displays spontaneous activity patterns that reflect functional circuits. Functional connectivity is defined as the Pearson correlation coefficient between the dF/F time series of region pairs, serving as a proxy for neuronal co-activation.

### Methods Description
1. **Temporal Truncation:** Analysis is constrained to the first 600 time points of the `region_series_dff.npy` file to capture spontaneous activity.
2. **Connectivity Mapping:** Pairwise Pearson correlation coefficients are computed for all brain regions.
3. **Regional Masking:** Regions identified in `Figure1_excluded_regions.npy` as artifacts or poor signal-to-noise contributors are removed.
4. **Aggregation:** Individual filtered matrices are averaged across all specimens to produce a group-level connectivity estimate.

### Expected Results
The output produces a symmetric matrix representing the functional coupling strength between regions. The visualization is a heatmap where the diagonal is zero, revealing highly connected functional modules within the larval brain.

## Implementation Guidance
### Verified Repository Components
- `brainconn/utils/matrix.py`: Used for `threshold_absolute` to clean the average matrix.
- `brainconn/utils/visualization.py`: Used for `adjacency_plot_und` to visualize the final network.

### Conceptual Implementation Plan
1. **Temporal Subsetting:** Slice each `region_series_dff.npy` array to index `[:, :600]`. (Assumption: All files have at least 600 time points).
2. **Correlation Calculation:** Use `np.corrcoef` on the transposed subset (Time, Regions) to generate a symmetric region-by-region matrix.
3. **Masking:** Use `np.delete` or boolean indexing to prune indices listed in the exclusion file.
4. **Group Averaging:** Stack individual matrices and compute `np.mean` across the cohort.
5. **Thresholding:** Apply `threshold_absolute` to the average matrix to reduce visualization noise.

### Dependencies
- `numpy`
- `matplotlib`
- `scipy`
- `brainconn` (Local library)

## Structured Prompt
### Input Specification
1. `region_series_dff.npy`: Time-series array [Regions, Timepoints].
2. `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`: Array of indices to mask.
3. `atlas_coords.npy` (or equivalent): Spatial coordinates for visualization mapping.

### Processing Steps
1. **Load Data:** Load the time-series array and the exclusion index array for each fish.
2. **Slice:** Extract the first 600 time points: `subset = data[:, :600]`.
3. **Compute Correlation:** Calculate the full correlation matrix: `fc = np.corrcoef(subset)`.
4. **Mask:** Identify inclusion indices: `keep = np.setdiff1d(np.arange(fc.shape[0]), excluded_indices)`.
5. **Extract:** Generate filtered matrix: `fc_filtered = fc[np.ix_(keep, keep)]`.
6. **Aggregate:** Average the filtered matrices from all larvae.
7. **Threshold:** Run `threshold_absolute(avg_matrix, thr=0.2)` to isolate significant connections.
8. **Visualize:** Pass thresholded matrix and coordinates to `adjacency_plot_und`.

### Output Specification
- Individual filtered matrices (.npy format).
- `group_average_FC.npy`: The averaged, thresholded matrix.
- `heatmap_fig.png`: Visual heatmap of the group average.

### Validation Criteria
- Matrix dimensions after masking should be `(N - M) x (N - M)`, where M is the number of excluded regions.
- Final heatmap colormap must be 'RdBu_r' with a zero-centered scale.

## File Structure

```
I_want_to_obtain_the_functional_connectivity__FC__matrix_amo__FIU-Neuro_brainconn/
    references/
        matched_files/
            brainconn___init__.py
            brainconn_clustering___init__.py
            brainconn_clustering_clustering.py
            brainconn_utils___init__.py
            brainconn_utils_matrix.py
            brainconn_utils_visualization.py
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
- `compute_fc.py`: Script to iterate through fish directories, perform Pearson correlation, apply masking, and save individual files.
- `calculate_average_fc.py`: Script to load saved individual matrices, compute the group mean, and generate the final visualization.

## References Documentation
- `Figure1_excluded_regions.npy`: Stores the indices of noisy or non-neuronal brain regions.

## Usage Example
```bash
python compute_fc.py --input_dir ./data --output_dir ./results
python calculate_average_fc.py --data_dir ./results --viz_output ./heatmap.png
```

## Notes & Caveats
- Ensure your `region_series_dff.npy` format is `[Regions, Timepoints]`. Transpose if `np.corrcoef` detects the wrong axis.
- If the number of regions is inconsistent across larvae, standard matrix averaging is invalid; ensure all files adhere to the same brain atlas template.
- Negative correlations represent anti-correlated activity; ensure the visualization captures these values using a diverging color scale.