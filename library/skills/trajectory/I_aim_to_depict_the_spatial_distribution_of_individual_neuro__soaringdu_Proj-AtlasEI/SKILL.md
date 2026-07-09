---
name: "Spatial Distribution Density Mapping of Zebrafish Neurons"
description: "Aggregates 3D neuron coordinates into a reference atlas and applies Gaussian kernel density estimation and statistical thresholding to identify reproducible spatial clusters."
triggers:
  - "Map individual neurons to the zebrafish atlas"
  - "Calculate spatial density of motor-correlated neurons"
  - "Apply P < 0.025 spatial threshold to neuron point clouds"
  - "Generate thresholded maps of light and dark responsive neurons"
  - "Filter non-reproducible neurons across zebrafish larvae"
tags:
  - "zebrafish"
  - "neuroscience"
  - "spatial-analysis"
  - "kernel-density-estimation"
  - "atlas-registration"
  - "statistical-thresholding"
version: "1.0"
---

# Skill: Spatial Mapping and Density Thresholding of Functional Neuronal Distributions

## Overview
This skill describes the methodology for aggregating spatially registered neuronal coordinate data from multiple zebrafish larvae to generate population-level functional distribution maps. The process utilizes 3D Gaussian Kernel Density Estimation (KDE) to convert discrete point clouds into continuous probability density volumes.

To account for inter-individual variability and isolate statistically significant functional clusters, the method employs a Monte Carlo permutation test. By shuffling neuron positions within an anatomical brain mask, a null model is constructed to establish a $P < 0.025$ threshold, effectively filtering out stochastic, non-reproducible neuronal activity.

## Objective
To quantify and visualize the spatial distribution of functionally categorized neurons (motor-correlated, motor-anticorrelated, dark-responsive, and light-responsive) across a cohort of zebrafish larvae, constrained by anatomical boundaries and statistical significance.

## Background (from Paper)
### Scientific Context
The mapping of functional activity to anatomical coordinates allows for the identification of stereotypic "hotspots" in the larval zebrafish brain. Statistical filtering is required to distinguish between consistent, biologically relevant clusters and random neuronal firing noise.

### Methods Description
1.  **Atlas Registration:** Rigid and non-rigid transformation of individual larva brain coordinates to the Z-Brain reference atlas space.
2.  **KDE Smoothing:** Application of a 3D Gaussian kernel to represent individual neuron centroids as continuous spatial densities.
3.  **Null Model Generation:** Random shuffling of neuronal coordinates within the anatomical boundary defined by the atlas mask.
4.  **Thresholding:** Applying a $P < 0.025$ threshold derived from the 97.5th percentile of the null distribution to retain only significantly dense regions.

### Expected Results
The output consists of thresholded, 3D functional density maps that highlight reproducible anatomical regions corresponding to motor and sensory stimulus responses across the population.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context.

### Conceptual Implementation Plan
The implementation requires building an independent script. It assumes the coordinates are already registered to a common 3D space. 
1.  **Data Aggregation:** Use `os` to crawl larva directories, checking for the existence of `correlated_motor.npy`, `anticorrelated_motor.npy`, `correlated_dark.npy`, and `correlated_light.npy` using `os.path.exists()`.
2.  **Smoothing:** Implement `scipy.stats.gaussian_kde` for 3D coordinate arrays.
3.  **Permutation:** Use a `for` loop to execute 1,000 iterations of random spatial redistribution within the binary mask defined by `atlas/`.
4.  **Thresholding:** Perform voxel-wise logical comparisons between the observed density volume and the null distribution volume.

### Dependencies
- `numpy`: Data array management and coordinate storage.
- `scipy`: Calculation of kernel density and statistical distribution.
- `nibabel`: Loading anatomical brain masks from `atlas/`.

## Structured Prompt
### Input Specification
1.  `atlas/` folder: Contains the reference anatomical mask (`.nii` or `.npy` format).
2.  Individual fish folders: Containing `correlated_motor.npy`, `anticorrelated_motor.npy`, `correlated_dark.npy`, and `correlated_light.npy`.

### Processing Steps
1.  **Load Reference:** Load the anatomical brain mask from the `atlas/` folder to define the active volume.
2.  **Aggregate Points:** For each functional category, concatenate the $(X, Y, Z)$ coordinates from all fish folders into one master array.
3.  **Compute Observed Density:** Pass the master coordinate array through a 3D Gaussian KDE.
4.  **Run Null Model:** Execute a loop (e.g., 1,000 iterations) generating random points within the mask and calculating their KDE.
5.  **Calculate Threshold:** Determine the 97.5th percentile density for each voxel across all permutations.
6.  **Apply Filter:** Retain voxels where `Observed_Density > Permutation_97.5th_Percentile`.

### Output Specification
- Four 3D density volumes (one per category) saved as `.npy` arrays or NIfTI files.
- Visual validation: 2D Maximum Intensity Projections (MIPs) of the significant density voxels.

### Validation Criteria
- Density volumes must be zero outside the anatomical boundary mask.
- Thresholded clusters should show spatial continuity rather than sparse, singular voxels.

## File Structure

```
I_aim_to_depict_the_spatial_distribution_of_individual_neuro__soaringdu_Proj-AtlasEI/
    references/
        matched_files/
            morphology-based_neuron_classification.ipynb
            motif_analysis.py
            network_hub_analysis.ipynb
            neuronal_polarity_identification.ipynb
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
- `spatial_analysis_pipeline.py` (Suggested): A custom script to iterate through directories and compute KDE.
- `null_model_generator.py` (Suggested): A module to perform Monte Carlo shuffles within the anatomical mask.

## References Documentation
- `atlas/`: Contains the reference template and binary masks for the zebrafish brain.
- `*.npy` files: Contain $(X, Y, Z)$ coordinate centroids for functional classes.

## Usage Example
```bash
# Example execution command for the spatial analysis script
python scripts/spatial_analysis_pipeline.py --data_root ./data --atlas ./atlas/mask.nii --p_threshold 0.025
```

## Notes & Caveats
- **Memory Consumption:** Calculating 3D KDE on high-resolution volumes is memory-intensive. Downsample the grid resolution if experiencing `MemoryError`.
- **Bandwidth:** The `bw_method` parameter in KDE significantly influences the size of clusters. If maps are too sparse, increase the bandwidth.
- **Handling Files:** The script must implement logic to handle folders where `correlated_motor.npy` and `anticorrelated_motor.npy` are missing, ensuring they do not crash the pipeline.