# Reproduction Plan for _For_granule_cell_odor_pairs_under_task_and_passive_conditio

This reproduction plan outlines the steps required to classify Granule Cell (GC) odor responses based on the experimental data structure described. Since the provided repository contains modeling scripts rather than experimental analysis scripts, this plan focuses on implementing the data-processing pipeline required to bridge that gap.

---

## Prerequisites
1.  **Environment:** Python 3.x with `numpy`, `matplotlib`, and `pandas`.
2.  **Data Files:** Access to the following `.npy` files:
    *   `result_ld.npy`, `result_lc.npy` (Task conditions)
    *   `result_pd.npy`, `result_pc.npy` (Passive conditions)
    *   `joint_cell_odor_pair_exc_task.npy`, `joint_cell_odor_pair_inh_task.npy`
    *   `joint_cell_odor_pair_exc_passive.npy`, `joint_cell_odor_pair_inh_passive.npy`

---

## Step-by-Step Procedure

| Step | Action | Paper/Code Reference | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Loading** | Methods: Data Aggregation | `result_*.npy` files | Loaded numpy arrays | Verify array shapes match expectation |
| **2** | **Aggregation** | Methods: Pooled conditions | Loaded `result_*` arrays | `task_data`, `passive_data` | `shape` of pooled array = sum of constituent shapes |
| **3** | **Classification** | Methods: GC Response Types | Excitation/Inhibition masks | Boolean arrays per condition | Ensure `(exc & inh).sum() == 0` |
| **4** | **Percentage Calculation** | Results: Pop. Distribution | Boolean masks | Dictionary of percentages | Sum of % per condition = 100% |
| **5** | **Visualization** | Results: Fig X (Pie charts) | Percentage dictionary | Side-by-side Matplotlib charts | Labels match categories; legend present |

---

### Detailed Execution

#### Step 1 & 2: Data Aggregation
Load the arrays and concatenate them by condition.
*   **Action:**
    ```python
    task_exc = np.concatenate([np.load('exc_ld.npy'), np.load('exc_lc.npy')])
    task_inh = np.concatenate([np.load('inh_ld.npy'), np.load('inh_lc.npy')])
    # Repeat for passive_exc, passive_inh
    ```

#### Step 3: Classification Logic
Identify categories based on the prompt's exclusion rules.
*   **Action:**
    ```python
    def classify(exc_arr, inh_arr):
        excited = (exc_arr == 1)
        inhibited = (inh_arr == 1)
        non_resp = ~(excited | inhibited)
        return excited, inhibited, non_resp
    ```

#### Step 4: Statistical Calculation
Count occurrences and normalize by total number of pairs.
*   **Action:**
    ```python
    def get_stats(ex, inh, nr):
        total = len(ex)
        return [ex.sum()/total, inh.sum()/total, nr.sum()/total]
    ```

#### Step 5: Visualization
Generate the pie charts using `matplotlib`.
*   **Action:** Use `plt.subplots(1, 2)` to create side-by-side axes. Call `ax[0].pie()` and `ax[1].pie()` with the stats calculated in Step 4. Ensure `autopct='%1.1f%%'` is used for clarity.

---

## Expected Output
1.  **Statistical Output:** Printed console output showing the distribution:
    *   *Task:* Excited: X%, Inhibited: Y%, Non-responsive: Z%
    *   *Passive:* Excited: X%, Inhibited: Y%, Non-responsive: Z%
2.  **Visualization:** A single figure file containing two circular pie charts, with a legend indicating the three response types, and clear titles distinguishing the "Task" and "Passive" conditions.

---

## Troubleshooting
*   **Shape Mismatch:** If `np.concatenate` fails, verify that the second dimension (odor/cell index) is consistent across `ld` and `lc` files. Use `np.vstack` if they represent observations to be aligned.
*   **Overlap Error:** If a pair is classified as both "excited" and "inhibited," check if the raw `.npy` files contain conflicting binary flags. This suggests a pre-processing error in the source data.
*   **Missing Files:** If specific `.npy` files are missing, ensure you are running the script within the directory containing the processed experimental data export, not just the simulation code directory.
*   **Normalization:** If percentages do not sum to 100%, verify that the `non_responsive` mask is explicitly defined as `~(excited | inhibited)` rather than assuming the values are only 0 or 1.