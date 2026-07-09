# Paper-Repo Connection Analysis for Using_brain-wide_Neuropixels_recordings_from_mice_performing

This analysis bridges the International Brain Laboratory (IBL) Brain-Wide Map (BWM) methodology with the practical implementation found in the `ibl-pipelines` and `paper-brain-wide-map` repositories.

### 1. Paper-to-Paper Mapping
*   **Method:** "Statistical analysis of task modulation" (Paper) $\rightarrow$ **Implementation:** `brainwide.decoding.functions.py` and `brainwide.params.py`.
*   **Method:** "Beryl-level regional aggregation" (Paper) $\rightarrow$ **Implementation:** `iblatlas.regions.BrainRegions.id2acronym` (using the Beryl mapping file).
*   **Method:** "Permutation testing within block episodes" (Paper) $\rightarrow$ **Implementation:** Logic within the `brainwide.decoding.decoding.py` module, which handles trial shuffling restricted by session/block index.

### 2. Code-to-Paper Mapping
*   **`brainwide.decoding.decoding.py`**: This script contains the core logic for the Mann-Whitney U test (often replaced by GLMs in newer IBL iterations, but the structure remains for non-parametric tests). It handles the grouping of trial conditions (`block`, `choice`).
*   **`iblatlas.plots.swanson.py`**: Used for the final visualization. It maps the array of "fraction of significant cells" onto the standardized Swanson flatmap coordinate system defined in the IBL atlas.
*   **`bwm_loading.py`**: Maps the `bwm_sessions.csv` to the IBL `OneAlyx` database, facilitating the fetching of `spikes.times.npy` and `trials.table.pqt` as specified in the methods.

### 3. Gap Analysis
*   **Statistical Implementation:** While the paper describes a Mann-Whitney U test, recent IBL repository updates have shifted toward **GLM-based decoding** (e.g., `decoding_utils.py` using `sklearn` LogisticRegression). A researcher must ensure they are using the specific branch/commit that contains the non-parametric U-test if strict adherence to the paper's original description is required.
*   **Temporal Drift:** The "permutation within block episodes" is explicitly described in the paper but often abstracted in the pipeline; custom scripting is needed to ensure the `shuffle` index does not cross the boundaries of behavioral blocks (detected in `_ibl_trials.table.pqt`).
*   **Unit Labeling:** The `clusters.metrics.pqt` contains the `label` column (KSLabel). The paper standardizes on `label >= 1` (good units), but the repo sometimes uses `firing_rate > 0.1` and `presence_ratio > 0.8` as additional criteria; these must be explicitly included to match the paper's filter stringency.

### 4. Reproduction Strategy
1.  **Environment:** Clone the `ibl-neuropixels` and `iblatlas` repos. Install `ibl-env`.
2.  **Data Fetching:** Use `one.load_object(eid, 'spikes')` and `one.load_object(eid, 'trials')` iterated over the `bwm_sessions.csv`.
3.  **Preprocessing:** 
    *   Map brain regions using `iblatlas.regions.BrainRegions().id2acronym(ids, mapping='Beryl')`.
    *   Filter units by `metrics.pqt` (label == 1).
    *   Calculate the 0–100ms PSTH for each neuron per condition.
4.  **Compute:** Perform the U-test per neuron, group by Beryl acronym, apply `statsmodels.stats.multitest.multipletests` for FDR correction.
5.  **Visualize:** Input the resulting dictionary of `{region: fraction_significant}` into `iblatlas.plots.plot_swanson`.

### 5. Key Insights
*   **Spatial Distribution:** The paper reveals that stimulus-side selectivity is not confined to the visual cortex (V1/LM). High selectivity is often observed in the Superior Colliculus (SC) and the Posterior Parietal Cortex (PPC), reflecting the integration of visual input with motor-planning signals.
*   **Significance of FDR:** Because of the high number of regions analyzed (the "multiple comparisons problem"), the $q=0.01$ threshold is vital. Without this, many subcortical regions appear "modulated" purely due to noise in low-count units.
*   **Block Dependence:** The necessity of performing permutations *within* block episodes highlights that neural firing is highly sensitive to the *expectation* of a stimulus (block structure), not just the physical stimulus itself. Ignoring this would lead to false positives where block-related shifts are misidentified as stimulus-side selectivity.