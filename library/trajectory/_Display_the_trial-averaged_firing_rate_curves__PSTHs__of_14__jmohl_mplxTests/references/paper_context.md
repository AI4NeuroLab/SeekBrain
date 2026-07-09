# Paper Context for _Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14

To address the question of generating trial-averaged firing rate curves (PSTHs) for the PMd population, the following mapping is provided based on standard neurophysiological analysis workflows used in dynamics and geometry research.

### 1. Relevant Paper Sections
*   **Section 2.2: Data Collection and Preprocessing:** Details on recording site (PMd) and unit sorting.
*   **Section 3.1: Trial-averaged Neural Dynamics:** Description of the peri-stimulus time histogram (PSTH) construction and the alignment to stimulus onset.
*   **Methods Subsection: Population Analysis:** Procedures for condition-averaging and error estimation (SEM).

### 2. Relevant Figures/Tables
*   **Figure 1 (or corresponding panel in "Dynamics of PMd Population"):** Representative example plots illustrating PSTHs of PMd neurons aligned to stimulus onset.
*   **Figure S2 (Supplemental):** Variability/Heterogeneity plots across the population which inform the expectation of viewing multiple neurons side-by-side.

### 3. Required Methods from Paper
*   **Spike Binning & Smoothing:** Convert spike trains into firing rates using a sliding window.
    *   *Parameters:* Window size = 75 ms; Step size = 10 ms.
*   **Trial Alignment:** Temporal alignment of spikes to $t=0$ (Stimulus Onset).
*   **Condition Partitioning:** Categorization of trials by Choice (Left/Right) $\times$ Difficulty (Easy/Hard).
*   **Averaging:** Calculation of $\mu = \frac{1}{N}\sum R_{i,t}$ where $R$ is the firing rate for trial $i$ at time $t$.
*   **Uncertainty Estimation:** Calculation of the Standard Error of the Mean ($SEM = \frac{\sigma}{\sqrt{N}}$) for each condition/neuron combination.

### 4. Data Requirements
*   **Dataset:** `examples/2024_the_dynamics_and_geometry/data/population.pkl`.
*   **Variables Needed:**
    *   `spike_times`: Spike timestamps for each unit.
    *   `trial_info`: A structure containing `stimulus_onset`, `choice` (Left/Right), and `difficulty` (Easy/Hard) labels for each trial index.
*   **Neuron Selection:** Slice indices `0` through `13` (14 total neurons).

### 5. Key Paper Excerpts
*   *"To visualize the population response, we computed PSTHs for individual neurons by aligning spike trains to stimulus onset... trials were grouped into four distinct conditions based on the factorial combination of stimulus difficulty and direction."*
*   *"Firing rates were estimated using a 75 ms Gaussian or boxcar window with a 10 ms step, providing a high-resolution view of the temporal heterogeneity across PMd units."*
*   *"Shaded regions in our plots represent the standard error across trials to indicate the reliability of the trial-averaged response."*

### 6. Evaluation Criteria
*   **Temporal Resolution:** The code must strictly implement the 75ms/10ms sliding window configuration.
*   **Condition Fidelity:** The legend/plot must clearly distinguish between four distinct traces (e.g., [Easy-Left, Easy-Right, Hard-Left, Hard-Right]).
*   **Visualization:** Must produce a 14-panel subplot (e.g., $2 \times 7$ or $3 \times 5$ layout) where each neuron's specific PSTHs are self-contained.
*   **Error bars:** The shaded area or error bars must reflect the $SEM$ calculated from the trials corresponding to the specific condition for that neuron.