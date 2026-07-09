---
name: "Spatial Distribution and Statistical Thresholding of Functional Neurons"
description: "Aggregates functional neuron coordinates from multiple zebrafish larvae into a common atlas space and applies a P < 0.025 spatial statistical threshold to identify consistent neuronal populations."
triggers:
  - "map individual neurons into zebrafish atlas coordinates"
  - "calculate spatial density of functional neurons across fish larvae"
  - "apply P < 0.025 threshold to neuron distribution data"
  - "process correlated motor and light dark response neuronal clusters"
  - "filter sparse neuronal populations using 3D spatial statistics"
tags:
  - "zebrafish"
  - "neuroimaging"
  - "spatial-statistics"
  - "atlas-registration"
  - "kernel-density-estimation"
version: "1.0"
---

# Skill: Mapping and Statistical Thresholding of Functional Neuron Distributions

## Overview
This skill describes the process of aggregating functionally defined neuronal coordinates from individual zebrafish larvae into a common 3D atlas space. By normalizing neuronal positions across animals and applying a statistical spatial threshold, researchers can identify brain regions with consistent functional tuning (motor or light/dark responsiveness) while filtering out stochastic noise.

The implementation relies on transforming raw functional coordinate files (`.npy`) into a reference coordinate system using provided registration parameters, followed by a Kernel Density Estimation (KDE) to characterize the population-level spatial distribution. Significance is determined through a spatial permutation test, ensuring that observed clusters are not artifacts of individual anatomical variation or sparse sampling.

## Objective
To generate statistically thresholded 3D density maps of functionally categorized neurons (correlated/anticorrelated motor, light, and dark responses) across all available zebrafish larvae.

## Background (from Paper)
### Scientific Context
Functional imaging in larval zebrafish allows for the identification of neurons tuned to specific stimuli or behaviors. Because of individual anatomical variability, these neurons must be mapped to a canonical 3D atlas to identify conserved, population-level functional circuits.

### Methods Description
1. **Registration:** Transform individual functional neuron coordinates to the standard atlas space using affine/deformable transformation matrices.
2. **Aggregation:** Compile mapped coordinates by functional category (motor, light, dark) across the entire cohort.
3. **Density Estimation:** Use 3D Gaussian Kernel Density Estimation (KDE) to create a continuous representation of neuron density.
4. **Statistical Thresholding:** Apply a permutation-based null model to reject voxels where observed density does not significantly exceed baseline noise at a $P < 0.025$ level.

### Expected Results
The output consists of spatially resolved, high-confidence maps showing where neurons with specific functional tuning reliably cluster within the zebrafish brain.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context.

### Conceptual Implementation Plan
The implementation requires iterating through all larvae folders, conditionally loading files (`correlated_motor.npy`, `anticorrelated_motor.npy`, `correlated_dark.npy`, `correlated_light.npy`), and applying the corresponding coordinate transform from the `atlas/transforms/` directory. After registration, compute a 3D KDE and perform a permutation test (shuffling fish IDs 1,000+ times) to create a null distribution for the $P < 0.025$ threshold.

### Dependencies
*   Python 3.8+
*   `numpy`, `scipy` (for KDE)
*   `nibabel` (for NRRD/NIfTI atlas handling)
*   `scikit-learn` (optional for neighbor-based density estimations)

## Structured Prompt
### Input Specification
1. **Individual Fish Folders:** Containing `correlated_motor.npy`, `anticorrelated_motor.npy`, `correlated_dark.npy`, and `correlated_light.npy`.
2. **Atlas Directory:** `/atlas` containing `reference_brain.nrrd` (or similar) and subdirectory `transforms/` containing matrices per fish.

### Processing Steps
1. **Iterative Loading:** Loop through folders; for each, check for the existence of motor files. Append neurons to list arrays keyed by functional type.
2. **Normalization:** Normalize the count of neurons per fish by the total neuron count detected in that fish to prevent dominant bias.
3. **Registration:** Transform local coordinates using individual-specific warp/affine matrices found in `/atlas/transforms/`.
4. **KDE Execution:** Generate 3D density volumes for each category using a consistent bandwidth (e.g., 5-10 microns).
5. **Permutation Test:** Shuffle functional labels 5,000 times to generate a null distribution of density values.
6. **Thresholding:** Create a binary mask where `observed_density > percentile(null_distribution, 97.5)` and multiply this by the observed density map.

### Output Specification
*   **Result Files:** `density_map_[category].nrrd` files representing the significant population density for each category.
*   **Thresholded Maps:** Boolean volumes identifying significant cluster regions.

### Validation Criteria
*   **Spatial Consistency:** Verify that neurons from different fish overlap in known anatomical structures (e.g., optic tectum for light-responsive neurons).
*   **Null-Model sanity:** Ensure the null distribution is spatially uniform across the brain mask.

## File Structure

```
I_aim_to_depict_the_spatial_distribution_of_individual_neuro__YuelongWu_mSEMworkflowmanager/
    references/
        matched_files/
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
*   `apply_transforms.py`: Script responsible for mapping local coordinates to atlas space using matrices.
*   `spatial_density_map.py`: Performs KDE and statistical significance thresholding.
*   `data_loader.py`: Utility to handle conditional loading of files based on folder content.

## References Documentation
*   `/atlas/reference_brain.nrrd`: The master spatial reference for all registration.
*   `/atlas/transforms/`: Directory containing the specific affine/deformable warping matrices per fish.

## Usage Example
```bash
python scripts/analysis/spatial_density_map.py --data_dir ./fish_data --atlas_dir ./atlas --threshold 0.025
```

## Notes & Caveats
*   **Normalization:** Failure to normalize by total neuron count per fish can cause high-neuron-count larvae to dominate the spatial average.
*   **Memory Usage:** KDE on a high-resolution grid is memory-intensive; consider downsampling the grid if processing crashes.
*   **Registration:** The quality of the final thresholded map is strictly limited by the precision of the registration matrices provided in the `/atlas` folder.