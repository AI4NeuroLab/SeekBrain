# Implementation notes

## Prerequisites

1.  **Software**: MATLAB (required for the bundled implementation).
2.  **External Toolkits**: `Tensor Toolbox for MATLAB` (required by `cp_als`).
3.  **Data Requirements**: 
    *   **Neural Data**: Single-unit spike times (in seconds) or binned spike counts.
    *   **Trial Metadata**: `Choice` (Left/Right) and `Difficulty` (Coherence level) labels.
4.  **Conceptual Alignment**: You are performing "Supervised Decomposition"—treating the Tensor as a container for your experimental conditions to visualize how latent factors track behavior.

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Prepare Data Tensor** | Methods: Electrophysiology | Custom script (Pre-process) | Spike times, Bin size (e.g., 20ms) | Matrix `[N_neurons x T_bins x Trials]` |
| **2** | **Trial Sorting** | Methods: Trial Alignment | Custom script (Group) | Raw Tensor + Metadata | Tensor with structured `K` dim (Conditions) |
| **3** | **CP Decomposition** | Results: Latent Dynamics | `cp_als` in `cp_demo.m` | Ordered Tensor | Factor matrices (A, B, C) |
| **4** | **Visualize Factors** | Figures: PSTHs & Tuning | `visualize_neuron_ktensor` | Factors from Step 3 | Latent temporal/trial profiles |
| **5** | **Validate vs Neuron** | Results: Single Neuron | Custom plotting | Latent Factor vs. PSTH | Overlap/Correlation score |

## Expected artifacts

*   **Latent PSTHs**: A graph showing how the extracted latent factors evolve over time, separated by choice and difficulty, mimicking the trial-averaged firing rates shown in PMd studies.
*   **Trial Factor Weights**: A plot showing how specific trials (sorted by difficulty) load onto the decision-making factors, providing a population-level confirmation of the single-neuron behavior.

---

## Troubleshooting

1.  **Overfitting (High Rank)**: If the decomposition looks like raw noise, reduce the `rank` parameter. PMd decision signals are typically low-dimensional.
2.  **Temporal Smearing**: If your PSTHs look "blurry," decrease the Gaussian smoothing kernel applied during Step 1.
3.  **Mismatch in Dynamics**: If the CP factors do not capture the difficulty modulation, the `[Neurons x Time x Trials]` tensor may require **"z-scoring"** per neuron before decomposition to ensure high-firing neurons don't dominate the latent factors.
4.  **bundled implementation Limitation**: If you need true single-neuron rasters, this code will not generate them. You must use `imagesc` on your pre-processed tensor (from Step 1) directly, using the trial sorting established in Step 2.
