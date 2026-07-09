# Reproduction Plan for _Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14

This reproduction plan provides a structured approach to generating the 14-neuron PSTH panel for the PMd population dataset described in the paper.

---

## 1. Prerequisites
*   **Environment:** Python 3.9+ with `numpy`, `pandas`, `scipy`, `matplotlib`, and `pickle`.
*   **Data File:** `examples/2024_the_dynamics_and_geometry/data/population.pkl`.
*   **Repo Structure:** Ensure the repository root is in your `PYTHONPATH` to access utility functions if `mlib` modules are used.

---

## 2. Step-by-Step Procedure

| Step | Action | Paper/Code Reference | Input | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Loading** | `load_data.py` | `population.pkl` | Path to file | Check for dict/DataFrame keys: `spikes`, `choice`, `difficulty`. |
| **2** | **Spike Binning** | Paper Methods: "Binning" | Raw spike timestamps | $dt = 10ms$ | Ensure spike array is aligned to `stim_onset` ($t=0$). |
| **3** | **Smoothing** | Paper Methods: "75ms sliding" | Binned spike counts | Window=75ms, Boxcar/Gaussian | Confirm output length matches time window duration. |
| **4** | **Condition Indexing** | Paper: "Four conditions" | `trial_info` metadata | `choice` $\in$ {L, R}, `diff` $\in$ {Easy, Hard} | Confirm trial count per condition is non-zero. |
| **5** | **Averaging** | Paper: "Trial-averaged" | Smoothed spike arrays | N/A | Mean and SEM calculated across axis=0 (trials). |
| **6** | **Visualization** | Paper Fig. 1/2 Logic | Results of Step 5 | 2x7 grid, `matplotlib` | 14 plots, legend included, axis scales labeled. |

---

## 3. Detailed Implementation Logic

### Step 2-3: Kernel Application
Using `numpy`, convolve each trial’s spike train with a 75ms boxcar window.
```python
window_size = int(75 / 10) # assuming 10ms bins
kernel = np.ones(window_size) / window_size
# Apply: smoothed_rate = np.convolve(binned_spikes, kernel, mode='same')
```

### Step 5: SEM Calculation
```python
mean_psth = np.mean(condition_data, axis=0)
sem_psth = np.std(condition_data, axis=0) / np.sqrt(condition_data.shape[0])
```

### Step 6: Plotting Pattern
Iterate through neurons 0-13. Use subplots.
*   **Colors:** Red/Blue for Choice (e.g., Left vs Right).
*   **Linestyles:** Solid for Easy, Dashed for Hard.
*   **Shading:** Use `plt.fill_between` for the `mean ± sem` interval.

---

## 4. Expected Output
*   **Figure:** A $2 \times 7$ grid of subplots.
*   **Axes:** X-axis represents time (typically -200ms to +800ms relative to `stim_onset`); Y-axis represents firing rate (Hz).
*   **Traces:** 4 lines per plot (Left-Easy, Left-Hard, Right-Easy, Right-Hard).
*   **Content:** Visual confirmation of heterogeneity (e.g., one neuron might show a sharp increase for "Left" choices, while another might be selective to "Easy" difficulty).

---

## 5. Troubleshooting
*   **Temporal Shift:** If the PSTHs look offset, verify that the `stim_onset` was subtracted from every spike timestamp *before* binning.
*   **Empty Trials:** If a specific condition (e.g., Right/Hard) has very few trials, the SEM may be artificially large; consider adding a `min_trials` threshold (e.g., $N > 5$).
*   **Boundary Effects:** `np.convolve` with `mode='same'` can cause edge artifacts. Ensure the window is fully contained within the trial duration, or trim the first/last $W/2$ bins.
*   **Memory/Formatting:** If `population.pkl` is large, use `pandas.DataFrame` memory mapping or process one neuron at a time to keep the memory footprint low.