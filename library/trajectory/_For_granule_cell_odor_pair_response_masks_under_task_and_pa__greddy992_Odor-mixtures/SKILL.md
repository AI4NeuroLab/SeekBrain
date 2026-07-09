---
name: "Granule Cell Odor Response Distribution Analysis"
description: "Calculates and visualizes the percentage of excited, suppressed, and non-responsive granule cell-odor pairs by pooling task and passive condition datasets."
triggers:
  - "calculate odor response percentages for task vs passive conditions"
  - "generate pie charts for granule cell odor pair responses"
  - "how do excited and suppressed odor responses compare in task and passive states?"
  - "compute response mask statistics from joint cell odor pair npy files"
  - "analyze granule cell response distributions under different behavioral conditions"
tags:
  - "neuroscience"
  - "odor-response-analysis"
  - "granule-cells"
  - "data-visualization"
  - "response-masking"
  - "behavioral-states"
version: "1.0"
---

# Skill: Quantifying Granule Cell Odor-Response Distributions under Task and Passive Conditions

## Overview
This skill provides a methodology for calculating and visualizing the population-level response states of granule cells (GCs) to odors. Based on experimental neural data, it classifies each cell–odor pair as "Excited," "Suppressed," or "Non-responsive" across two distinct experimental conditions: Task-engaged (pooled `result_ld` and `result_lc`) and Passive exposure (pooled `result_pd` and `result_pc`).

The analysis translates binary response masks into percentages to facilitate comparison between experimental states. This is critical for reproducing the observation that GC odor representations are sparse and that inhibitory (suppressive) dynamics are state-dependent, often increasing in prevalence during passive odor exposure compared to task performance.

## Objective
To quantify the response distribution of granule cell–odor pairs by computing percentages for excited, suppressed, and non-responsive classes, and to visualize these findings using side-by-side pie charts.

## Background (from Paper)
### Scientific Context
Granule cells demonstrate state-dependent odor representation. Odor-pair responses are classified based on trial-averaged firing rates compared against pre-odor baseline windows, with significance determined by a p < 0.05 shuffling threshold. 

### Methods Description
1. **Mask Generation:** Binary masks are constructed where a value of 1 indicates a significant response (excited or suppressed) for a specific cell–odor pair.
2. **Pooling:** Experimental data from specific result sets (e.g., `ld`/`lc` for Task) are aggregated to increase the statistical power of the population distribution.
3. **Normalization:** The total number of pairs ($N_{cells} \times N_{odors}$) serves as the denominator to compute the percentage of the population occupied by each response type.
4. **Residue Calculation:** The "Non-responsive" category is defined as the remainder of the population, ensuring $Excited + Suppressed + Non = 100\%$.

### Expected Results
The paper reports that granule cells exhibit sparse representations, with the majority of cell–odor pairs classified as non-responsive. Suppression is identified as a more prevalent feature in passive conditions compared to task-engaged conditions.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The provided repository code focuses on biophysical modeling rather than the empirical processing of neural data masks.

### Conceptual Implementation Plan
The analysis must be implemented as a custom Python script (e.g., `analyze_response_distribution.py`) that performs numerical loading and aggregation.
1. **Load:** Import `numpy` arrays from the `./Numerics/` directory.
2. **Aggregate:** Use `np.concatenate` or `np.logical_or` on the binary masks to pool `ld`/`lc` and `pd`/`pc`.
3. **Compute:** Calculate the mean of the binary masks for the condition to get the fraction, then multiply by 100.
4. **Assert:** Perform a mutual exclusivity check: `if (np.sum(mask_exc * mask_sup) > 0)`, raise an error to indicate an invalid mask overlap.
5. **Plot:** Use `matplotlib.pyplot.pie` for comparative visualization.

### Dependencies
- `numpy`: For array manipulation and boolean logic.
- `matplotlib`: For rendering the pie chart comparison.
- `pathlib`: For managing file paths to input `.npy` arrays.

## Structured Prompt
### Input Specification
1. Task masks: `joint_cell_odor_pair_exc_ld.npy`, `joint_cell_odor_pair_exc_lc.npy`, `cell_odor_pair_index_pre_ld.npy`, `cell_odor_pair_index_pre_lc.npy`.
2. Passive masks: `joint_cell_odor_pair_exc_pd.npy`, `joint_cell_odor_pair_exc_pc.npy`, `joint_cell_odor_pair_sup_pd.npy`, `joint_cell_odor_pair_sup_pc.npy`.

### Processing Steps
1. **Load Arrays:** Use `np.load()` for each file.
2. **Pool Task:** `task_exc = np.concatenate([exc_ld, exc_lc])`; `task_sup = np.concatenate([pre_ld, pre_lc])`.
3. **Pool Passive:** `pass_exc = np.concatenate([exc_pd, exc_pc])`; `pass_sup = np.concatenate([sup_pd, sup_pc])`.
4. **Calc Percentages:** For each condition, calculate $P_{exc} = (\text{sum}(mask_{exc}) / \text{size}(mask_{exc})) \times 100$, and similarly for $P_{sup}$.
5. **Derive Non-Responsive:** $P_{non} = 100 - P_{exc} - P_{sup}$.
6. **Visualize:** Pass `[P_exc, P_sup, P_non]` to `plt.pie` for both Task and Passive datasets.

### Output Specification
- A console summary of the calculated percentages.
- A high-resolution figure (side-by-side pie charts) saved in EPS or PNG format.

### Validation Criteria
- The sum of percentages for each condition must equal 100.0%.
- $P_{exc}$ and $P_{sup}$ must be derived from the exact file pairs stipulated in the paper context.

## File Structure

```
_For_granule_cell_odor_pair_response_masks_under_task_and_pa__greddy992_Odor-mixtures/
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
- `analyze_response_distribution.py` (New): Custom script to load `.npy` masks, pool data, compute percentages, and generate the comparative visualization.

## References Documentation
- "Odor response classification" (Methods): Defines criteria for identifying excited/suppressed pairs.
- "Response criteria for granule cell–odor pairs" (Supplementary): Explains why certain masks (e.g., `pre_` vs `sup_`) are selected for specific conditions.

## Usage Example
```bash
python analyze_response_distribution.py --input_dir ./Numerics/ --output_fig response_stats.png
```

## Notes & Caveats
- **Mutual Exclusivity:** Ensure that your masks are mutually exclusive. If an index is marked as "1" in both the excited and suppressed arrays, the non-responsive count will be mathematically underestimated.
- **Dimensionality:** Verify that all arrays loaded for a specific condition share identical dimensions. Discrepancies in total cell counts will cause failures in the pooling/concatenation steps.
- **Normalization:** Ensure that the denominator for percentage calculation is the total number of cell-odor pairs per condition, not just the number of responsive pairs.