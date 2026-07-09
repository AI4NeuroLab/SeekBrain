---
name: "Generate IBL Brain-Wide Stimulus Encoding Swanson Flatmaps"
description: "Generates four-panel Swanson projection flatmaps (right hemisphere) visualizing stimulus encoding statistics derived from IBL Neuropixels data and the Allen CCFv3 Beryl atlas."
triggers:
  - "generate Swanson flatmaps for IBL visual stimulus encoding"
  - "plot neural population trajectory distances on Swanson projection"
  - "calculate brain-wide stimulus encoding model performance with iblatlas"
  - "create portrait orientation brain-wide map of stimulus latency"
  - "visualize Mann-Whitney stimulus modulation on Swanson flatmap"
tags:
  - "neuroscience"
  - "electrophysiology"
  - "iblatlas"
  - "data-visualization"
  - "brain-mapping"
version: "1.0"
---

# Skill: Brain-Wide Encoding Visualization via Swanson Flatmaps

## Overview
This skill describes the process for visualizing visual stimulus encoding across the mouse brain, mirroring the methodologies used in the International Brain Laboratory (IBL) Brain-Wide Map study. The visualization utilizes the Swanson flatmap projection to display four complementary metrics of neural activity: stimulus-side modulation, population trajectory distance, modulation latency, and encoding model improvement (|ΔR²|).

This approach relies on the `iblatlas` toolkit, which aligns Neuropixels-derived neural activity to the Allen CCFv3 brain atlas. By employing standardized Beryl mapping and rigorous statistical thresholding, the visualization provides a reproducible view of how sensory information is distributed and processed across the cortical and subcortical hierarchy.

## Objective
To generate four synchronized Swanson flatmap subplots (right hemisphere, portrait orientation) that visualize visual stimulus encoding metrics, specifically restricted to regions meeting strict data quality criteria (≥20 neurons, ≥2 sessions) and FDR-corrected significance ($q < 0.01$).

## Background (from Paper)
### Scientific Context
The IBL Brain-Wide Map identifies how stimulus information is encoded across 139 mice. Encoding is characterized by rapid, widespread responses across sensory, associative, and motor regions within the first 100 ms following stimulus onset.

### Methods Description
1.  **Region Mapping:** Utilize Beryl-mapped Allen CCFv3 atlas to aggregate neurons into anatomical regions.
2.  **Inclusion Filtering:** Retain only regions with $\ge 20$ neurons across $\ge 2$ sessions.
3.  **Statistical Calculation:**
    *   **Modulation:** Mann-Whitney U test (left vs. right stimulus, 0–100 ms).
    *   **Dynamics:** Euclidean distance of population state space trajectories between stimulus conditions.
    *   **Latency:** Time of first crossing 70% of peak Euclidean distance.
    *   **Model Fit:** GLM comparison (Full vs. stimulus-kernel-omitted models) to calculate $|\Delta R^2|$.
4.  **Thresholding:** Apply False Discovery Rate (FDR) correction at $q < 0.01$.

### Expected Results
Brain-wide visualizations should reveal high encoding density in visual cortical areas and specific thalamic nuclei, with gray-masked regions indicating low statistical confidence and white-masked regions indicating insufficient data.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The provided repository (Kilosort) is restricted to spike-sorting infrastructure.

### Conceptual Implementation Plan
The implementation requires the `iblatlas` Python package and data accessed via the `ONE` (Open Neuroscience Environment) API. The pipeline involves:
1. Fetching trial-aligned spiking data for all regions.
2. Computing the four metrics per region using standard `scipy`/`numpy` routines.
3. Applying FDR correction using `statsmodels` or `scipy.stats`.
4. Rendering figures using `iblatlas.plots.plot_swanson_vector`.

### Dependencies
*   `iblatlas`: For projection and atlas mapping.
*   `ibllib`: For data retrieval via ONE API.
*   `scipy`/`statsmodels`: For statistical testing and FDR correction.
*   `matplotlib`: For plot generation and colormaps.

## Structured Prompt
### Input Specification
1. Spike times and unit IDs from IBL "Brain-wide map" collection.
2. Trial onset and stimulus side metadata.
3. `iblatlas` Beryl-mapped CCFv3 files.

### Processing Steps
1. **Data Preparation:** Use `one.load_object` to load spiking data and trial metadata.
2. **Filtering:** Apply `df.groupby('region').filter(lambda x: len(x) >= 20)` after verifying session counts.
3. **Statistical Analysis:** 
    *   For each region, compute `mannwhitneyu(p_left, p_right)` for the [0, 100]ms window.
    *   Perform FDR correction: `multipletests(pvals, method='fdr_bh')`.
4. **Trajectory/GLM:** Compute population vectors for trajectory distance and use `ibl-glm` wrapper for $|\Delta R^2|$ calculation.
5. **Visualization:** Call `iblatlas.plots.plot_swanson_vector(data, cmap='YlGn', hemisphere='right')`.

### Output Specification
*   **Four Subplots:** A 2x2 grid or vertical stack of Swanson projections.
*   **Coloring:** Yellow-Green colormap; Grey = $q \ge 0.01$; White = No data.
*   **Annotation:** Significant/Total ratio in the top-right corner of each subplot.

### Validation Criteria
*   Ensure right-hemisphere orientation is consistent.
*   Verify FDR $q < 0.01$ thresholding results in gray pixels for non-significant regions.

## File Structure

```
Generate_brain-wide_flatmap_visualizations__Swanson_projecti__cortex-lab_Kilosort/
    references/
        matched_files/
            Docs_phy_installation_with_templates.txt
            readme.md
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
*   `compute_encoding.py` (Conceptual): Performs statistical tests and GLM fitting.
*   `render_flatmap.py` (Conceptual): Wrapper for `iblatlas.plots.plot_swanson_vector` applying the 4-subplot layout.

## References Documentation
*   `iblatlas` documentation: Mapping atlas regions.
*   IBL Brain-wide map paper (2024): Statistical definitions of stimulus encoding.

## Usage Example
```bash
python render_flatmap.py --input_data ./data/ibl_brainwide --output ./plots/stimulus_encoding.pdf
```

## Notes & Caveats
*   Ensure the `Beryl` mapping is used; using standard `CCFv3` will result in sparse data and noisy statistics.
*   The 0–100ms window is highly sensitive to spike-sorting quality; verify data quality using the `phy` GUI before running population metrics.