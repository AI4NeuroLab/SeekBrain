# Implementation notes

## Prerequisites

*   **Data Environment:** A processed matrix $R$ (Neural activity: $N_{neurons} \times T_{time}$) and a vector $V$ (Behavioral velocity: $1 \times T_{time}$).
*   **Software Stack:** Python 3.8+, `scikit-learn` (for `Ridge`), `numpy`/`scipy` (for math and smoothing), and `matplotlib` (for visualization).
*   **Data Integrity:** Neural and behavioral data must be resampled to the same sampling rate ($f_s$).

---

## Execution details

| Step | Action | study/Implementation basis | Input | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Time-Shift Alignment** | Methodology: "predict velocity at various time offsets" | Raw $V(t)$ | $\tau \in [-T_{lag}, +T_{lag}]$ | Check length of $V$ after shift. |
| **2** | **Sliding Window** | Methodology: "10-sec sliding window" | Predicted $V$ | Window = $10 \times f_s$ | Verify window duration in samples. |
| **3** | **Ridge Regression** | Methodology: "Ridge regression" | $R(t) \to V(t+\tau)$ | $\alpha$ (Regularization) | `score` > 0 on test set. |
| **4** | **Control Generation** | Methodology: "scrambled control" | $V(t)$ labels | `np.random.permutation` | MSE of control should be high. |
| **5** | **Performance Calculation** | Methodology: $MSE_{control} - MSE_{actual}$ | MSE values | `MSE_diff` | Must yield values in original units. |

## Expected artifacts

*   **Figure Plot:** A plot with `Time offset (s)` on the X-axis and `Decoding Performance (MSE difference)` on the Y-axis.
*   **Brown Curve:** Should peak at $\tau = 0$ and decay toward the control baseline as $|\tau|$ increases.
*   **Horizontal Reference:** If the brown curve stays above 0 at negative offsets, you have confirmed neural information about past behavior.
*   **Error Bars:** Shaded region representing `np.std(data, axis=0)` representing animal-to-animal variability.

---

## Troubleshooting

*   **Decoder performs too well at large $\tau$:** Check for data leakage. Are you using future neural data to predict past velocity? Ensure the alignment $R(t) \to V(t+\tau)$ strictly segregates indices.
*   **"Brown" curve looks identical to "Control":** This indicates the neural population recorded might not encode behavior at that specific time lag, or the Ridge `alpha` is too high (underfitting). Run a hyperparameter sweep for `alpha` using `RidgeCV`.
*   **Smoothing issues:** If the 10-second window causes significant loss of data at the edges, use `mode='same'` in `np.convolve` to maintain index alignment.
*   **High animal variance:** If the SD shading is extremely wide, verify that behavioral data was normalized (Z-scored) per animal before the regression to account for differences in baseline movement speed.
