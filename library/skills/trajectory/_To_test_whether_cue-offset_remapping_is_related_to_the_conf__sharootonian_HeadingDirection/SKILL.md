---
name: "Analyze Cue-Offset Remapping and Conflict in Drosophila"
description: "Performs circular-linear Bayesian analysis on fly cue integration data to correlate conflict during combined-cue phases with final offset remapping."
triggers:
  - "calculate cue-offset remapping for flies"
  - "how does cue conflict relate to offset change in drosophila"
  - "analyze relationship between initial and both-cues offsets"
  - "perform circular regression on cue integration data"
  - "process NWB files to test if cue-offset remapping is related to conflict"
tags:
  - "circular statistics"
  - "bayesian modeling"
  - "drosophila neuroscience"
  - "sensorimotor integration"
  - "NWB processing"
version: "1.0"
---

# Skill: Analysis of Cue-Offset Remapping via Circular Conflict Modeling

## Overview
This skill provides a systematic approach to quantifying whether cue-offset remapping in *Drosophila* is driven by conflict experienced during combined-cue sensory integration. The analysis relies on processing behavioral data from 18 individual flies, extracted from NWB (Neurodata Without Borders) files. 

The process involves isolating specific experimental phases—initial, combined, and final—based on the `cue_contrast` stimulus marker. By calculating circular angular differences and performing a Bayesian linear regression with von Mises residuals, this analysis differentiates between passive cue drift and active, conflict-induced remapping.

## Objective
To quantify the relationship between cue conflict and remapping by generating a dataset of exactly 36 points (18 flies × 2 cues) and fitting a circular-linear trend line to assess how initial conflict predicts final offset changes.

## Background (from Paper)
### Scientific Context
Sensory integration research posits that when an organism encounters conflicting cues, its internal representation of those cues may undergo "remapping." The degree to which the representation shifts (offset change) is hypothesized to be a function of the discrepancy perceived during the conflicting stimulus (cue conflict).

### Methods Description
1. **Segmentation:** Data is partitioned into five phases: initial cue 1, initial cue 2, both-cues, final cue 1, and final cue 2.
2. **Circular Statistics:** All angular calculations must account for the periodic nature of headings using the `arctan2` wrap-around method to prevent artifacts at the $\pm 180^\circ$ boundary.
3. **Statistical Modeling:** Because the dependent variable (offset change) is angular, standard OLS regression is insufficient; a Bayesian model assuming a von Mises likelihood is employed to accommodate circular noise.

### Expected Results
The paper reports that remapping is often proportional to the conflict experienced, resulting in a positive slope in the scatter plot where Cue 1 and Cue 2 data align along a trend line governed by the Bayesian fit.

## Implementation Guidance
### Verified Repository Components
- `analysis/remap_conflict_analysis.py`: Core logic for circular differencing and data aggregation.
- `stats/bayesian_circular_model.py`: Bayesian model definition using von Mises likelihood.
- `plotting/plot_remapping_vs_conflict.py`: Visualization script for scatter plots.
- `data_loader/nwb_processor.py`: Extraction of `cue_contrast` segments.
- `utils/circular_stats.py`: Utility functions for `angle_diff` and circular wrapping.

### Conceptual Implementation Plan
1. Extract mean offsets for each fly/cue combination from NWB files using `nwb_processor.py`.
2. Compute `cue_conflict` ($\text{both} - \text{initial}$) and `offset_change` ($\text{final} - \text{initial}$) using circular wrapping in `utils/circular_stats.py`.
3. Consolidate into a 36-row dataset.
4. Pass the dataset to the `bayesian_circular_model.py` to fit $\mu = \beta_0 + \beta_1 \cdot \text{conflict}$.
5. Plot results using `plot_remapping_vs_conflict.py`, ensuring Cue 1 is black and Cue 2 is gray.

### Dependencies
- `numpy`, `pandas`, `scipy`, `matplotlib`, `pymc`, `arviz`.

## Structured Prompt
### Input Specification
1. 18 NWB files (`fly_*.nwb`) containing heading data and `cue_contrast` arrays.
2. `cue_contrast == 1` (Cue 1), `cue_contrast == 2` (Cue 2), `cue_contrast == 3` (combined).

### Processing Steps
1. **Load Data:** Filter each fly's NWB data to extract the mean offset during the specified `cue_contrast` phases.
2. **Transform:** Compute `conflict = circ_diff(offset_both, offset_initial)` and `change = circ_diff(offset_final, offset_initial)`.
3. **Aggregate:** Ensure the final table has exactly 36 rows (one per fly/cue).
4. **Model:** Execute Bayesian regression to estimate the posterior distribution of the slope.
5. **Visualize:** Map Cue 1 labels to `color='black'` and Cue 2 labels to `color='gray'`.

### Output Specification
- **Table:** `processed/cue_remapping_data.csv` containing the 36 data points and calculated metrics.
- **Model:** Posterior summary file (.json or .txt).
- **Figure:** `figures/remapping_vs_conflict.pdf` scatter plot with trend line and 95% HDI ribbon.

### Validation Criteria
- Row count must be exactly 36.
- All values must reside strictly in $[-180, 180]$.
- Trend line must be derived from Bayesian posterior (not OLS).

## File Structure

```
_To_test_whether_cue-offset_remapping_is_related_to_the_conf__sharootonian_HeadingDirection/
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
- `remap_conflict_analysis.py`: The entry point for processing and aggregating NWB data into the final 36-row format.
- `bayesian_circular_model.py`: Defines the PyMC model using `pm.VonMises` likelihood.
- `plot_remapping_vs_conflict.py`: Generates publication-ready figures.

## References Documentation
- `data/nwb/fly_*.nwb`: Raw data files containing experimental cue markers.

## Usage Example
```bash
python analysis/remap_conflict_analysis.py --input_dir data/nwb/ --output_dir data/processed/
python stats/bayesian_circular_model.py --input data/processed/cue_remapping_data.csv
python plotting/plot_remapping_vs_conflict.py --data data/processed/cue_remapping_data.csv
```

## Notes & Caveats
- Ensure `cue_contrast` labels are indexed correctly; missing phases in any fly will result in a count mismatch—exclude incomplete flies entirely to maintain the 36-point requirement.
- Do not use `scipy.stats.linregress` as a substitute for the Bayesian model, as it ignores the von Mises distribution of circular residuals.