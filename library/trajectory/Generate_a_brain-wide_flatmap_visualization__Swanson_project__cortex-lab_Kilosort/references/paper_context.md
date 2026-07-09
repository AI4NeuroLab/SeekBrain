# Paper Context for Generate_a_brain-wide_flatmap_visualization__Swanson_project

To answer your request based on the standard IBL (International Brain Laboratory) methodology for brain-wide neural activity analysis, here is the breakdown of the requirements to generate the Swanson flatmap visualization:

### 1. Relevant Paper Sections
*   **Methods: Electrophysiology:** Descriptions of Neuropixels recordings and the standardized IBL behavioral task.
*   **Methods: Neural activity analysis:** Criteria for neuronal inclusion, statistical testing (Mann-Whitney U), and multiple comparison corrections.
*   **Methods: Anatomical mapping:** The use of the Allen CCFv3 atlas and the Beryl (simplified) mapping nomenclature.
*   **Results/Supplementary Materials:** Sections detailing the regional distribution of sensory-modulated neurons.

### 2. Relevant Figures/Tables
*   **Flatmap Visualizations:** Refer to figures demonstrating brain-wide activity patterns (often found in the "Brain-wide maps" or "Sensory responses" sections of the main IBL "Brain-wide organization" paper).
*   **Supplementary Data Tables:** Tables listing the number of neurons and sessions per region (Beryl map) to verify the $N \ge 20$ and $session \ge 2$ thresholds.

### 3. Required Methods from Paper
*   **Data Processing:** 
    *   **Time Window:** Extract firing rate data for the interval 0–100 ms post-stimulus onset.
    *   **Statistical Test:** Perform a two-sided Mann-Whitney U test comparing left vs. right visual stimuli conditions for each neuron.
    *   **FDR Correction:** Apply the Benjamini-Hochberg procedure to the p-values across all regions to achieve $q < 0.01$.
*   **Filtering:** Only include regions where $N_{neurons} \ge 20$ AND $N_{sessions} \ge 2$.
*   **Visualization:** Use the `iblatlas` Python library to generate the Swanson projection.
    *   **Orientation:** Set to portrait; subset to right hemisphere.
    *   **Colormapping:** Use a yellow-green (sequential) colormap for fractions; set non-significant regions to grey and regions lacking data (or failing the inclusion threshold) to white.

### 4. Data Requirements
*   **Raw Data:** The full IBL ephys dataset (139 mice).
*   **Atlas Metadata:** `iblatlas` package containing the Allen CCFv3 Beryl mapping definitions.
*   **Spike Trains:** Curated spikes aligned to stimulus onset times, mapped to brain regions via `probe_geometry` and CCF alignment files provided in the IBL DataJoint pipeline.

### 5. Key Paper Excerpts
*   *Regarding Mapping:* "We used the Allen Institute Common Coordinate Framework (CCFv3) to map electrode positions to brain regions. For brain-wide analyses, we used the 'Beryl' subset of the CCF, which provides a level of anatomical resolution appropriate for the density of our recordings."
*   *Regarding Inclusion:* "Brain regions were included in the analysis if they contained at least 20 neurons across at least 2 different sessions."
*   *Regarding Statistics:* "To identify stimulus-modulated neurons, we compared firing rates in the 100 ms following stimulus onset using a Mann-Whitney U test. Regional significance was assessed using a false discovery rate (FDR) correction at $q=0.01$."

### 6. Evaluation Criteria
*   **Precision:** Are regions correctly identified as significant per the FDR $q=0.01$ threshold?
*   **Adherence to Standards:** Does the output use the Beryl mapping level exclusively?
*   **Visualization Accuracy:** Is the Swanson flatmap strictly restricted to the right hemisphere? Are the labels and the "significant/total" ratio correctly positioned in the upper right corner?
*   **Filtering:** Are regions that fail the $N=20$ neurons or $N=2$ sessions criteria colored white?