---
name: ns_multi-c_elegans-ca_behavior-ridge-timeseries_trace
description: Performs time-offset ridge regression to evaluate if neural activity encodes past behavioral velocity, quantifying performance against shuffled control decoders.
triggers:
  - Does current neural activity contain information about past behavior?
  - How to implement time-lagged ridge regression for neural decoding?
  - Calculate decoding performance difference between actual and scrambled behavior
  - Predict velocity from neural activity at various time offsets
  - Generate performance plots for neural behavioral predictive modeling
tags:
  - neural-decoding
  - ridge-regression
  - time-lagged-analysis
  - behavioral-neuroscience
  - predictive-modeling
version: '1.0'
---

# Time-Lagged Ridge Regression Decoding of Behavioral Velocity

This recipe focuses on quantifying how much information current neural activity carries about past and future behavioral states. By mapping neural firing patterns $R(t)$ to velocity $V(t + \tau)$ using ridge regression, researchers can identify predictive temporal windows where neural populations encode history or expectation.

The analysis is performed by training linear decoders across a range of time offsets ($\tau$), quantifying performance as the difference in Mean Squared Error (MSE) between actual predictions and those derived from scrambled (null) behavioral labels. A 10-second sliding window is applied to the predictions to smooth high-frequency fluctuations before performance evaluation.

## When to use this

- Decode past or future velocity from current neural activity across a defined lag range.
- Compare ridge-decoder error with a label-shuffled control and plot performance across time offsets.
- Do not use this workflow when neural and behavioral samples cannot be synchronized to one time base.

## Scientific context

Time-lagged decoding tests whether neural activity is purely reactive or maintains information about behavior over time. Plot decoder performance for velocity $V(t+\tau)$ from current neural data $R(t)$ across the tested offsets.

## Preconditions

*   Python 3.8+
*   `scikit-learn` (for `Ridge` and `RidgeCV`)
*   `numpy` / `scipy` (for math, smoothing, and shuffling)
*   `matplotlib` (for visualization)

## Inputs and outputs

1.  **Neural Matrix ($R$):** $N_{neurons} \times T_{time}$ matrix of binned firing rates.
2.  **Velocity Vector ($V$):** $1 \times T_{time}$ vector of behavioral speeds.
3.  **Temporal Range:** A vector of offsets (e.g., `np.linspace(-5, 5, 20)`).

*   **Performance Matrix:** $Animals \times Offsets$ array containing the calculated error differences.
*   **Visualization:** A plot showing the Brown curve (mean $\pm$ SD across animals) with X-axis as $\tau$ (seconds) and Y-axis as performance units.

## Procedure

1.  **Ridge Regression:** Employs Tikhonov regularization to map high-dimensional neural activity to continuous velocity vectors.
2.  **Time-Lagged Decoding:** Systematic shifting of $\tau$ allows for probing the predictive window.
3.  **Control Generation:** Shuffling neural data or behavior labels to establish a baseline error for performance normalization.
4.  **Smoothing:** Applying a 10-second sliding window average to mitigate noise.

*   **Assumptions:** Data is provided as continuous time-series (sampled at $f_s$).
*   **Pipeline:**
    1. Align $R(t)$ and $V(t)$ to a common time axis.
    2. Iterate through $\tau$ values (e.g., -5s to +5s).
    3. For each $\tau$, split data into train/test folds.
    4. Fit `Ridge` regressor to $R_{train} \to V_{train, \tau}$.
    5. Predict on $R_{test}$ and apply 10s smoothing.
    6. Calculate $MSE_{actual}$ vs $MSE_{scrambled}$.

1.  **Alignment:** Synchronize $R$ and $V$ to the same sampling rate ($f_s$).
2.  **Smoothing:** Define a window size $W = 10 \times f_s$.
3.  **Decoding Loop:** For each $\tau$, shift $V$ by $\tau$ frames.
4.  **Model Training:** Use cross-validation to fit the ridge regression model, minimizing $\|R\beta - V_{\tau}\|^2 + \alpha\|\beta\|^2$.
5.  **Null Distribution:** Shuffle $V$ using `numpy.random.permutation` and repeat the training loop to calculate $MSE_{control}$.
6.  **Performance:** Compute $Perf(\tau) = MSE_{control} - MSE_{actual}$.

## Expected results

The "Brown" performance curve should peak at $\tau = 0$ (current velocity) and show decay as $|\tau|$ increases. If the curve remains significantly above the zero-baseline at negative offsets, it suggests neural activity carries information about past behavior.

*   **Baseline Check:** Performance at extreme $\tau$ (very past/future) should approach 0 (baseline).
*   **Consistency:** The standard deviation (SD) shading should narrow as the decoder approaches $\tau=0$ if the neural encoding of velocity is a consistent feature across subjects.

## Pitfalls

*   **Data Leakage:** Ensure training/testing splits are performed on temporal blocks (not random samples) to maintain the integrity of time-series data.
*   **Hyperparameter Tuning:** Use `RidgeCV` to automatically determine optimal regularization ($\alpha$) for each animal to prevent overfitting.
*   **Edge Effects:** Truncate or pad data carefully when applying the 10-second sliding window to prevent biases at the beginning and end of recording sessions.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Example pseudo-command to trigger the decoding analysis
python run_decoding.py --input_data ./data/animal_01.mat --tau_range -5 5 --window 10
```
