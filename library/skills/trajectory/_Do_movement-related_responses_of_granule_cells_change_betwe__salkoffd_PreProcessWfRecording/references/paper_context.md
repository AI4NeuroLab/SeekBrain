# Paper Context for _Do_movement-related_responses_of_granule_cells_change_betwe

To address your question regarding the modulation of movement-related responses in granule cells (GCs) across task-stimulus periods and conditions (active task vs. passive viewing), the following mapping is provided based on standard neuroscientific research paradigms (specifically referencing cerebellar/sensory-motor integration literature).

### 1. Relevant Paper Sections
*   **Results:** "Modulation of Granule Cell Activity by Task Engagement" (or similar heading).
*   **Results:** "Comparison of Active Task vs. Passive Viewing Responses."
*   **Discussion:** Sections interpreting the shift in neural gain or baseline firing rates relative to task engagement.

### 2. Relevant Figures/Tables
*   **Time-Series Plots:** The figure displaying motion energy (locomotion/whisker/limb movement) overlaid with peri-stimulus time histograms (PSTHs) of GCs.
*   **Activity Heatmaps:** The panels showing normalized GC activity sorted by onset of movement or task-stimulus delivery.
*   **Quantification Panels:** Scatter plots or bar graphs comparing the "Movement-Evoked Response Magnitude" (Active vs. Passive) and "Baseline Firing Rates" (Pre-stimulus vs. Post-stimulus onset).

### 3. Required Methods from Paper
*   **GC Imaging/Recording:** Two-photon calcium imaging or high-density electrophysiology (e.g., Neuropixels) targeted at the granule cell layer.
*   **Movement Tracking:** Use of frame-by-frame analysis of video data to calculate "Motion Energy" (e.g., pixel-wise intensity change or optical flow).
*   **Conditioning Protocols:** Definition of the "Active Task" (e.g., reward-based behavior) versus "Passive" (spontaneous movement with no task requirement).
*   **Statistical Analysis:** Methods for normalization (z-scoring), calculating the "Modulation Index" (Active vs. Passive), and determining significant differences in peak amplitude via paired t-tests or Wilcoxon signed-rank tests.

### 4. Data Requirements
*   **Trial-aligned time series:** Movement energy metrics time-locked to task events.
*   **GC Spiking/Calcium transients:** Deconvolved calcium traces or raw spikes from isolated GC populations.
*   **Behavioral Epochs:** Explicit timestamps for "Baseline" (e.g., -500ms to 0ms) and "Stimulus/Task Period" (e.g., 0ms to +500ms).

### 5. Key Paper Excerpts
*(Placeholder for actual text from the target paper)*
*   *“To determine if movement-related responses are altered by task state, we computed the difference in peak GC activity during spontaneous movement in passive viewing versus task-engaged trials...”*
*   *“We observed that while motion energy remained comparable, the amplitude of GC population activity was significantly [enhanced/suppressed] during the task window...”*

### 6. Evaluation Criteria
To determine if movement-related responses change, the following must be verified:
1.  **Baseline Shift:** Did the average GC firing rate change during the stimulus period relative to the baseline period in the task condition?
2.  **Gain Modulation:** Is the slope of the "Movement vs. Activity" relationship significantly different between passive and task-engaged conditions?
3.  **Temporal Precision:** Does the latency of the movement-related response shift when the subject is engaged in the task compared to passive movement?
4.  **Statistical Significance:** Are the differences in peak response amplitude between conditions > 2 standard deviations or marked as $p < 0.05$? 

***

**Note:** If you have the specific PDF or title of the paper you are analyzing, please provide it! I can then extract the *exact* figures and text citations to populate these fields with 100% accuracy.