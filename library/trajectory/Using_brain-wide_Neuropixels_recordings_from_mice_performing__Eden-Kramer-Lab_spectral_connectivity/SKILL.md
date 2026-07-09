---
name: "IBL Brain-Wide Stimulus-Side Modulation Analysis and Swanson Mapping"
description: "Generates a Swanson brain flatmap displaying regional stimulus-side modulation statistics by aggregating single-unit IBL BWM data through trial-stratified permutation testing."
triggers:
  - "generate a Swanson map of stimulus-side modulation for IBL BWM data"
  - "calculate regional visual stimulus selectivity in mouse Neuropixels recordings"
  - "how to perform trial-stratified permutation tests for neural modulation in IBL sessions"
  - "map Beryl-level task modulation results onto a Swanson flatmap"
  - "compute fraction of significantly modulated neurons per brain region using IBL pipelines"
tags:
  - "Neuropixels"
  - "IBL-BWM"
  - "Swanson-flatmap"
  - "electrophysiology"
  - "permutation-testing"
  - "neuroinformatics"
version: "1.0"
---

# Skill: Brain-Wide Analysis of Visual Stimulus-Side Modulation

## Overview
This skill implements the analysis of stimulus-side neural modulation during decision-making tasks using Neuropixels recordings, as established by the International Brain Laboratory (IBL) Brain-Wide Map (BWM) consortium. The methodology relies on standardized Beryl-level regional aggregation and non-parametric statistical testing to isolate stimulus-driven activity from behavioral variables such as block probability and choice.

The analysis provides a systematic approach to quantifying neuronal responses in the 0–100 ms window post-stimulus onset. By accounting for non-stationarity via trial-block-restricted permutations and employing FDR correction at $q=0.01$, this skill produces a statistically rigorous brain-wide map of stimulus selectivity, visualized on a Swanson flatmap.

## Objective
To quantify and visualize the fraction of neurons significantly modulated by visual stimulus side across the mouse brain, identifying primary sensory and associative regions involved in initial visual processing.

## Background (from Paper)
### Scientific Context
The IBL BWM framework aims to map how neural activity is distributed across the cortical and subcortical hierarchy during a standard visual decision-making task. Stimulus-side selectivity is a fundamental metric for determining where in the brain sensory information is transformed into task-relevant signals.

### Methods Description
1. **Data Aggregation:** Aligning individual probe recordings to the Allen CCF (2017) and aggregating into Beryl-level brain regions.
2. **Unit Selection:** Filtering for high-quality units using `clusters.metrics.pqt` with a threshold of `label >= 1`.
3. **Statistical Analysis:** Using a Mann-Whitney U test to compare Left vs. Right stimulus conditions, stratified by choice and block probability to control for global task-related shifts.
4. **Permutation Testing:** Shuffling stimulus labels 3000 times within individual block episodes to preserve temporal non-stationarity of the neural response.
5. **FDR Correction:** Applying the Benjamini-Hochberg procedure at $q=0.01$ to identify significant regional modulation.

### Expected Results
The study identifies robust stimulus-side modulation in early visual areas (V1, LM, AL) and significant modulation in the Superior Colliculus (SC). Higher-order regions like the Posterior Parietal Cortex (PPC) and Retrosplenial Cortex (RSC) are also evaluated for top-down modulation.

## Implementation Guidance
### Verified Repository Components
- `brainwidemap/analysis/task_mod/calculate_modulation.py`: Logic for U-test and permutation testing.
- `brainwidemap/analysis/swanson_plotting.py`: Visualization interface with `iblatlas`.
- `brainwidemap/bwm_loading.py`: Standardized loading of `bwm_sessions.csv`, spikes, and trials.
- `brainwidemap/decoding/settings.py`: Definitions for Beryl-level mappings.

### Conceptual Implementation Plan
The analysis follows a workflow where each session identified in `bwm_sessions.csv` is loaded, neurons are filtered based on the `label >= 1` metric, and spike times are sliced into a 100 ms peri-stimulus window. The permutation test is performed per neuron by shuffling labels strictly within block episodes to ensure that stimulus-side selectivity is not confounded by block-induced drift. Results are aggregated at the Beryl region level, filtering for regions with sufficient statistical power ($\ge 5$ units/session, $\ge 2$ sessions/region), followed by FDR correction and Swanson flatmap generation using `iblatlas.plots.plot_swanson`.

### Dependencies
- `ibllib` (data loading)
- `iblatlas` (anatomy/plotting)
- `statsmodels` (FDR correction)
- `scipy` (Mann-Whitney U)
- `pandas`/`numpy` (Data manipulation)

## Structured Prompt
### Input Specification
1. `bwm_sessions.csv`: Master session list.
2. `spikes.times.npy` / `spikes.clusters.npy`: Spike-sorted data per session.
3. `_ibl_trials.table.pqt`: Behavioral metadata.
4. `channels.brainLocationIds_ccf_2017.npy`: Anatomical labels.
5. `clusters.metrics.pqt`: QC metrics.

### Processing Steps
1. **Load and Filter:** Use `bwm_loading.py` to iterate through sessions. Retain only "good" units (`label == 1`).
2. **Map to Beryl:** Assign units to Beryl regions using `iblatlas.regions.BrainRegions().id2acronym` with the `mapping='Beryl'` argument.
3. **Compute U-stats:** For each neuron, conduct a Mann-Whitney U test (0-100ms post-stimulus). Perform 3000 shuffles per block episode to generate a null distribution of the U-statistic.
4. **Aggregate Regionally:** Calculate the fraction of neurons passing the significance threshold ($p < \text{alpha}$ derived from shuffle) for each region.
5. **Correct for FDR:** Apply `multipletests(p_values, alpha=0.01, method='fdr_bh')` across the regional fraction array.

### Output Specification
1. **Report:** A table listing Beryl regions, the count of significant neurons, total analyzed neurons, and corrected p-values.
2. **Visualization:** A portrait-oriented Swanson flatmap with significant regions colored (green map) and non-significant analyzed regions in grey.

### Validation Criteria
- Ensure permutation shuffle indices do not cross behavioral block boundaries.
- Verify that only regions meeting the $\ge 5$ units/session and $\ge 2$ sessions/region criteria are displayed.
- Confirm visual result consistency with IBL BWM Figure 1/2.

## File Structure

```
Using_brain-wide_Neuropixels_recordings_from_mice_performing__Eden-Kramer-Lab_spectral_connectivity/
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
- `bwm_loading.py`: Fetches session objects and aligns trial timestamps with spike activity.
- `plot_swanson_modulation.py`: Aggregates region statistics and invokes the plotting function.

## References Documentation
- `bwm_sessions.csv`: Defines the scope of the Brain-Wide Map study.
- `channels.brainLocationIds_ccf_2017.npy`: Contains the CCF IDs necessary for regional mapping.

## Usage Example
```bash
python plot_swanson_modulation.py --q_threshold 0.01 --min_units 5 --min_sessions 2
```

## Notes & Caveats
- **Non-stationarity:** Failure to restrict permutations to block episodes will likely inflate false positives due to block-dependent firing rate drift.
- **Computation:** Performing 3000 shuffles per unit across a whole-brain dataset is computationally intensive; parallelize the neuron-level iterations.
- **Ontology:** Always use the 'Beryl' mapping for consistency with IBL publications; using raw CCF regions may result in regions with insufficient neuron counts.