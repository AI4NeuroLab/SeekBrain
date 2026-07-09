# Reproduction Plan for Using_brain-wide_Neuropixels_recordings_from_mice_performing

This reproduction plan outlines the steps required to identify, quantify, and visualize stimulus-side modulation using the International Brain Laboratory (IBL) Brain-Wide Map (BWM) framework.

---

### 1. Prerequisites
*   **Environment:** Python 3.9+ with `ibllib`, `iblatlas`, `pandas`, `numpy`, `scipy`, `statsmodels`, and `matplotlib`.
*   **Data Access:** An `ONE` object configured for public access (`alyx.internationalbrainlab.org`).
*   **Repositories:** `iblatlas` (for anatomy and plotting), `ibl-neuropixels` (for spike sorting metrics and session definitions).
*   **Datasets:** `bwm_sessions.csv` (provided by IBL, listing valid sessions for the BWM).

---

### 2. Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Loading** | Methods: Data aggregation | `one.load_object()` | `bwm_sessions.csv` | `spikes`, `trials`, `channels` | Verify `eid` keys exist |
| **2** | **Preprocessing** | Methods: Unit selection | `clusters.metrics.pqt` | Spike data | `label >= 1` | Count valid units |
| **3** | **Regional Aggregation** | Methods: Beryl ontology | `iblatlas.regions` | `ccf_2017.npy` | `mapping='Beryl'` | Check for valid acronyms |
| **4** | **Stats Calculation** | Methods: Stat modulation | `scipy.stats.mannwhitneyu` | PSTH (0-100ms) | $N=3000$ shuffles | Check stability of U-stat |
| **5** | **FDR Correction** | Methods: Significance | `statsmodels` | U-test p-values | $q=0.01$ | Check output array length |
| **6** | **Visualization** | Figure 1: Swanson plot | `iblatlas.plots` | Region dictionary | `orientation='portrait'` | Visual inspection |

#### Detailed Execution Steps:
1.  **Filter Units:** Load `clusters.metrics.pqt`. Retain units where `label == 1`.
2.  **Define Windows:** Slice `spikes.times` to the interval `[stimOn_times, stimOn_times + 0.1s]`. 
3.  **Permutation Logic:** For each neuron, calculate the Mann-Whitney U statistic between Left vs. Right stimuli. To control for temporal drift, loop through block episodes (defined as continuous indices in `trials.table` where `probabilityLeft` is constant). Within these segments, shuffle the stimulus labels 3000 times to generate a null distribution of the U-statistic.
4.  **Regional Filtering:** Group neurons by Beryl region. Only include regions with $\ge 5$ good units/session and $\ge 2$ sessions total.
5.  **FDR Correction:** Collect all regional p-values. Use `statsmodels.stats.multitest.multipletests(pvals, method='fdr_bh')` to identify regions significant at $q < 0.01$.

---

### 3. Expected Output
*   **Quantitative:** A list of Beryl regions identified as significant, with the corresponding fraction of significantly modulated neurons.
*   **Visual:** A Swanson brain flatmap (portrait) with:
    *   **Green-shaded regions:** Significant areas, intensity proportional to the fraction of modulated neurons.
    *   **Grey regions:** Analyzed areas that failed the significance threshold.
    *   **White regions:** Regions with insufficient data (not analyzed).
*   **Summary text:** The count of "Significant Regions / Total Analyzed Regions".

---

### 4. Troubleshooting
*   **"Missing units in Beryl regions":** Ensure `channels.brainLocationIds_ccf_2017.npy` is used to map into `iblatlas.regions.BrainRegions().id2acronym(ids, mapping='Beryl')`. Any `void` or `root` regions should be dropped.
*   **Permutation Errors:** Ensure the loop only shuffles *within* trial blocks. Shuffling across block boundaries (where `probabilityLeft` changes) will inflate false positives due to block-related firing rate drifts.
*   **Memory/Performance:** The 3000-shuffle permutation for thousands of neurons is computationally expensive. Parallelize the calculation using `multiprocessing` or `dask` at the region level.
*   **Normalization:** If the color map is saturated, ensure you are using the `fraction of significant units`, not the raw count, to account for variable sampling density across the brain.

---

### 5. Interpretation Strategy
*   **Primary Sensory Areas:** Expect high significance in visual areas (V1, LM, AL).
*   **Association Cortex:** Look for unexpected selectivity in the PPC or RSC, which may suggest top-down modulation.
*   **Subcortical:** The SC should show high modulation; confirm if this aligns with the expected visual-to-motor relay function. If significant regions appear in regions like the Thalamus or Basal Ganglia, evaluate if this represents stimulus sensitivity or choice preparation.