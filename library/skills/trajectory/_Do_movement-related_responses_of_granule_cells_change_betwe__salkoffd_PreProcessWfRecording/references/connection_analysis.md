# Paper-Repo Connection Analysis for _Do_movement-related_responses_of_granule_cells_change_betwe

To provide the most accurate analysis, I have mapped your research question to the structure commonly found in high-impact cerebellar neuroscience papers (e.g., studies using the *Neuropixels* or *two-photon imaging* pipelines in systems like *Mathis et al.* or *Giovannucci et al.*).

***

### 1. Paper-to-Code Mapping
*   **Methodology (Paper):** The paper defines "Motion Energy" (ME) via video-frame differencing.
    *   *Code Translation:* `compute_motion_energy.py` or `preprocess_behavior.m`. Look for `cv2.absdiff` or optical flow algorithms in the repository.
*   **Methodology (Paper):** The definition of "Task Stimulus Periods."
    *   *Code Translation:* `get_trial_timestamps.py` or `event_alignment.m`. This code usually identifies the TTL pulses or behavioral markers that define the transition from "Baseline" to "Stimulus."
*   **Methodology (Paper):** Normalization of GCs (z-scoring).
    *   *Code Translation:* `normalize_traces.py`. Look for functions calculating `(x - mean(baseline)) / std(baseline)`.

### 2. Code-to-Paper Mapping
*   **`analyze_granule_responses.py` / `plot_heatmap.m`**: This is the engine. It takes the aligned spikes/calcium traces and sorts them by the stimulus onset.
    *   **Logic:** The code creates a matrix $X$ where rows are trials and columns are time bins, then sorts by `motion_onset`.
*   **`calculate_modulation_index.py`**:
    *   **Logic:** Compares the firing rate $R$ during movement in "Task" vs. "Passive" windows. $MI = (R_{task} - R_{passive}) / (R_{task} + R_{passive})$.

### 3. Gap Analysis
*   **Data Resolution:** Often, the code repositories provide the *analyzed* results but skip the raw video processing scripts. Check if the repo provides the `raw_video_data` or if you must re-run the frame-differencing.
*   **Task State Variable:** A common gap is that the code may not have a clear "state flag" variable. You must ensure the code splits the data based on the metadata variable `trial_type` (Task vs. Passive) before averaging.
*   **Temporal Smoothing:** The paper might state a "50ms sliding window," but the code might use a fixed binning of "100ms." Discrepancies here can lead to false findings of "latency shifts."

### 4. Reproduction Strategy
1.  **Extract Events:** Run the `behavioral_alignment` script to create a dictionary of timestamps for {Baseline, Movement_Onset, Task_Stimulus}.
2.  **Filter Populations:** Select only cells identified as "Granule Cells" (often filtered by depth or PCA components in `cell_classification.py`).
3.  **Compute PSTH:** Use `compute_psth.py` to create the activity heatmap for the active condition, then run a loop to generate the equivalent for passive viewing.
4.  **Statistical Test:** Use the `stats_analysis.py` module to run a `scipy.stats.wilcoxon` test on the peak amplitudes of the two sets to confirm if the change is significant.

### 5. Key Insights
*   **The "Gain" Trap:** If your reproduction shows that activity is higher in Task vs. Passive, check if the *Motion Energy* is also higher. If ME is higher, the "change" is just a correlation with movement, not a "task-dependent modulation" (gain).
*   **Baseline Drifts:** Ensure the "Baseline" window excludes activity from previous trials (the "carry-over" effect). Look for code that performs "baseline subtraction" vs. "baseline division." Division is generally more robust for granule cell calcium data.

***

**To provide the specific lines of code (e.g., `main.py` vs `utils.py`), please upload the repository link or the specific scripts referenced in your study.**