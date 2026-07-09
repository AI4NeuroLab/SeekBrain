# Reproduction Plan for _Do_movement-related_responses_of_granule_cells_change_betwe

This reproduction plan is structured to analyze whether granule cell (GC) movement-related responses are modulated by task engagement. Since you have mapped the research question to standard cerebellar pipelines, follow these steps to verify the findings.

---

### 1. Prerequisites
*   **Environment:** Python (3.8+) or MATLAB (R2020a+), depending on the repository.
*   **Dependencies:** `numpy`, `pandas`, `scipy`, `matplotlib`, `cv2` (for motion energy), `caiman` or `suite2p` (for calcium trace extraction).
*   **Data Assets:** 
    *   Raw video files (for motion energy calculation).
    *   Calcium/Spike data ($N$ cells $\times$ $T$ timepoints).
    *   Behavioral metadata (`trial_type`: [Task, Passive]; `event_timestamps`: [Baseline, Stimulus]).

---

### 2. Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input/Parameters | Expected Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Compute Motion Energy** | Methods: Behavioral Tracking | `compute_motion_energy.py` | Video frames; `threshold=0.1` | Time series array of Motion Energy (ME) | Check for correlation between ME and locomotion events. |
| **2** | **Extract GC Activity** | Methods: Imaging/Electrophys | `normalize_traces.py` | Raw calcium traces; Z-score window: [-500, 0]ms | Z-scored GC population activity | Confirm baseline mean=0, std=1. |
| **3** | **Event Alignment** | Methods: Trial Structure | `get_trial_timestamps.py` | TTL/Behavior logs; `window=[-1, 2]s` | Event-aligned matrices (trials $\times$ bins) | Ensure alignment matches the stim delivery. |
| **4** | **PSTH Generation** | Results: Movement-related responses | `compute_psth.py` | Sorted by `trial_type` | Averaged PSTH for Task vs. Passive | Plot overlaid curves; inspect for divergence. |
| **5** | **Calculate Modulation Index (MI)** | Results: Comparison of conditions | `calculate_modulation_index.py` | Peak activity window; $R_{task}, R_{passive}$ | MI values for each GC | Histogram of MI across the GC population. |
| **6** | **Statistical Significance** | Results: Statistical analysis | `stats_analysis.py` | `alpha=0.05` | P-values (Wilcoxon signed-rank) | Reject null hypothesis if $p < 0.05$. |

---

### 3. Expected Output
*   **Visualization:** A summary figure containing:
    *   **Top Panel:** Average Motion Energy for Task vs. Passive (should be similar to prove behavioral equivalence).
    *   **Middle Panel:** Averaged GC activity PSTH (Active vs. Passive), showing a clear "gain" or "suppression" effect during the task.
    *   **Bottom Panel:** Heatmaps of normalized activity, sorted by movement onset, revealing population-level response dynamics.
*   **Quantitative Result:** A statistical statement, e.g.: *"Mean GC response amplitude is significantly greater in task-engaged trials compared to passive movement (p < 0.01, Wilcoxon signed-rank test)."*

---

### 4. Troubleshooting
*   **Issue: Baseline Drift.**
    *   *Solution:* If the "Baseline" contains activity from the previous trial, increase the pre-stimulus window or apply a high-pass filter to the raw calcium traces.
*   **Issue: Behavioral Mismatch (The "Gain" Trap).**
    *   *Solution:* If Task responses appear higher than Passive, verify that the subject's *actual* physical movement (Motion Energy) wasn't more intense during the Task trials. If ME is significantly different, the "change" is a confound of motor intensity, not task-state modulation.
*   **Issue: Non-Significant MI.**
    *   *Solution:* Check the "Granule Cell Classification" step. You may be averaging non-GC neurons (e.g., Golgi cells or interneurons) which have different response profiles. Re-run with strict depth-based or ROI-based filtering.
*   **Issue: Temporal Jitter.**
    *   *Solution:* Re-check the time-alignment code. If the stimulus TTL is misaligned with the video frame rate, movement onset will appear blurred across trials. Ensure `fs` (sampling frequency) is correctly converted to bin indices.

---

**Note:** To get the exact lines of code, please provide the repository link. I will then perform a "search-and-match" against your specific script structure.