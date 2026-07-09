# Repository Context for _Do_movement-related_responses_of_granule_cells_change_betwe

To provide an accurate analysis, please **provide the name of the GitHub repository or the file structure/contents**. 

Based on the research question regarding **Granule Cell (GC) movement modulation** (comparing baseline, task, and passive conditions), I have prepared the template for how the analysis will be structured once the repository content is provided.

***

## 1. Relevant Files (Example Mapping)
*Assuming a typical structure for cerebellar neural analysis repositories:*

| File Name | Relevance | Priority |
| :--- | :--- | :--- |
| `analysis/movement_modulation_analysis.py` | Core logic for comparing Task vs. Passive activity. | **HIGH** |
| `processing/compute_motion_energy.py` | Extracts motion energy from behavioral video data. | **HIGH** |
| `plotting/plot_gc_activity_heatmaps.py` | Generates the time-series/heatmap visuals described. | **MEDIUM** |
| `utils/stats_helper.py` | Contains t-test/Wilcoxon tests for significance. | **MEDIUM** |
| `config/experiment_params.yaml` | Defines baseline vs. task epoch timestamps. | **LOW** |

## 2. Code Execution Order
1.  **Preprocessing:** Run `compute_motion_energy.py` to align frame-by-frame movement to the stimulus clock.
2.  **Trial Alignment:** Use the pipeline script (e.g., `process_all_trials.py`) to segment GC calcium traces into `[baseline, stimulus]` epochs.
3.  **Comparison:** Execute `movement_modulation_analysis.py` to calculate the "Modulation Index" comparing Task/Passive conditions.
4.  **Visualization:** Generate the figure panels using `plot_gc_activity_heatmaps.py` with the output from Step 3.

## 3. Key Code Patterns
*   **Normalization:** Look for `scipy.stats.zscore` or `(data - mean)/std` applied within the `baseline` epoch (`-500ms to 0ms`).
*   **Event-Triggered Averaging:** Look for functions creating a `peri-event time histogram (PETH)` structure, usually involving `numpy` indexing or `pandas.rolling()` for smoothed motion energy.
*   **Comparison Logic:** Implementation of a `ConditionMask` to separate `passive_indices` from `task_engaged_indices` before calculating peak response amplitudes.

## 4. Data Files Referenced
*   `data/behavior/motion_energy_raw.npy` (or `.mat`)
*   `data/imaging/gc_activity_traces.h5`
*   `data/metadata/trial_timestamps.csv` (contains `task_on` / `task_off` markers)

## 5. Missing Pieces
*(I will identify these once you provide the repository link or files)*
*   **Missing Flags:** Are there explicit flags distinguishing "Passive" from "Active" trials in the metadata?
*   **Calibration:** Is there a script to normalize motion energy across different sessions to ensure the comparison is valid?
*   **Baseline Definition:** Is the baseline window fixed across all subjects, or is it dynamically determined by the task onset?

***

**Please provide the repository URL or a list of the files in your repository, and I will immediately fill in the specific file paths and code logic.**