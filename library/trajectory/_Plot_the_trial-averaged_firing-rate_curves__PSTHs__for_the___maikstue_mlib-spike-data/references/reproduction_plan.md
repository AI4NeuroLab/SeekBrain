# Reproduction Plan for _Plot_the_trial-averaged_firing-rate_curves__PSTHs__for_the_

To reproduce the requested PSTH analysis, you must implement a custom pipeline in Python, as the provided `mlib-spike-data` repository is a legacy Matlab toolbox incompatible with the Python-based data structure (`.pkl`) required for this analysis.

---

### Prerequisites
*   **Environment:** Python 3.8+
*   **Libraries:** `pandas`, `numpy`, `matplotlib`, `scipy` (for convolution), `pickle`.
*   **Data:** Ensure `population.pkl` is accessible in the working directory.

---

### Step-by-Step Procedure

| Step | Action | Paper/Method Ref | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- |
| **1. Data Loading** | Load `population.pkl` into a Python dictionary. | "Neural Data Preprocessing" | `path: .../population.pkl` | Check that the object contains 14 neurons and metadata. |
| **2. Binning** | Convert spike times into trial-indexed arrays (1ms bins). | "Neural Data Preprocessing" | `bin_size = 1ms` | Verify shape `(N_trials, Total_Time)`. |
| **3. Smoothing** | Convolve binned spikes with a 75ms boxcar/Gaussian kernel. | "Results: Population Dynamics" | `kernel_width = 75ms` | Ensure kernel sums to 1. |
| **4. Subsampling** | Downsample smoothed trace to 10ms increments. | "Data Analysis" | `step = 10ms` | Check array length matches time indices. |
| **5. Grouping** | Subset data by choice (L/R) and difficulty (E/H). | "Results: PMd Dynamics" | 4 conditions | `N_trials` in each group > 0. |
| **6. Calculation** | Calculate Mean and SEM per condition. | "Statistical Calculation" | `SEM = std / sqrt(N)` | Values reflect firing rates (Hz). |
| **7. Plotting** | Generate a $14$-panel subplot figure. | "Representative Figure" | `subplots(7, 2)` | Curves clearly labeled. |

---

### Detailed Implementation Logic (Code Snippet)
```python
import pickle, numpy as np, matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter1d

# 1. Load Data
with open('population.pkl', 'rb') as f:
    data = pickle.load(f)

# 2. PSTH Loop
fig, axes = plt.subplots(7, 2, figsize=(10, 15))
for i, ax in enumerate(axes.flatten()):
    neuron_data = data[f'neuron_{i}'] # Assume dict of trials
    for cond in conditions:
        # Generate binned matrix, convolve with 75ms window
        # Downsample by 10ms
        psth = compute_psth(neuron_data[cond], window=75, step=10)
        mean_fr = np.mean(psth, axis=0)
        sem_fr = np.std(psth, axis=0) / np.sqrt(psth.shape[0])
        
        # Plot with shading
        ax.plot(time_axis, mean_fr, label=cond)
        ax.fill_between(time_axis, mean_fr - sem_fr, mean_fr + sem_fr, alpha=0.2)
```

---

### Expected Output
*   **Visual:** A figure containing 14 distinct subplots. Each subplot shows four colored lines representing the four trial conditions.
*   **Temporal Dynamics:** The x-axis ranges from baseline (pre-stimulus) to post-stimulus. A vertical line at $x=0$ indicates stimulus onset.
*   **Uncertainty:** Shaded regions (SEM) must taper to zero at the trial edges if trials are of variable length, or show consistent thickness if trials are fixed-length.

---

### Troubleshooting
1.  **Data Format Mismatch:** If `population.pkl` is missing the `trial_metadata` keys, you must reconstruct the `condition` index by cross-referencing trial IDs with an external `metadata.csv` if available.
2.  **Smoothing Artifacts:** Ensure the 75ms kernel is normalized. If the firing rates appear inflated, verify you are dividing by the `bin_size` (in seconds) to convert counts to Hz.
3.  **Matlab/Python Bridge:** Do not attempt to run `mlib` functions directly. Treat the `mlib` toolbox as a reference for *naming conventions* (e.g., how they handled alignment) only. If `mlib` code is needed, use `scipy.io.loadmat` to extract raw spike times from `.mat` files and convert to Python objects first.