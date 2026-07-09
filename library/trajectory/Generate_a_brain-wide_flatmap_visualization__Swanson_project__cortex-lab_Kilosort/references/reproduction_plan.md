# Reproduction Plan for Generate_a_brain-wide_flatmap_visualization__Swanson_project

To generate the requested brain-wide flatmap, you must pivot from the upstream spike-sorting repository (KiloSort/Phy) to the IBL downstream analytical ecosystem. Below is the reproduction plan.

## Prerequisites
1.  **Software Environment:** Python 3.8+ with `iblatlas`, `brainbox`, `pandas`, `scipy`, `statsmodels`, and `matplotlib`.
2.  **Data Access:** Access to the IBL `ONE` (Open Neurophysiological Environment) API to fetch "Analysis-ready Layer Format" (ALF) files for the 139 mice.
3.  **Dependencies:** `pip install iblatlas brainbox one-api`

---

## Step-by-Step Procedure

| Step | Action | Paper Reference | Code/Tool Ref | Input | Output | Parameters |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Retrieval** | Methods: Data acquisition | `one.load_object` | Session UUIDs | Spikes, Clusters, Stimulus times | `object='spikes'` |
| **2** | **Region Mapping** | Methods: Anatomical mapping | `iblatlas.regions` | Cluster IDs, CCF coords | Brain region labels (Beryl) | `mapping='Beryl'` |
| **3** | **Firing Rate Calc** | Methods: Neural activity | `brainbox.singlecell` | Spike trains | Trial firing rates | `win=[0, 0.1]` (s) |
| **4** | **Stats Test** | Methods: Statistical analysis | `scipy.stats` | Firing rates | P-values per neuron | `u-test`, `alpha=0.05` |
| **5** | **FDR Correction** | Methods: Statistical analysis | `statsmodels` | P-values | Boolean significance | `method='fdr_bh'`, `q=0.01` |
| **6** | **Aggregation** | Methods: Inclusion criteria | `pandas.groupby` | Significant bools | Fraction/Region | $N \ge 20, S \ge 2$ |
| **7** | **Visualization** | Results: Brain-wide maps | `iblatlas.plots` | Fractions/Regions | Swanson flatmap | `hemisphere='right'` |

---

### Step Details:
1.  **Data Retrieval:** Use the `ONE` API to search for sessions with the `ephys` tag. Download the `spikes.times`, `spikes.clusters`, and `trials.visualStim_side` data.
2.  **Mapping:** Map clusters to regions using the `AllenAtlas` class. Ensure you aggregate to the `Beryl` nomenclature level, which collapses granular CCF structures into larger, reliable anatomical units.
3.  **Statistical Calculation:** For each neuron, create two vectors of firing rates (Left Stim vs. Right Stim) in the [0, 100]ms window. Use `scipy.stats.mannwhitneyu(x, y, alternative='two-sided')`.
4.  **Inclusion Filtering:** Before plotting, calculate the count of neurons per Beryl region. If `count < 20` or `session_count < 2`, mask the region as "Not Analysed" (White).
5.  **FDR Correction:** Calculate the significance of each region by applying Benjamini-Hochberg across all regions. Only keep those that meet the $q < 0.01$ threshold.
6.  **Visualization:** Use `iblatlas.plots.plot_swanson_vector`. Pass the flattened array of values. Use the `Yellow-Green` colormap for the ratio (0 to 1). Overlay the "Significant/Total" ratio text in the top right corner using standard Matplotlib text commands (`plt.text()`).

---

## Expected Output
*   **Visual:** A high-resolution Swanson projection map in portrait orientation.
*   **Coloring:** A gradient representing the fraction of modulated neurons, with grey regions for non-significant areas, and white for regions that did not pass the $N=20$/2-session inclusion threshold.
*   **Metric:** A text overlay in the top right corner stating: `Significant Regions / Total Analyzed: [X]/[Y]`.

---

## Troubleshooting
*   **Missing Data:** If a session fails to download, ensure your `ONE` cache is updated via `one.refresh_cached_queries()`.
*   **Memory Errors:** Loading 139 mice at once is RAM-intensive. Process sessions individually and save the intermediate `region_fraction` dictionaries to a local JSON/Pickle file before aggregating.
*   **Plotting Errors:** The `iblatlas` Swanson plotter expects a specific mapping vector size matching the Beryl atlas indices. Ensure your vector length matches `atlas.regions.name[atlas.regions.mappings == 'Beryl'].size`.
*   **Mapping Issues:** If regions are showing as "void," verify that your Beryl mapping is correctly aligned with the `probe_geometry` depth coordinates in the `alf` files.