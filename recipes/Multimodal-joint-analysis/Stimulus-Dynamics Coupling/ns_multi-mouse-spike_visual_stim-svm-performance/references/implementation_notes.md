# Implementation notes

## Prerequisites

*   **Environment:** Python 3.8+, `allensdk`, `numpy`, `pandas`, `scikit-learn`, `scipy`.
*   **Data Access:** Allen SDK API Key (to download `EcephysSession` data).
*   **Hardware:** RAM sufficient to hold spike matrices (16GB+ recommended).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input/Parameters | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Load & Quality Filter** | Methods: Unit inclusion criteria | `EcephysSession.units` | `isi_violations < 0.1`, `snr > 2` | DataFrame of "good" units |
| **2** | **Stimulus Alignment** | Methods: Visual stimuli | `session.presentationwise_spike_counts` | `bin_size=0.1s`, `time_window` | Spike counts per trial/unit |
| **3** | **Responsive Unit Selection** | Results: Characterization of responsiveness | `scipy.stats.wilcoxon` | Stimulus vs. Baseline window | Boolean mask of "responsive" units |
| **4** | **Feature Normalization** | Methods: Decoding controls | `numpy.random.choice` | `n_units = min(count_per_roi)` | Equalized unit matrix per ROI |
| **5** | **SVM Decoding** | Results: Population decoding | `sklearn.svm.LinearSVC` | `cross_val_score(cv=5)` | Mean classification accuracy |

## Expected artifacts

1.  **Bar Plot**: Fraction of responsive neurons per brain region (x-axis: ROI, y-axis: Proportion).
2.  **Accuracy Plot**: Mean SVM decoding accuracy per brain region (with error bars representing standard deviation across 5 folds).
3.  **Correlation Analysis**: A scatter plot comparing "Fraction of Responsive Neurons" vs. "Mean Decoding Accuracy" to determine if responsiveness dictates decoding capacity.

---

## Troubleshooting

*   **Decoding Accuracy near 0:** Ensure your target labels (`stimulus_presentations`) are correctly aligned. Double-check `stimulus_condition_id` indexing to ensure the SVM is decoding specific stimulus *identities* (e.g., natural image ID) rather than just "stimulus present vs. absent."
*   **Variable ROI Performance:** If one ROI performs significantly worse than others, verify that the `unit_criteria` filter isn't excluding a disproportionate number of units in that specific region due to lower probe coverage or higher noise floors.
*   **Normalization Bias:** If you do not subsample to the same number of units per ROI, higher-density regions (like VISp) will appear to have higher decoding performance simply because the model has more features to work with. Always include an `n_units` constant across your comparison groups.
*   **SDK Timeouts:** If downloading large datasets, use the `allensdk.brain_observatory.ecephys.ecephys_project_cache.EcephysProjectCache` to save files locally for rapid re-testing.
