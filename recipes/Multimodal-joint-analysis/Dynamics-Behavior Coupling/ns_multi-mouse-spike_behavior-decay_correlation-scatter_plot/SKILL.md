---
name: ns_multi-mouse-spike_behavior-decay_correlation-scatter_plot
description: Tests whether neural and behavioral temporal dynamics covary across sessions by estimating and correlating their inverse decay constants.
triggers:
  - correlate neural and behavioral decay constants across sessions
  - estimate inverse timescales from neural latent dynamics
  - compare neural autocorrelation decay with behavioral dwell times
  - plot session-level neural versus behavioral decay rates
  - test coupling between brain and behavioral timescales
tags:
  - neuroscience
  - temporal-dynamics
  - decay-constants
  - correlation
version: '1.0'
---

# Cross-Session Correlation of Neural and Behavioral Inverse Decay Constants

This recipe establishes a methodological bridge between high-fidelity neural acquisition (using SpikeGLX) and downstream computational analysis of temporal dynamics. By calculating the inverse decay constant ($\lambda = 1/\tau$) from neural latent states and behavioral dwell-times, researchers can quantify the synchronization of timescales between the brain and the body across experimental sessions.

Correlate neural inverse decay constants ($\lambda_{neural}$) with behavioral inverse decay constants ($\lambda_{beh}$) across sessions to quantify the relationship between neural dynamics and behavioral persistence.

## When to use this

- Estimate neural and behavioral inverse decay constants for each recording session.
- Test their session-level association and visualize the paired estimates in a scatter plot.
- Do not use this workflow when decay estimates come from non-independent time bins rather than sessions.

## Scientific context

Neural populations often exhibit temporal fluctuations that reflect underlying latent states. By modeling these as stochastic processes, we can estimate a characteristic timescale ($\tau$). If neural activity is fundamentally coupled to behavior, the rate of change in these states should mirror the persistence of behavioral states.

## Preconditions

*   **Data Acquisition/Cleaning:** SpikeGLX binaries (`.bin`) and metadata (`.meta`).
*   **Analysis:** `NumPy` and `SciPy` for exponential fitting; `Pandas` for session-wise aggregation.

## Inputs and outputs

1. Raw Neural Binaries (`.imec.ap`, `.imec.lf`).
2. Metadata files (`.meta`) containing sample rate and start-time offsets.
3. Behavioral timestamps (synchronized via TTL).
4. Error log files (`run.missed_samples` or `Agenda.txt` notes).

*   **Scatter Plot:** X-axis ($\lambda_{neural}$), Y-axis ($\lambda_{beh}$), where each point is a distinct session.
*   **Result Table:** Including $r$, $p$-value, and $N$ (number of sessions).

## Procedure

1. **Neural Latent Extraction:** Decompose high-dimensional spike counts into latent temporal factors using dimensionality reduction (e.g., GPFA or HMM).
2. **Autocorrelation Fitting:** Fit an exponential decay function $A(t) = e^{-t/\tau}$ to the autocorrelation of the extracted latent factors.
3. **Inverse Decay Calculation:** Compute the reciprocal of the fitted time constant: $\lambda = 1/\tau$.
4. **Behavioral Persistence:** Calculate state dwell-time distributions from behavioral labels and fit an exponential decay to estimate behavioral $\lambda_{beh}$.
5. **Correlation Analysis:** Perform a Pearson’s correlation between $\lambda_{neural}$ and $\lambda_{beh}$ across all $N$ experimental sessions.

### Code Architecture
The implementation relies on extracting binary data from the `SpikeGLX` acquisition engine, verifying metadata integrity (sample rates and TTL sync), and performing post-hoc numerical analysis in an external environment (Python/MATLAB).

### Key Functions and Modules
*   **CatGT:** Used to perform channel-level exclusion and temporal segmentation of raw `.imec.ap` files.
*   **FileViewer:** Used for visual verification of spike-behavior alignment and metadata checking.
*   **`run.missed_samples` logs:** Used as a mandatory filter to exclude sessions where clock drift or hardware errors may have biased the decay fit.
*   **`ColorTTL` logic:** Used to align behavioral frames with neural sample indices based on the `NI` (National Instruments) stream.

1. **Hardware Integrity Filter:** Run a script to parse `run.missed_samples`. Exclude any session where missed samples $> 0.01\%$ of total duration.
2. **Neural Extraction:** Use `CatGT` to extract the neural signal, applying the `u-flags` from `BIST_Help.md` to mask faulty channels.
3. **Synchronization:** Use `ColorTTL` logic to map behavioral labels to the neural time-axis (sampling at original `meta` rate).
4. **Decay Fitting:** For each session, calculate the autocorrelation of neural latents. Fit $f(t) = \exp(-t/\tau)$ using `scipy.optimize.curve_fit`.
5. **Inverse Computation:** Apply $\lambda = 1/\tau$. Repeat for behavioral dwell-times.
6. **Correlation:** Construct a session-level dataframe and compute Spearman’s correlation coefficient between $\lambda_{neural}$ and $\lambda_{beh}$.

## Expected results

Evaluate whether neural decay rates and behavioral transition rates show a significant positive correlation (Pearson’s $r > 0, p < 0.05$), which would support coupling between neural-population and behavioral timescales.

*   Residuals of the exponential fit must remain below a predefined error threshold ($\epsilon < 0.05$).
*   The correlation must be performed at the *session level* to ensure independent samples ($N_{sessions}$), avoiding the use of time-bins as degrees of freedom.

## Pitfalls

*   **Hardware Bias:** Ensure that "crackling" or hardware-level artifacts (noted in `Agenda.txt`) are removed before fitting; these artifacts appear as high-frequency noise that drastically inflates $\lambda$.
*   **Binning Sensitivity:** The choice of spike count bin size determines the range of detectable $\tau$. Use a consistent bin size (e.g., 20ms) across all sessions to ensure comparability.
*   **Non-Stationarity:** If a session shows significant drift in the `CalSRate` metrics, the decay constants will be unreliable. Always check drift before finalizing the session-wise $\lambda$ value.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Extract neural segments using CatGT protocol
CatGT -run=Session01 -ap -prb=0 -g=0 -t=0,1000 -out_path=/data/processed/

# Run the fitting script after pre-processing
python FitDynamics.py --input_dir=/data/processed/ --meta_file=Session01.meta
```
