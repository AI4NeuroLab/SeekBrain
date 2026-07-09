# Reproduction Plan for _Do_movement-related_responses_of_granule_cells_change_betwe

To reproduce the analysis of how granule cell (GC) movement-related responses are modulated by behavioral context (Task vs. Passive), follow this plan.

---

### Prerequisites
*   **Data:** Synchronized dataset containing:
    1.  **Neural Data:** Two-photon calcium imaging videos of the granule cell layer.
    2.  **Behavioral Video:** High-frame-rate video of the animal.
    3.  **Sync Files:** `SpikeGLX` generated metadata/binary files containing TTL pulses (stimulus onset, trial start/end).
*   **Software:** 
    1.  **SpikeGLX:** To extract synchronization timestamps.
    2.  **Image Analysis Suite:** (e.g., `Suite2p` or `CaImAn`) for motion correction and ROI extraction.
    3.  **Data Analysis Environment:** Python (with `pandas`, `numpy`, `scipy`) or MATLAB.

---

### Step-by-Step Procedure

| Step | Action | Paper Reference | Code/Repo Ref | Input | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Sync** | Align imaging frames with TTL timestamps. | Methods: "Data Acquisition" | SpikeGLX `Metadata` | `NI_DO_Set` logs | Aligned frame indices |
| **2. Motion** | Calculate "Motion Energy" (ME) via optical flow. | Methods: "Behavioral Analysis" | Custom scripts | Raw behavioral video | ME time-series |
| **3. Extract** | Calculate $\Delta F/F$ for individual GCs. | Methods: "GC Activity" | `Suite2p` output | Raw 2P imaging | $\Delta F/F$ traces |
| **4. Classify**| Define "Task" vs. "Passive" trial epochs. | Methods: "Experimental Paradigm" | `Agenda.txt` | TTL event logs | Trial labels |
| **5. Model** | Fit GLM: $GC_{activity} \sim \beta_1(ME) + \beta_2(Stim) + \beta_3(ME \times Stim)$. | Results: "Modulation analysis" | Custom GLM script | $\Delta F/F$, ME, Stim | Interaction coefficients ($\beta_3$) |

**Detailed Parameters & Validation:**
*   **Step 1:** Verify `run.missed_samples` in SpikeGLX metadata. If > 0, exclude trials. 
*   **Step 2:** Use a pixel-wise frame subtraction method ($ME = \sum |frame_t - frame_{t-1}|$).
*   **Step 5 (Validation):** Perform a shuffling test (1000 iterations of jittering movement data) to ensure the observed change in $\beta$ coefficients is statistically significant ($p < 0.05$).

---

### Expected Output
1.  **PETH Plots:** Peri-Event Time Histograms showing average $\Delta F/F$ aligned to movement onset for "Task" vs. "Passive" groups.
2.  **Modulation Indices:** A histogram of modulation indices ($\frac{Active - Passive}{Active + Passive}$) for the granule cell population.
3.  **Comparison Heatmaps:** Side-by-side activity heatmaps (as requested in the prompt) showing temporal alignment of GC spikes to movement under both conditions.

---

### Troubleshooting

*   **Issue: Noisy Movement Correlation.**
    *   *Cause:* Mechanical vibration or camera lighting fluctuations.
    *   *Fix:* High-pass filter the optical flow data to isolate animal-driven movement from background noise.
*   **Issue: "Task" trials show higher activity simply due to more movement.**
    *   *Fix:* Perform **Matching/Subsampling**: Restrict your comparison to subsets of trials in both "Task" and "Passive" conditions that have identical motion energy distributions (i.e., only compare periods where the animal moved at similar speeds).
*   **Issue: SpikeGLX sync mismatch.**
    *   *Cause:* Dropped frames in the acquisition computer.
    *   *Fix:* Re-examine the `BIST_Help.md` in the repo to check for hardware timing logs; if timing jitter exceeds 1 frame (e.g., 30ms for 30Hz imaging), the trial must be discarded.

---

### Final Synthesis Note
The **SpikeGLX** repo serves as the **temporal anchor**. Your reproduction success relies on using the digital input channels defined in the `Agenda.txt` as the absolute time-reference for the "Stimulus" and "Task" period flags, ensuring that the neural modulation observed is anchored to the exact experimental epoch intended by the original researchers.