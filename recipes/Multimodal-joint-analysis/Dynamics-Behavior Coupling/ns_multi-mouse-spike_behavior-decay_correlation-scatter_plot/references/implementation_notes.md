# Implementation notes

## Prerequisites

1.  **Hardware/Data:** Raw binary files (`.bin`) and metadata (`.meta`) acquired via SpikeGLX.
2.  **Software Environment:**
    *   **Data Processing:** Spike sorting pipeline (e.g., Kilosort 4).
    *   **Analytical Environment:** Python (libraries: `numpy`, `scipy`, `statsmodels`, `pandas`) or MATLAB.
    *   **Behavioral Tracking:** Pre-computed behavioral state labels (e.g., from DeepLabCut + B-SOiD/MoSeq).
3.  **Synchronization Data:** TTL pulse logs or clock-sync signals from the SpikeGLX `NI` (National Instruments) stream to align neural spikes with video frames.

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Quality Control** | Methods (Robustness) | `BIST_Help.md` | `.meta` files | Bad channel mask | Verify `snsGeomMap` consistency. |
| **2** | **Spike Extraction** | Methods (Neural) | SpikeGLX Stream | `.bin` files | Sorted spike trains | Check `run.missed_samples` (log) for jitter. |
| **3** | **State Latent Modeling** | Methods (Neural) | Custom Script | Spike counts | Latent time-series | Compare with PCA/GPFA benchmarks. |
| **4** | **Autocorrelation Fitting** | Methods (Time Constants) | Custom Script | Latent factors | $\tau$ (time constant) | Residuals of fit $< \epsilon$. |
| **5** | **Inverse Decay Calc** | Methods (Math) | N/A | $\tau$ | $\lambda = 1/\tau$ | Confirm $\lambda > 0$. |
| **6** | **Behavioral Persistence** | Methods (Behavior) | N/A | Video labels | $\lambda_{beh}$ | Confirm units match neural $\lambda$. |
| **7** | **Correlation Analysis** | Results (Correlation) | Custom Script | $\lambda_{neural}, \lambda_{beh}$ | $r, p$-value | Ensure $N$ = sessions. |

---

## Expected artifacts

*   **Scatter Plot:** A session-level plot with $\lambda_{neural}$ on the x-axis and $\lambda_{beh}$ on the y-axis, ideally showing a monotonic relationship.
*   **Statistical Report:** A correlation coefficient ($r$) and a $p$-value indicating whether neural and behavioral dynamics are coupled across the animal's experimental history.

---

## Troubleshooting

*   **"No Correlation Found":** 
    *   *Check Temporal Alignment:* Use the `Audio_Help.md` sync indices to ensure neural and behavioral data aren't time-shifted by a constant offset.
    *   *Binning Sensitivity:* The choice of bin size for spike counts heavily influences $\tau$. Perform a sensitivity analysis by varying bin sizes; if the correlation only appears at specific scales, the "timescale" of the neural-behavioral coupling is restricted.
*   **High Variance in $\lambda$:**
    *   Check for hardware artifacts identified in the `Agenda.txt` notes. If specific sessions had high "crackling" (NI stream artifacts), discard these, as they distort the high-frequency components of the neural signal, potentially biasing $\tau$.
*   **Fitting Instability:** If $\tau$ is non-exponential (e.g., power-law), consider using a multi-exponential fit, as some neural dynamics are multi-timescale.
