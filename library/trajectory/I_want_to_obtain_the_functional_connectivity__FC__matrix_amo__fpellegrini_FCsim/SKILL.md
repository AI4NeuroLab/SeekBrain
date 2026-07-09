---
name: "Larval Zebrafish Functional Connectivity Matrix Generator"
description: "Calculates and averages brain-region functional connectivity matrices from zebrafish DFF time series data, applying specified region exclusions and Fisher Z-transformation."
triggers:
  - "calculate functional connectivity matrix from zebrafish dff data"
  - "compute average fc matrix across fish larvae"
  - "remove excluded brain regions from connectivity analysis"
  - "generate and visualize group-averaged functional connectivity heatmap"
  - "perform pearson correlation analysis on spontaneous neural activity"
tags:
  - "zebrafish"
  - "neuroscience"
  - "functional-connectivity"
  - "calcium-imaging"
  - "data-analysis"
version: "1.0"
---

# Skill: Functional Connectivity Matrix Computation and Visualization for Larval Zebrafish

## Overview
This skill provides a systematic approach for calculating functional connectivity (FC) matrices from calcium imaging time series. By extracting spontaneous neural activity from region-based Delta F/F (DFF) data, we can define connectivity as the Pearson correlation between region pairs. Following the standard methodology for this research domain, this skill incorporates regional filtering based on experimental exclusion masks and utilizes Fisher Z-transformation to ensure accurate group-level averaging.

The provided `FCsim` repository is a benchmarking tool for EEG simulation and does not contain the necessary modules to process calcium imaging data. Therefore, this implementation relies on custom Python logic to perform the extraction and analysis of the zebrafish neuroimaging datasets.

## Objective
The objective is to compute individual-level FC matrices for larval zebrafish, apply regional exclusion masks as defined by the study, generate a group-averaged connectivity matrix, and visualize the results as a correlation heatmap.

## Background (from Paper)
### Scientific Context
Functional connectivity in larval zebrafish is defined by the spatiotemporal correlation of neural activity across brain regions. By focusing on the "spontaneous period" (initial 600 time points), the analysis isolates baseline neural coordination from external stimuli or task-evoked activity.

### Methods Description
1. **Time Series Selection:** Subset the input DFF matrix to the first 600 temporal observations.
2. **Data Cleansing:** Remove artifactual or non-neuronal regions defined in `Figure1_excluded_regions.npy`.
3. **Correlation Calculation:** Calculate the Pearson correlation coefficient ($R_{ij}$) for all pairs of retained regions.
4. **Fisher Z-Transformation:** Transform $R$ values to $Z$ via $Z = \text{arctanh}(R)$ to normalize the distribution for statistical averaging.
5. **Group Aggregation:** Average the Z-matrices across all larvae ($Z_{avg} = \text{mean}(Z)$).
6. **Inverse Transformation:** Revert to correlation space using $R_{final} = \tanh(Z_{avg})$ for visualization.

### Expected Results
The final output is a symmetric $N \times N$ correlation matrix (where $N$ is the number of included regions) and a corresponding heatmap visualization typically displaying a range of $[-1, 1]$ correlation, highlighting functional modules within the zebrafish brain.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context.

### Conceptual Implementation Plan
The analysis requires a Python-based pipeline using `numpy` and `scipy`.
1. Iterate through each larva’s directory to load the `region_series_dff.npy` file.
2. Load the binary/index exclusion mask from `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`.
3. Compute the pairwise correlation matrix using `numpy.corrcoef` on the subsetted data.
4. Perform the Fisher Z-transform, store the Z-matrices, and compute the mean.
5. Use `matplotlib` or `seaborn` to render the final averaged matrix.

### Dependencies
* `numpy`: Array manipulation and mathematical operations.
* `scipy`: Statistical transformations (`arctanh`, `tanh`).
* `matplotlib`/`seaborn`: Visualization of the connectivity matrix.

## Structured Prompt
### Input Specification
1. `region_series_dff.npy`: Array of shape `[time_points, regions]` for each larva.
2. `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`: Array containing indices of regions to be excluded.

### Processing Steps
1. **Subset Data:** Load the DFF array and slice the time dimension: `data_subset = data[0:600, :]`.
2. **Exclude Regions:** Apply the mask: `clean_data = np.delete(data_subset, excluded_indices, axis=1)`.
3. **Correlation:** Generate the matrix: `R = np.corrcoef(clean_data, rowvar=False)`.
4. **Transformation:** Convert to Z-space: `Z = np.arctanh(R)`.
5. **Averaging:** Stack all larval $Z$ matrices into a 3D array and calculate `mean_Z = np.mean(stack, axis=0)`.
6. **Reversion:** `mean_R = np.tanh(mean_Z)`.

### Output Specification
1. **Individual FC Files:** `.npy` file per larva containing the individual connectivity matrix.
2. **Group Average:** `group_avg_FC.npy` containing the final averaged matrix.
3. **Visualization:** A heatmap representing the group-level functional connectivity.

### Validation Criteria
1. **Symmetry:** Matrix $R$ must satisfy `R == R.T`.
2. **Dimensions:** Final matrix must match `(N_total - N_excluded)`.
3. **Diagonal Integrity:** Diagonal elements should represent the self-correlation of regions (typically 1.0).

## File Structure

```
I_want_to_obtain_the_functional_connectivity__FC__matrix_amo__fpellegrini_FCsim/
    references/
        matched_files/
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
* `compute_fc.py`: (Assumed) Custom script to load, mask, and compute individual Pearson correlations for all larvae in the dataset.
* `aggregate_fc.py`: (Assumed) Custom script to apply Fisher Z-transformation, calculate the mean, and generate the final visualization heatmap.

## References Documentation
* `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`: Contains the list of indices of brain regions identified by the research team as having artifacts or low signal-to-noise ratios.

## Usage Example
```bash
# Execute custom python script to process and aggregate FC matrices
python compute_fc.py --input_dir ./data --output_dir ./results
python aggregate_fc.py --data_dir ./results --mask ./PROCESS_DATA_DIR/Figure1_excluded_regions.npy
```

## Notes & Caveats
* **Zero-Variance:** Ensure that no regions have zero variance across the 600 time points, as this will result in `NaN` correlation coefficients.
* **Fisher Transformation:** Do not skip the Fisher Z-transformation; averaging raw Pearson coefficients is statistically invalid because the distribution is bounded and skewed.
* **Compatibility:** This process is strictly for Python/NumPy environments and is incompatible with the MATLAB-based `FCsim` framework.