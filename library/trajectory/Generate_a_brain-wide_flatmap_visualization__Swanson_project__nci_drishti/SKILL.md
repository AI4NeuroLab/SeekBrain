---
name: "Generate Swanson Brain-Wide Functional Flatmap"
description: "Computes regional neural modulation to visual stimuli from Neuropixels data and renders a Swanson flatmap projection using the IBL atlas framework."
triggers:
  - "generate a Swanson projection flatmap for IBL decision-making data"
  - "visualize fraction of modulated neurons per brain region"
  - "create brain-wide flatmap of stimulus-side firing rate differences"
  - "plot significant brain regions on a Swanson map from IBL recordings"
  - "map neural modulation significance to Allen CCFv3 flatmap"
tags:
  - "neuroscience"
  - "iblatlas"
  - "electrophysiology"
  - "data-visualization"
  - "swanson-projection"
version: "1.0"
---

# Skill: Generating Brain-Wide Swanson Flatmap Visualizations for IBL Neuropixels Data

## Overview
This skill describes the methodology for generating a brain-wide Swanson projection flatmap to visualize the functional modulation of neurons in the International Brain Laboratory (IBL) decision-making task. The analysis maps Neuropixels-recorded neurons to the Allen CCFv3 (Beryl nomenclature) to assess stimulus-side sensitivity.

The workflow integrates the `iblatlas` Python package for visualization with custom statistical pipelines to process firing rates, perform Mann-Whitney U testing, and apply Benjamini-Hochberg FDR correction. This process mirrors the analytical framework used in IBL "Brain-wide maps" studies to consolidate high-dimensional electrophysiological activity into standardized anatomical projections.

## Objective
To create a portrait-oriented, right-hemisphere Swanson flatmap representing the fraction of neurons significantly modulated by stimulus side (left vs. right) across brain regions, identifying regional significance at an FDR threshold of $q=0.01$.

## Background (from Paper)
### Scientific Context
The IBL decision-making task measures neural activity during sensory-guided behavior. Regional functional modulation is quantified to determine which brain structures encode task-relevant variables (e.g., stimulus side) and to what extent those neurons are present within specific Beryl-defined anatomical regions.

### Methods Description
1. **Neuron Assignment:** Neurons are mapped to the Allen CCFv3 using the Beryl mapping nomenclature.
2. **Data Filtering:** Regions must contain $\geq 20$ neurons and appear across $\geq 2$ recording sessions to be included.
3. **Statistical Analysis:** A Mann-Whitney U test compares firing rates between left and right stimulus conditions in a 0–100 ms post-stimulus window.
4. **FDR Correction:** P-values are adjusted using the Benjamini-Hochberg procedure at $q < 0.01$.
5. **Visualization:** Significant regions are plotted on a Swanson flatmap, colored by the fraction of modulated neurons ($N_{sig} / N_{total}$) using a yellow-green (`YlGn`) colormap.

### Expected Results
A 2D Swanson projection map where brain regions significantly representing stimulus side exhibit a gradient of color, non-significant regions appear grey, and non-analysed regions appear white, with a text overlay specifying the ratio of significant to total regions.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context.

### Conceptual Implementation Plan
1. **Extraction:** Retrieve firing rate matrices for Beryl-mapped clusters via the `ONE` API.
2. **Computation:** Calculate Mann-Whitney U-statistics per neuron, aggregate results by Beryl ID, and apply FDR correction.
3. **Visualization:** Utilize `iblatlas.plots.plot_swanson_vector` to render the heatmap on the Swanson projection.
4. **Annotation:** Use `matplotlib` to overlay the required "Significant/Total Regions" text in the top-right corner.

### Dependencies
* `iblatlas`: For atlas navigation and Swanson plotting.
* `ibllib`: For ONE API data access.
* `scipy.stats`: For `mannwhitneyu`.
* `statsmodels`: For `multipletests` (FDR).
* `matplotlib`: For visualization rendering and color mapping.

## Structured Prompt
### Input Specification
1. Neuron firing rates for 139 mice, 0–100 ms post-stimulus.
2. Trial event metadata (stimulus side, trial onset).
3. Beryl mapping dictionary for CCFv3 region IDs.

### Processing Steps
1. **Query:** Fetch spike data for all regions; filter to include only neurons meeting the 20-neuron/2-session threshold.
2. **Analyze:** For each region, execute `scipy.stats.mannwhitneyu` on Left vs. Right stimulus trials.
3. **Correct:** Apply `statsmodels.stats.multitest.multipletests(pvals, method='fdr_bh')` to identify significant neurons per region.
4. **Aggregate:** Compute the fraction $f = N_{sig} / N_{total}$ for each valid region.
5. **Map:** Instantiate the `AllenAtlas(atlas_name='beryl')` and initialize a color map array with grey (0.7, 0.7, 0.7).
6. **Render:** Execute `iblatlas.plots.plot_swanson_vector(values, cmap='YlGn', hemisphere='right', orientation='portrait')`.

### Output Specification
* **Format:** PNG or SVG image.
* **Content:** Swanson flatmap (Right hemisphere, Portrait orientation).
* **Markers:** Significant regions colored by fraction; non-significant regions in grey; non-analyzed regions in white.
* **Annotation:** Text box in the upper right corner displaying "Significant/Total Regions".

### Validation Criteria
* Confirm the figure orientation is vertical (portrait).
* Ensure only Beryl-mapped structures are present.
* Verify the color gradient corresponds correctly to the calculated fractions.

## File Structure

```
Generate_a_brain-wide_flatmap_visualization__Swanson_project__nci_drishti/
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
* `analysis_iblatlas` (Reference): Contains the logic for processing firing rate statistical comparisons and applying regional masks for Swanson projection.

## References Documentation
* IBL Nature 2023 "Brain-wide maps" publication: Defines the Beryl mapping and the 20-neuron/2-session filtering criteria.

## Usage Example
```bash
python generate_swanson_map.py --eid_list all_139_mice.csv --output_dir ./results --q_threshold 0.01
```

## Notes & Caveats
* **Beryl Mapping:** Use only Beryl nomenclature; the raw CCFv3 structure hierarchy is too dense for the Swanson projection.
* **Memory:** Process the data region-by-region rather than loading the full dataset for 139 mice into system memory.
* **Color Logic:** Ensure the masked array for the plot differentiates between "Non-significant" (Grey) and "Not-analyzed" (White) to maintain figure clarity.