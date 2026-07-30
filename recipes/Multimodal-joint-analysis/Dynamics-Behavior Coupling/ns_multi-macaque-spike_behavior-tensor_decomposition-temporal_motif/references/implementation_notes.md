# Implementation notes

## Prerequisites

*   **Data:** Spiking data from PMd neurons during a reaching task, aligned to stimulus/target onset. Trials must be labeled by *Choice* (Left/Right) and *Difficulty* (Coherence).
*   **Software:** MATLAB (recommended for `tensor_toolbox`) or Python (with `tensortools`).
*   **Libraries:** `tensor_toolbox` (for `cp_als`) or `tensortools` (for Python-based CP decomposition).
*   **Experimental Metadata:** A look-up table mapping trial indices to target location and stimulus difficulty.

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Prep** | Construct $N \times T \times K$ Tensor | Fig 7 | `README` | Spike counts (20ms bins) | $N \times T \times K$ Tensor | Matrix dimensions match $N, T, K$ |
| **2. Decomp** | Execute CP Decomposition | N/A | `cp_als` | Tensor ($R=5 \dots 10$) | Latent factors (A, B, C) | `fit_error` < 10% |
| **3. Feature Extraction** | Isolate Temporal Factors (B) | Fig 5 | `cp_demo.m` | Factor matrix B | Temporal motifs (e.g., Ramp, Phasic) | Correlation of factors |
| **4. Alignment** | Correlate Weights (C) with Task | Results section | Manual reg | Factor C weights, Task labels | Regression coefficients | $R^2$ of factor-to-task mapping |
| **5. Synthesis** | Reconstruct Population | Discussion | N/A | Factors $\times$ Weights | Mean PSTHs per cell type | Reconstructed PSTH $\approx$ Original |

**Step 2 Detailed Params:** Use non-negative CP decomposition (`cp_nls` or `cp_als`) to ensure factors are physically interpretable as firing rates. Set $R$ based on the "elbow" of the reconstruction error plot.

**Step 4 Detailed Params:** Perform a Generalized Linear Model (GLM) where:
`Component_Weight ~ Beta0 + Beta1(Choice) + Beta2(Difficulty) + Beta3(Choice*Difficulty)`.
Significant coefficients for `Beta2` identify neurons/components sensitive to difficulty (evidence strength).

---

## Expected artifacts

1.  **Temporal Motif Library:** A visualization of the $R$ factors showing diverse profiles:
    *   *Factor 1:* Linear increase (Ramping).
    *   *Factor 2:* Transient burst at target onset (Phasic).
    *   *Factor 3:* Biphasic (Early inhibition, late excitation).
2.  **Factor-Condition Mapping:** A plot showing that ramping factors (Factor 1) are strongly weighted by *Choice*, while transient factors (Factor 2) are weighted by *Difficulty* or *Stimulus Onset*.
3.  **Heterogeneity Evidence:** A demonstration that most neurons are linear combinations of these motifs, proving they are not "pure" accumulators.

---

## Troubleshooting

*   **Overfitting:** If reconstruction is perfect but factors are noisy, reduce $R$. CP decomposition is highly sensitive to the rank choice.
*   **Non-Monotonicity Masking:** If you cannot replicate non-monotonic dynamics, check your bin size. If the kernel smoothing (pre-processing) is too large (e.g., $>100ms$), it will "smear" phasic responses, forcing them to look like slow ramps. **Action:** Use a smaller kernel ($\sigma=20ms$).
*   **Choice Bias:** If factors do not separate by choice, ensure data is aligned to *target onset* rather than *movement onset*. Cisek & Kalaska emphasize that the decision dynamics occur during the delay; aligning to the end of the trial will wash out the ramping signals.
*   **Validation:** If the factors do not correlate with behavior, perform a *shuffle test*: permute the trial labels (randomize choice/difficulty) and re-run the decomposition. If the regression $R^2$ drops significantly, your original factors were indeed capturing task-relevant dynamics.
