---
name: "Fly Cue-Offset Remapping and Conflict Analysis"
description: "Analyzes fly navigation data to quantify cue-offset remapping as a function of experienced conflict using Bayesian circular regression."
triggers:
  - "calculate cue-offset remapping for fly navigation"
  - "analyze conflict versus offset change in NWB files"
  - "perform Bayesian linear modeling with von Mises residuals for circular data"
  - "compute circular difference between cue conflict and remapping"
  - "plot cue integration behavior across experimental phases"
tags:
  - "neuroscience"
  - "circular-statistics"
  - "behavioral-analysis"
  - "bayesian-inference"
  - "nwb-processing"
version: "1.0"
---

# Skill: Circular Regression Analysis of Cue-Offset Remapping

## Overview
This skill provides a pipeline for testing whether cue-offset remapping is a consequence of conflict during combined-cue exposure in *Drosophila* navigation experiments. The analysis quantifies behavioral shifts—defined as the circular difference between initial and final cue representations—and relates them to the preceding conflict magnitude experienced during a dual-cue period.

The implementation bridges the provided `fastFMM` infrastructure (designed for functional longitudinal modeling) with custom scalar circular statistics. Because the original package is optimized for Gaussian-distributed functional data, this skill implements a Bayesian circular regression using `brms` to ensure valid treatment of angular periodicities.

## Objective
To quantify the relationship between conflict experienced during the `both-cues` period and the subsequent remapping of cue-offset, using 18 flies (36 fly-by-cue points) to estimate a trend line via a Bayesian linear model with von Mises residuals.

## Background (from Paper)
### Scientific Context
Cue integration often leads to plasticity in internal representations. This analysis determines if the magnitude of remapping (the shift in internal cue offset) is predicted by the magnitude of conflict (the difference between single-cue and combined-cue representations).

### Methods Description
1. **Extraction:** For each fly, isolate offsets for Cue 1 and Cue 2 across five phases: initial single, dual (conflict), and final single.
2. **Metric Definition:**
   - **Conflict:** $\text{angle\_diff}(\text{offset}_{\text{both}}, \text{offset}_{\text{initial}})$
   - **Change (Remapping):** $\text{angle\_diff}(\text{offset}_{\text{final}}, \text{offset}_{\text{initial}})$
3. **Statistical Modeling:** Apply a circular-linear regression model where `Change` is modeled as a function of `Conflict`, assuming von Mises distributed residuals to account for periodic angular wrapping at $\pm 180^\circ$.

### Expected Results
A scatter plot demonstrating a linear correlation between conflict and offset change. A statistically significant regression slope (where the 95% Credible Interval excludes zero) confirms that cue-offset remapping is a systematic consequence of preceding conflict.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context for circular statistics or von Mises regression models.

### Conceptual Implementation Plan
1. **Data Loading:** Use custom logic to parse NWB files (via `rhdf5` or `nwbwidgets`) to extract `cue_contrast` labels 1, 2, and 3.
2. **Circular Transformation:** Utilize a central helper function: `ang_diff <- function(a, b) atan2(sin(a - b), cos(a - b))`.
3. **Modeling:** Use `brms::brm` with `family = von_mises(link = "identity")` to fit the relationship.
4. **Plotting:** Adapt the `ggplot2` theme from `R/plot_fui.R` to visualize the relationship with distinct colors for Cue 1 and Cue 2.

### Dependencies
- `brms`: For Bayesian model fitting with von Mises distributions.
- `tidyverse`: For data manipulation and piping.
- `circular`: For angular data utility functions.
- `rhdf5`: For NWB file data extraction.

## Structured Prompt
### Input Specification
1. A directory containing 18 NWB files corresponding to individual flies.
2. Metadata identifying phases associated with `cue_contrast` labels 1, 2, and 3.

### Processing Steps
1. **Extract Offsets:** For each fly, compute the mean circular heading for Cue 1 (during `cue_contrast == 1`) and Cue 2 (during `cue_contrast == 2`) at their respective first and last occurrences.
2. **Compute Dual Offsets:** Extract the mean circular heading for the corresponding cue during the `cue_contrast == 3` (both-cues) phase.
3. **Calculate Metrics:** Apply the `ang_diff` function to derive `Conflict` and `Change` for all 36 samples (18 flies × 2 cues).
4. **Fit Model:** Fit `brm(Change ~ Conflict + (1|FlyID), data = df, family = von_mises())`.
5. **Generate Figure:** Plot the scatter points, mapping `CueType` to colors (1=Black, 2=Gray) and overlay the predicted mean trend line from the model.

### Output Specification
1. `remapped_data.csv`: A tidy dataframe of the 36 observations and derived metrics.
2. `model_fit.rds`: Serialized `brms` object.
3. `remapping_scatter.pdf`: Scatter plot of conflict vs. remapping.

### Validation Criteria
- Dataset must contain exactly 36 rows.
- All angular values must be restricted to $[-\pi, \pi]$ or $[-180, 180]$.
- The Bayesian model must show R-hat values $< 1.1$ for all parameters.

## File Structure

```
_To_test_whether_cue-offset_remapping_is_related_to_the_conf__awqx_fastFMM/
    references/
        matched_files/
            .github_workflows_R-CMD-check.yaml
            NEWS.md
            README.md
            R_G_estimate.R
            R_G_estimate_randint.R
            R_G_generate.R
            R_d2pvt-data.R
            R_fastFMM.R
            R_fui.R
            R_globals.R
            R_lick-data.R
            R_massmm.R
            R_plot_fui.R
            R_unimm.R
            R_utils.R
            R_var_analytic.R
            R_var_bootstrap.R
            R_var_parallel.R
            cran-comments.md
            data-raw_d2pvt.R
            data-raw_lick.R
            renv_activate.R
            revdep_README.md
            revdep_cran.md
            revdep_failures.md
            revdep_problems.md
            tests_spelling.R
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
- `process_nwb.R`: Orchestrates NWB data loading and calculation of `Conflict`/`Change`.
- `analyze_remapping.R`: Loads processed data and executes the Bayesian regression using `brms`.
- `plot_analysis.R`: Generates the scatter plot using theme components imported from the base repository.

## References Documentation
- `R/fui.R`: Used as a template for the overall analysis pipeline structure.
- `R/plot_fui.R`: Referenced for `ggplot2` design consistency and aesthetic mapping.

## Usage Example
```bash
Rscript process_nwb.R --input_dir ./data/nwb --output ./data/processed_metrics.csv
Rscript analyze_remapping.R --data ./data/processed_metrics.csv --out ./results
```

## Notes & Caveats
- Ensure NWB files are sampled at identical frequency; if not, include an interpolation step before circular mean extraction.
- The `von_mises` family in `brms` requires radians; ensure all conversion constants ($\pi/180$) are applied correctly before model entry.
- Missing data: If a fly does not perform in one of the required phases, it must be excluded from the 36-point set, and the analysis must be adjusted for the reduced sample size.