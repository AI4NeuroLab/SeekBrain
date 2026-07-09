---
name: "Generate Swanson Flatmap Visualizations for IBL Stimulus Encoding"
description: "Generates a four-panel Swanson flatmap visualization analyzing brain-wide neural encoding of visual stimuli using the IBL BWM dataset and iblatlas."
triggers:
  - "Create Swanson flatmap of visual stimulus encoding"
  - "Generate IBL brain-wide stimulus response visualization"
  - "Plot stimulus modulation and trajectory latency on a Swanson flatmap"
  - "Visualize GLM stimulus kernel improvement on Swanson projection"
  - "Produce Beryl-mapped stimulus encoding flatmaps for 139 mice"
tags:
  - "neuroscience"
  - "IBL"
  - "Swanson-projection"
  - "data-visualization"
  - "electrophysiology"
  - "neuropixels"
version: "1.0"
---

# Skill: Brain-wide Swanson Flatmap Visualization of Stimulus Encoding

## Overview
This skill provides a structured approach to generating brain-wide anatomical visualizations of neural responses to visual stimuli, as established by the International Brain Laboratory (IBL) Brain-Wide Map (BWM) research. It translates neural metrics—specifically single-cell modulation, population trajectory dynamics, response latency, and causal model fit—into a standardized, regional Swanson flatmap projection.

This procedure requires synthesizing raw Neuropixels data across 139 mice, mapping neural activity to the Allen CCFv3 atlas using Beryl-mapped regions, and applying specific statistical thresholds to produce four-panel visualizations. Note that the `Waven` repository provided for context is specialized for receptive field analysis and does not contain the BWM infrastructure; this skill relies on the core `iblatlas` and `brainbox` IBL ecosystem libraries.

## Objective
To generate four complementary Swanson flatmap subplots (right hemisphere, portrait orientation) that visualize stimulus encoding strength, speed, and model explanatory power across the entire brain, filtering for regions meeting strict neural density criteria ($\ge 20$ neurons across $\ge 2$ sessions).

## Background (from Paper)
### Scientific Context
The IBL BWM project investigates how sensory information is encoded across the mouse brain. The stimulus-side encoding is quantified within the first 100ms post-onset, capturing the transformation of visual signals into motor-related decisions.

### Methods Description
1.  **Statistical Modulation:** Calculate single-cell firing rate differences between left and right stimulus using the Mann-Whitney U-test (0–100 ms). Correct for multiple comparisons using Benjamini-Hochberg FDR ($q < 0.01$).
2.  **Population Trajectory:** Calculate the Euclidean distance between trial-averaged PSTHs (left vs. right). Extract the log10-scaled maximum distance.
3.  **Latency:** Identify the time point where trajectory distance first crosses 70% of the peak value within the 0–100 ms window.
4.  **Encoding Model:** Fit a GLM with causal stimulus kernels. Quantify improvement as $|ΔR^2| = |R^2_{\text{full}} - R^2_{\text{shuffled}}|$, log10-scaled.

### Expected Results
The paper reports that visual encoding is robust in the primary visual cortex and downstream regions, with specific latency profiles and model-fit improvements that vary by regional hierarchical position.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The provided `Waven` repository lacks the `iblatlas` dependencies and BWM-specific pipeline functions required for this task.

### Conceptual Implementation Plan
The analysis must be implemented using the `iblatlas` and `brainbox` toolkits:
1.  **Ingestion:** Query the IBL `ONE` database for the "2023_Q4_IBL_et_al_BWM" release.
2.  **Aggregation:** Assign neurons to Beryl-mapped regions. Filter regions by the $\ge 20$ neurons / $\ge 2$ sessions rule.
3.  **Vectorization:** Compute metrics for every region in the CCFv3, resulting in four arrays of values.
4.  **Mapping:** Use `iblatlas.plots.plot_swanson_vector` to associate these arrays with the Swanson color look-up table.
5.  **Rendering:** Use `matplotlib` to assemble the four subplots with yellow-green colormaps and overlay significant/total ratio text.

### Dependencies
*   `ibllib`, `iblatlas`, `brainbox`, `one-api` (IBL specific libraries).
*   `numpy`, `pandas`, `scipy` (for statistical tests and log scaling).
*   `matplotlib` (for figure generation).

## Structured Prompt
### Input Specification
1.  Standardized IBL spike-sorting files (Neuropixels, 139 mice).
2.  `BerylMap` anatomical look-up table from `iblatlas`.
3.  Trial onset/offset and stimulus-side labeling metadata.

### Processing Steps
1.  Filter spike data to only include neurons in regions with $\ge 20$ units and $\ge 2$ sessions.
2.  Execute `scipy.stats.mannwhitneyu` per unit and apply `statsmodels.stats.multitest` for FDR correction.
3.  Compute PSTHs for stimulus L vs. R; calculate Euclidean distances and apply the 70% peak thresholding logic.
4.  Run GLM cross-validation (using `brainbox.modeling`) to obtain $|ΔR^2|$.
5.  Aggregate all results by region ID.
6.  Call `iblatlas.plots.plot_swanson_vector` for each of the four metrics.

### Output Specification
*   **Format:** A 4-panel PDF/SVG file.
*   **Content:** Four Swanson flatmaps (right hemisphere, portrait).
*   **Annotation:** Sig/Total ratio in the upper-right corner of each subplot.

### Validation Criteria
*   Ensure all non-significant regions (FDR $q \ge 0.01$) appear in neutral grey.
*   Verify that white regions represent areas where the $\ge 20$ neuron inclusion threshold was not met.

## File Structure

```
Generate_brain-wide_flatmap_visualizations__Swanson_projecti__skriabineSop_waven/
    references/
        matched_files/
            docs_requirement.txt
            docs_requirements.txt
            environment.yml
            examples_example.py
            examples_run_waven_parts.py
            pipeline_correlation_plots.py
            pyproject.toml
            requirements.txt
            src_Waven_Analysis_Utils.py
            src_Waven_LoadPinkNoise.py
            src_Waven_WaveletGenerator.py
            src_Waven___init__.py
            src_Waven_config.py
            src_Waven_pipeline.py
            src_Waven_suite2p___init__.py
            src_Waven_suite2p_utils_cortex_lab_utils.py
            src_Waven_suite2p_utils_mpeppy.py
            src_Waven_suite2p_utils_timelinepy.py
            src_Waven_suite2p_utils_twophopy.py
            src_Waven_suite2p_utils_utils.py
            src_Waven_wavelet_io.py
            src_Waven_zarr_compat.py
            src_Waven_zebraGUI.py
            src_waven___init__.py
            src_waven_analysis_utils.py
            src_waven_config.py
            src_waven_gui.py
            src_waven_pipeline.py
            src_waven_plotting.py
            tests_test_zarr_compat.py
            wavelet_zarr.py
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
*   `ibl_bwm_pipeline.py` (Conceptual): Custom script to iterate over the 139 mouse IDs and perform the metric aggregation.
*   `plot_flatmap_panels.py` (Conceptual): Script using `iblatlas.plots` to render the four panels with consistent `vmin`/`vmax` across the yellow-green colormap.

## References Documentation
*   `iblatlas` Documentation: Defines the Swanson flatmap geometry and `plot_swanson_vector` API.
*   IBL Brain-Wide Map Paper: Defines the specific metrics and FDR thresholds for sensory encoding.

## Usage Example
```bash
python run_bwm_analysis.py --dataset_release 2023_Q4_IBL_et_al_BWM --metric modulation --fdr 0.01
```

## Notes & Caveats
*   The `Waven` repository should NOT be used for this task; it is designed for receptive field analysis, not IBL macro-anatomical meta-analysis.
*   Ensure the orientation matches the Swanson flatmap standard to avoid misrepresenting cortical layers.
*   The 0–100ms window is sensitive to baseline activity; ensure baseline subtraction is performed on PSTHs before calculating trajectory distances.