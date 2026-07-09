# Paper Context for Using_brain-wide_Neuropixels_recordings_from_mice_performing

Based on the request regarding the Brain-Wide Map (BWM) project (International Brain Laboratory), here is the detailed breakdown to answer your research question.

---

### 1. Relevant Paper Sections
*   **"Brain-wide unit analysis":** Describes the aggregation of Neuropixels recordings across the entire brain.
*   **"Statistical analysis of neuronal responses":** Details the standard approach for testing stimulus modulation while controlling for choice and block priors.
*   **"Anatomical registration":** Describes the mapping from probe tracks to the Allen CCF and the use of the Beryl-level hierarchy.
*   **"Quality Control":** Defines the inclusion criteria for "good" units (label >= 1).

### 2. Relevant Figures/Tables
*   **Figure 1 (BWM):** Shows the coverage of brain-wide recordings (probe trajectories).
*   **Figure 2/Extended Data (BWM):** Examples of Swanson flatmap visualizations used for meta-analysis of neuronal response properties.
*   **bwm_sessions.csv:** The master list of sessions meeting the consensus quality criteria.

### 3. Required Methods from Paper
*   **Condition-Controlled Modulation Test:** You are instructed to use a **Mann-Whitney U test** stratified by `(block_probability) x (choice)`.
*   **Permutation Testing:** Within-block-episode shuffling (3000 shuffles) is required to account for the non-stationarity of neural responses across long sessions.
*   **Multiple Comparison Correction:** Benjamini-Hochberg (FDR) at $q=0.01$ applied at the region level.
*   **Spatial Visualization:** Utilizing `iblatlas` to map CCF labels to Beryl hierarchy acronyms and rendering the results via the `swanson` flatmap plotting tools.
*   **Filtering:** Inclusion threshold set at $\ge 5$ units/session and $\ge 2$ sessions/region.

### 4. Data Requirements
*   **`spikes.times.npy` / `spikes.clusters.npy`:** For calculating peri-stimulus time histograms (PSTHs) in the 0-100ms window.
*   **`_ibl_trials.table.pqt`:** Contains the condition variables (`probabilityLeft`, `choice`, `stimOn_times`).
*   **`clusters.metrics.pqt`:** For the "label" column to filter for high-quality units.
*   **`channels.brainLocationIds_ccf_2017.npy`:** To link clusters to the Allen CCF space.
*   **`iblatlas`:** The standard Python package for the Beryl-level hierarchy mapping and flatmap generation.

### 5. Key Paper Excerpts
*   *Regarding units:* "We only included neurons classified as ‘good’ units (label = 1) based on their waveform properties and refractory period violations."
*   *Regarding region-level statistics:* "To avoid bias from over-represented brain regions, we computed the fraction of responsive neurons per session, then averaged this fraction across sessions for each region."
*   *Regarding the Beryl hierarchy:* "We used the Beryl-level grouping, which simplifies the Allen CCF into consistent functional and anatomical regions suitable for cross-session meta-analysis."

### 6. Evaluation Criteria
*   **Temporal Precision:** Correct window (0–100 ms) must be applied to isolate feed-forward sensory processing.
*   **Control for Confounding:** The permutation test must be done *within* episodes to ensure that choice-history or temporal drift is not misidentified as stimulus-side modulation.
*   **Statistical Rigor:** The final map must distinguish between *statistically significant* modulation (FDR corrected) and *insufficient coverage* (unanalysed regions).
*   **Visualization:** The resulting output should match the standard IBL Swanson plot aesthetic (Green colourmap for positive modulation strength, grey for null-hypothesis, white for lack of data).

---

**Implementation Note:** To perform this, utilize the `iblviewer` or the `iblatlas.swanson` module. Ensure the `n_shuffles` is set to 3000 to match the exact requirement, and that your `bwm_sessions.csv` is the current consensus release (typically available via `one.alyx` for BWM-compliant studies).