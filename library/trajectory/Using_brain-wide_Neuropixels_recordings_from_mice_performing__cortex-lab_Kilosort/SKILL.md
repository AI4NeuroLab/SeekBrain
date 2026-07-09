---
name: "IBL Brain-Wide Stimulus-Side Modulation Analysis"
description: "Generates a Swanson-style brain flatmap visualizing single-cell stimulus-side modulation statistics by mapping BWM Neuropixels data across the Beryl-level hierarchical atlas."
triggers:
  - "Generate a Swanson flatmap of visual stimulus modulation from BWM data"
  - "How do I analyze neuronal stimulus-side selectivity in IBL brain-wide recordings?"
  - "Calculate region-level significance for visual stimulus modulation in mice"
  - "Create a brain-wide map of stimulus-side modulated units using iblatlas"
  - "How to run a condition-controlled Mann-Whitney U test on IBL spike data?"
tags:
  - "Neuroscience"
  - "Neuropixels"
  - "IBL"
  - "Brain-Wide-Map"
  - "Electrophysiology"
  - "Swanson-Flatmap"
version: "1.0"
---

# Skill: Generating Brain-Wide Visual Stimulus-Side Modulation Flatmaps

## Overview
This skill implements a meta-analysis of the International Brain Laboratory (IBL) Brain-Wide Map (BWM) dataset to visualize stimulus-side modulation across the entire mouse brain. By aggregating thousands of high-quality Neuropixels recordings, this workflow allows researchers to map the functional distribution of neurons that represent visual choice-side information (left vs. right).

The analysis follows the strict BWM consensus protocol: it requires controlling for behavioral variables (block prior and motor choice) and temporal non-stationarity. By utilizing a stratified Mann-Whitney U test combined with within-episode permutation testing, the skill isolates feed-forward visual processing from choice history and drift, rendering the final results on a standardized Swanson-style flatmap.

## Objective
To quantify the fraction of significantly stimulus-modulated neurons per brain region and visualize these regional statistics on a portrait-orientation Swanson flatmap, identifying brain areas involved in visual decision-making.

## Background (from Paper)
### Scientific Context
The BWM project aims to provide a comprehensive view of brain-wide neural activity during a standardized visual decision-making task. The goal is to determine which cortical and subcortical regions encode sensory information versus choice/history signals.

### Methods Description
1.  **Unit Filtering:** Exclude low-quality units (label < 1 from metrics).
2.  **Temporal Window:** Isolate spikes in the 0–100 ms window following stimulus onset.
3.  **Statistical Control:** Perform a Mann-Whitney U test stratified by trial condition (block probability × choice), totaling four conditions.
4.  **Permutation Strategy:** Shuffle stimulus side labels *within* block episodes (3000 iterations) to preserve session-long temporal drift characteristics.
5.  **Region Aggregation:** Calculate the fraction of significantly modulated units per session, then average these fractions across sessions for each region (minimum threshold: 5 units/session, 2 sessions/region).
6.  **Multiple Comparison Correction:** Use Benjamini-Hochberg FDR correction at $q=0.01$.

### Expected Results
The BWM analysis typically reveals significant stimulus modulation primarily in visual areas (VISp, VISl, VISa) and subcortical structures like the superior colliculus (SC), while higher-order associative areas show varying degrees of stimulus-side representation dependent on the task's decision-making demands.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The provided repository pertains exclusively to KiloSort (spike sorting) and does not contain the IBL analysis pipeline.

### Conceptual Implementation Plan
1.  **Data Acquisition:** Use the IBL `ONE` (Open Neuroscience Environment) API to download session metadata (`bwm_sessions.csv`), trial tables (`_ibl_trials.table.pqt`), and spike-sorted data.
2.  **Registration:** Map channel IDs to the Beryl-level hierarchy using `iblatlas`.
3.  **Compute:** Iterate through each valid session, performing the stratified permutation test on all units.
4.  **Correction:** Apply FDR correction across all tested regions.
5.  **Render:** Utilize `iblatlas.plots.plot_swanson` to generate the final portrait-oriented flatmap.

### Dependencies
*   `one-api`: Data retrieval.
*   `iblatlas`: Anatomical mapping and flatmap visualization.
*   `brainbox`: PSTH calculation and feature extraction.
*   `scipy.stats`: Mann-Whitney U test.
*   `statsmodels`: Multiple comparison correction (FDR).

## Structured Prompt
### Input Specification
1. `bwm_sessions.csv`: List of consensus-quality BWM sessions.
2. `spikes.times.npy` / `spikes.clusters.npy`: Raw spike data.
3. `_ibl_trials.table.pqt`: Behavioral condition table.
4. `clusters.metrics.pqt`: Quality control labels.
5. `channels.brainLocationIds_ccf_2017.npy`: Anatomical registration files.

### Processing Steps
1.  **Load & Filter:** Query the `ONE` API for sessions in `bwm_sessions.csv`. Load data and filter for units with `label >= 1`.
2.  **Map Regions:** Use `iblatlas.regions` to remap Allen CCF IDs to the Beryl hierarchy.
3.  **Calculate PSTH:** Extract spike counts in the 0–100 ms window for every unit per trial.
4.  **Test Significance:** Conduct the Mann-Whitney U test on the 4 stratified conditions. Apply 3000 within-episode permutations.
5.  **FDR Correction:** Accumulate p-values per region and apply FDR at $q=0.01$.
6.  **Visualize:** Use `iblatlas.plots.plot_swanson` to map the fractions, using green for significant, grey for non-significant, and white for unanalysed.

### Output Specification
*   A portrait Swanson flatmap (PNG/SVG).
*   A summary table of Beryl regions: [Region Name, Fraction Significant, Number of Analyzed Units].

### Validation Criteria
*   Ensure the permutation shuffle occurs *within* block episodes (not session-wide).
*   Confirm the inclusion criteria (5 units/session; 2 sessions/region) is applied before calculating regional fractions.

## File Structure

```
Using_brain-wide_Neuropixels_recordings_from_mice_performing__cortex-lab_Kilosort/
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
*   `analyze_modulation.py` (Custom): Should implement the stratified Mann-Whitney test and permutation logic.
*   `render_flatmap.py` (Custom): Should call `iblatlas.plots.plot_swanson` with the computed regional array.

## References Documentation
*   `bwm_sessions.csv`: Master session list for project-wide consistency.
*   `iblatlas`: Official IBL library for CCF registration and visualization.

## Usage Example
```bash
# Workflow involves calling the analysis script followed by the visualization script
python analyze_modulation.py --sessions bwm_sessions.csv --output results.pkl
python render_flatmap.py --input results.pkl --output swanson_flatmap.png
```

## Notes & Caveats
*   **Memory:** Ensure you have sufficient RAM to handle thousands of units; if not, process sessions in parallel and aggregate results in the final step.
*   **Version Control:** The Beryl hierarchy and CCF registration version must be consistent with the IBL's official `iblatlas` release (typically CCFv2017).