# Reproduction Plan for Using_brain-wide_Neuropixels_recordings_from_mice_performing

This plan outlines the reproduction of the Brain-Wide Map (BWM) stimulus-modulation analysis. As noted, the spike-sorting repository provided is the **upstream generation tool**; the actual analysis requires the **IBL analysis stack** (`ONE`, `iblatlas`, `brainbox`).

---

### Prerequisites
1.  **Environment:** Python 3.9+ with `one-api`, `iblatlas`, `brainbox`, `pandas`, `scipy`, `statsmodels`, and `matplotlib`.
2.  **Data Access:** An IBL `ONE` instance configured for local cache (or cloud access).
3.  **Dependency:** Access to the `bwm_sessions.csv` file (standard in the IBL repository `paper-brain-wide-map`).

---

### Step-by-Step Procedure

| Step | Action | Reference | Input | Parameters/Logic |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Loading** | BWM "Data Architecture" | `bwm_sessions.csv`, `ONE` | Filter sessions by `eids` in csv. Load `trials`, `spikes`, `clusters`, `channels`. |
| **2** | **Unit Selection** | "Quality Control" | `clusters.metrics.pqt` | Filter: `label >= 1` (good units). |
| **3** | **Anatomical Mapping** | "Anatomical registration" | `channels.brainLocationIds` | Map to Beryl hierarchy using `iblatlas.regions`. |
| **4** | **Feature Extraction** | "Stimulus-side modulation" | `spikes.times`, `trials` | PSTH: 0-100ms post-`stimOn`. |
| **5** | **Stratified MWU** | "Statistical Analysis" | `scipy.stats.mannwhitneyu` | Group trials: 4 conditions (block x choice). Stratify shuffle within episodes. |
| **6** | **Permutation** | "Permutation testing" | `numpy.random` | 3000 shuffles per neuron. |
| **7** | **Region Correction** | "Multiple Comparison" | `statsmodels` | FDR (Benjamini-Hochberg) at $q=0.01$. |
| **8** | **Flatmap Plot** | "Spatial Visualization" | `iblatlas.plots.swanson` | Green map (fraction), grey (non-sig), white (empty). |

---

### Detailed Analysis Workflow

#### Step 5 & 6: The Stratified Permutation Loop
The core of this analysis is controlling for the block prior and choice. For each neuron:
1.  **Define Conditions:** 4 buckets based on `[probabilityLeft: 0.2, 0.8]` × `[choice: -1, 1]`.
2.  **Permutation:** Within every "episode" (a continuous run of trials with the same block probability), shuffle the stimulus side (Left vs Right) labels. This preserves the temporal correlation (drift) and block-structure while destroying the link between stimulus and neural activity.
3.  **U-Statistic:** Compute the Mann-Whitney U for each of the 4 conditions. Sum the U-statistics (or average the p-values) to get the global modulation statistic per neuron.

#### Step 7: Region-Level Aggregation
To report per-region significance:
*   Calculate the fraction of neurons with $p_{adj} < 0.01$ for each region per session.
*   Require $\ge 5$ units per session and $\ge 2$ sessions per region.
*   Average these session-fractions to obtain the regional score.

---

### Expected Output
1.  **Quantitative Result:** A table of Beryl-level regions, their associated fraction of stimulus-modulated neurons, and their $p$-values after FDR correction.
2.  **Visualization:** A high-resolution Swanson Flatmap (Portrait).
    *   **Green:** Highly modulated regions (e.g., primary visual cortex, superior colliculus).
    *   **Grey:** Regions with sufficient neurons but no significant modulation.
    *   **White:** Regions with < 2 sessions or < 5 neurons.
3.  **Interpretative Summary:** A report identifying the "visual stream" (e.g., VISp, SC) as highly significant and quantifying the lack of modulation in deep-brain regions not involved in visual processing.

---

### Troubleshooting
*   **Drift/Artifacts:** If a non-visual region shows high modulation, check the "Within-episode" shuffle constraint. If the shuffle is global (across the whole session), temporal drift in baseline firing rates will trigger false positives.
*   **Region Coverage:** Some regions in the Allen CCF may have high sparsity. Ensure the "at least 2 sessions" constraint is strictly enforced to prevent outlier sessions (e.g., bad probe placement) from dominating the flatmap.
*   **Memory:** Loading all `spikes.times` for the BWM dataset can exceed RAM. Use the `ONE` API to lazy-load objects or process session-by-session, saving intermediate modulation statistics to disk.
*   **Swanson Alignment:** Ensure the `iblatlas` version matches the CCF version used in the original paper (CCFv2017).