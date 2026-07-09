---
name: "Generate IBL Brain-Wide Swanson Flatmap Visualization"
description: "Generates a Swanson projection flatmap for the right hemisphere, color-coding brain regions by the fraction of neurons significantly modulated by visual stimuli."
triggers:
  - "generate a Swanson flatmap of neural stimulus modulation"
  - "create IBL brain-wide activity map for visual stimulus responses"
  - "visualize neuron modulation significance on an Allen CCF flatmap"
  - "plot regional sensory modulation fraction using iblatlas"
  - "map significant visual firing rate changes to a Swanson projection"
tags:
  - "neuroscience"
  - "electrophysiology"
  - "iblatlas"
  - "Allen-CCF"
  - "data-visualization"
  - "statistical-analysis"
version: "1.0"
---

# Skill: Brain-wide Swanson Flatmap Visualization of Stimulus-Modulated Neurons

## Overview
This skill provides a methodology for visualizing the brain-wide distribution of sensory-modulated neurons using the IBL standardized analysis pipeline. By comparing neural firing rates in the 0–100 ms post-stimulus window across 139 mice, this process identifies regions with significant sensitivity to visual stimulus side using the Mann-Whitney U test and FDR correction.

The requested visualization uses the Swanson flatmap projection, a standardized, flattened representation of the mouse brain. The implementation leverages the `iblatlas` library to map anatomical regions under the 'Beryl' nomenclature and plot regional modulation fractions, adhering to strict inclusion criteria for sample size and session count.

## Objective
To generate a right-hemisphere Swanson flatmap visualization in portrait orientation that highlights brain regions significantly modulated by visual stimulus side, colored by the fraction of significantly modulated neurons.

## Background (from Paper)
### Scientific Context
The IBL decision-making task utilizes Neuropixels recordings to investigate the neural basis of sensory processing. Sensory modulation is defined as a statistically significant difference in firing rates between left and right stimulus presentations immediately following stimulus onset.

### Methods Description
1. **Time Window:** Define the analysis window as 0–100 ms post-stimulus onset.
2. **Statistical Test:** Perform a two-sided Mann-Whitney U test per neuron to compare firing rates between stimulus sides.
3. **FDR Correction:** Apply the Benjamini-Hochberg procedure across all regions to ensure $q < 0.01$.
4. **Filtering:** Include only regions with $N \ge 20$ neurons and $N \ge 2$ sessions.

### Expected Results
The paper reports distinct brain-wide patterns of sensory modulation, primarily concentrated in early visual areas and higher-order cortical regions involved in decision-making, which are visualized as gradients of activity on the Swanson flatmap.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The provided repository contains only upstream spike-sorting (Kilosort) logic. Downstream analysis requires external libraries.

### Conceptual Implementation Plan
The analysis involves fetching spike trains via the IBL `ONE` API, computing firing rates using `brainbox`, mapping to the Beryl atlas via `iblatlas`, and rendering the final output using the `iblatlas.plots` module. (Assumption: User has access to the IBL `ONE` environment).

### Dependencies
* `iblatlas`: For anatomy mapping and Swanson projection.
* `brainbox`: For neural activity metrics and firing rate calculation.
* `one-api`: For data retrieval.
* `scipy` and `statsmodels`: For statistical testing and FDR correction.
* `matplotlib`: For rendering and text overlays.

## Structured Prompt
### Input Specification
1. Access to IBL `ONE` API (UUIDs for 139 mice).
2. Pre-sorted spikes (Kilosort output) aligned to stimulus onset times.
3. CCFv3 brain region lookup tables (provided by `iblatlas`).

### Processing Steps
1. **Fetch Data:** Load spike times, cluster IDs, and stimulus timestamps for all sessions.
2. **Assign Anatomy:** Map all clusters to the Beryl atlas nomenclature.
3. **Filter Regions:** Exclude regions with $< 20$ neurons or $< 2$ sessions.
4. **Statistical Analysis:** Calculate firing rates (0–100ms) for Left/Right stimulus conditions. Run `mannwhitneyu` per neuron.
5. **Multiple Comparison Correction:** Perform FDR (Benjamini-Hochberg) across all tested regions ($q=0.01$).
6. **Aggregate:** Compute the fraction of significantly modulated neurons for each qualified region.
7. **Generate Plot:** Use `iblatlas.plots.plot_swanson_vector`, setting orientation to 'portrait' and hemisphere to 'right'. Overlay the significant/total ratio text in the top right.

### Output Specification
* **Format:** PNG or PDF vector graphic.
* **Coloring:** Yellow-green sequential colormap for values [0-1]; grey for non-significant regions; white for excluded/unanalysed regions.

### Validation Criteria
* Confirm the ratio of significant/total regions is displayed in the upper right.
* Verify regional inclusion complies with $N \ge 20$ and $N \ge 2$ rules.

## File Structure

```
Generate_a_brain-wide_flatmap_visualization__Swanson_project__cortex-lab_Kilosort/
    references/
        matched_files/
            Docs_phy_installation_with_templates.txt
            Docs_readme_mac.txt
            Docs_readme_win_linux.txt
            eMouse_readme_eMouse.txt
            licence.txt
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
No scripts were provided in the source repository for this specific analysis. Users should implement a Python script leveraging `iblatlas` and `brainbox` as outlined in the reproduction plan.

## References Documentation
* IBL "Brain-wide organization" paper (Methods: Electrophysiology, Neural activity analysis, Anatomical mapping).
* `iblatlas` documentation (Allen CCFv3, Swanson projections).

## Usage Example
```bash
python generate_swanson_map.py --hemisphere right --orientation portrait --q_threshold 0.01
```

## Notes & Caveats
* This analysis requires high-memory environments for aggregation of 139 sessions.
* Ensure your `ONE` cache is fully synchronized to prevent data retrieval errors during the mapping step.
* Ensure the Beryl mapping is used; results may differ if using the full CCFv3 nomenclature.