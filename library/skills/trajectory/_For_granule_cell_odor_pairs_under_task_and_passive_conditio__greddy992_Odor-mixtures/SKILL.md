---
name: "Classify and Visualize Granule Cell Odor Response Distributions"
description: "Analyzes and compares granule cell odor responses between task-engaged and passive conditions by aggregating experimental data, applying Boolean classification masks, and generating comparative pie charts."
triggers:
  - "classify granule cell responses for task vs passive conditions"
  - "calculate percentage of odor-excited and inhibited cell pairs"
  - "visualize odor response distribution side by side"
  - "how do I pool task and passive data for odor classification"
  - "generate pie charts for cell-odor pair response types"
tags:
  - "neuroscience"
  - "olfactory-bulb"
  - "data-classification"
  - "population-dynamics"
  - "visualization"
version: "1.0"
---

# Skill: Granule Cell Odor Response Classification and Comparative Population Analysis

## Overview
This skill allows researchers to classify granule cell (GC)–odor pair responses into excited, inhibited, or non-responsive categories by pooling experimental datasets. By integrating task-engaged (`result_ld`, `result_lc`) and passive (`result_pd`, `result_pc`) conditions, this procedure enables a comparative analysis of how neural population dynamics shift between active task performance and passive observation.

The implementation relies on boolean masking of binary classification arrays, facilitating the quantification and visualization of population-wide response distributions. This analysis is critical for confirming findings regarding the state-dependent modulation of granule cell activity in the olfactory bulb.

## Objective
To categorize GC–odor pairs for both task and passive conditions, calculate the relative frequency of each response type (excited, inhibited, non-responsive), and visualize the difference in population-level odor representation using side-by-side pie charts.

## Background (from Paper)
### Scientific Context
Granule cells are theorized to mediate odor-specific inhibition and shape glomerular output. The research examines whether engagement in a task alters the sensitivity or polarity of these responses compared to passive sensory processing.

### Methods Description
1.  **Aggregation:** Data is pooled by condition: Task = `Union(result_ld, result_lc)`; Passive = `Union(result_pd, result_pc)`.
2.  **Classification:** For each condition, pairs are labeled as excited if the corresponding value in the `exc` mask is 1, and inhibited if the value in the `inh` mask is 1.
3.  **Residual Assignment:** Any pair not flagged as excited or inhibited is explicitly defined as non-responsive to prevent overlapping classification.
4.  **Normalization:** Population response percentages are computed relative to the total number of cell–odor pairs in each pooled set.

### Expected Results
The study reports the proportional shift in odor-excited and odor-inhibited granule cells, typically showing that task-engaged states modulate the population-wide response distribution compared to passive states.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context; the provided code focus is on mechanistic modeling rather than empirical data analysis of the `result_*` files.

### Conceptual Implementation Plan
The analysis requires a new Python script to perform manual data aggregation and logical masking. 
1.  **Loading:** Use `np.load()` to read all `result_` and classification arrays.
2.  **Concatenation:** Apply `np.concatenate` or `np.vstack` to pool the `ld/lc` arrays and `pd/pc` arrays.
3.  **Masking:** Use vectorized boolean operations: `excited = (exc_mask == 1)`, `inhibited = (inh_mask == 1)`, `non_responsive = ~(excited | inhibited)`.
4.  **Statistics:** Aggregate the count of each mask and divide by the array length.
5.  **Plotting:** Use `matplotlib.pyplot.subplots(1, 2)` to render two `pie` plots representing the distribution for task and passive conditions respectively.

### Dependencies
*   `numpy`: Used for array aggregation and boolean masking.
*   `matplotlib`: Used for generating pie chart visualizations.

## Structured Prompt
### Input Specification
1.  `result_ld.npy`, `result_lc.npy`, `result_pd.npy`, `result_pc.npy`: Arrays containing cell-odor response indices.
2.  `joint_cell_odor_pair_exc_task.npy`, `joint_cell_odor_pair_inh_task.npy`: Binary masks for task classification.
3.  `joint_cell_odor_pair_exc_passive.npy`, `joint_cell_odor_pair_inh_passive.npy`: Binary masks for passive classification.

### Processing Steps
1.  Load the four `result_` files and the four mask files into the memory environment.
2.  Concatenate the Task data arrays (`ld` and `lc`) and Passive data arrays (`pd` and `pc`) along the primary index axis.
3.  Apply the boolean `== 1` operation on the respective mask arrays to generate the Excited and Inhibited boolean masks.
4.  Derive the `Non-Responsive` mask by applying a bitwise NOT (`~`) to the union of the Excited and Inhibited masks.
5.  Sum the True values in each mask to determine the total counts for the population.
6.  Calculate percentages for each category: `(Count_Category / Total_Pairs) * 100`.

### Output Specification
1.  **Statistics:** A printed summary displaying the percentages of excited, inhibited, and non-responsive categories per condition.
2.  **Visualization:** A figure with two side-by-side pie charts, color-coded and labeled (Excited, Inhibited, Non-responsive), distinguishing the Task vs. Passive condition.

### Validation Criteria
1.  Ensure total count of entries after concatenation is the sum of the individual dataset counts.
2.  Verify that the sum of Excited, Inhibited, and Non-responsive percentages equals 100%.
3.  Ensure no pair is flagged as both Excited and Inhibited (overlap test).

## File Structure

```
_For_granule_cell_odor_pairs_under_task_and_passive_conditio__greddy992_Odor-mixtures/
    references/
        matched_files/
            Coding_model.ipynb
            Concentration_coding.ipynb
            Masking.ipynb
            Quality_coding.ipynb
            Temporal_dynamics_of_ORN.ipynb
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
*   `Quality coding.ipynb`: Targeted for primary post-processing if adapting for experimental data.
*   `Analysis_Pipeline.py` (New): Proposed script to handle pooling and logical masking.

## References Documentation
*   `Coding model.ipynb`: Reference for neural thresholding logic.

## Usage Example
```bash
# Execute the custom classification and visualization script
python analyze_odor_responses.py --task_files result_ld.npy result_lc.npy --passive_files result_pd.npy result_pc.npy
```

## Notes & Caveats
*   **Dimensions:** Ensure all `result_` arrays are flattened to 1D vectors before masking to avoid dimension mismatch errors.
*   **Data Integrity:** Verify that the classification masks match the exact sequence of cell-odor pairs in the concatenated `result` arrays; mismatch here will yield invalid percentages.