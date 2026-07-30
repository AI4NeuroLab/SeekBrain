# Implementation notes

## Prerequisites

*   **Environment:** Python 3.9+ with `ibllib`, `iblatlas`, `numpy`, `scipy`, `pandas`, `statsmodels`, and `matplotlib`.
*   **Data Access:** Access to the IBL `ONE` (Open Neurophysiological Environment) API to retrieve spike data, trial events, and Beryl-mapped region IDs.
*   **Reference bundled implementation:** `int-brain-lab/iblatlas` (for plotting) and `int-brain-lab/analysis_iblatlas` (for analytical logic).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input/Output |
| :--- | :--- | :--- | :--- | :--- |
| **1. Data Extraction** | Query firing rates (0-100ms) for all neurons in Beryl regions. | *Methods: Electrophysiological recordings* | `one.load_object(..., 'spikes')` | **Input:** EID list; **Output:** Spike times/clusters per session. |
| **2. Filtering** | Filter regions with $N < 20$ neurons or $N < 2$ sessions. | *Methods: Statistical analysis* | `pandas.groupby('region')` | **Input:** Neuron/Session counts; **Output:** List of valid Beryl regions. |
| **3. Statistics** | Conduct Mann-Whitney U test (Left vs Right stim) per neuron. | *Methods: Statistical analysis* | `scipy.stats.mannwhitneyu` | **Input:** Firing rates; **Output:** $p$-values per neuron. |
| **4. FDR Correction** | Perform BH correction across the set of neurons per region. | *Methods: Statistical analysis* | `statsmodels.stats.multitest.multipletests` | **Input:** $p$-values; **Output:** Significant $q < 0.01$ flags. |
| **5. Fraction Calculation** | Compute $f = N_{sig} / N_{total}$ per region. | *Methods: Statistical analysis* | `numpy` mean/sum | **Input:** Significant flags; **Output:** Dictionary `{region_id: fraction}`. |
| **6. Visualization** | Plot using Swanson flatmap (Right hemisphere, Portrait). | *Methods: Flatmap generation* | `iblatlas.plots.plot_swanson_vector` | **Input:** Fraction dict; **Output:** Matplotlib figure. |

---

## Expected artifacts

*   **Visual:** A portrait-oriented Swanson flatmap showing the right hemisphere.
*   **Gradient:** Significant regions show a Yellow-to-Green gradient representing the fraction of modulated neurons; inactive/non-significant regions appear grey; background areas are white.
*   **Annotation:** A clean text box in the upper right corner displaying the ratio of significant regions identified.

---

## Troubleshooting

*   **Empty Plot:** If the map is entirely grey or white, check the `region_id` keys in your dictionary against `atlas.regions.acronym`. Beryl IDs are specific; ensure they aren't legacy Allen CCF IDs.
*   **Orientation Errors:** If the projection looks landscape, ensure the `orientation='portrait'` flag is passed. If regions are missing, confirm the `hemisphere='right'` filter was applied to the atlas data before passing to the plotter.
*   **Memory Issues:** With 139 mice, ensure you process firing rates per region to avoid loading all spike trains into RAM simultaneously. Use `generator` expressions for the Mann-Whitney tests.
