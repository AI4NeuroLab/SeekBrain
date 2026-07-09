# Reproduction Plan for _For_granule_cell_odor_pair_response_masks_under_task_and_pa

To reproduce the granule cell (GC) odor-pair response distribution analysis, follow this plan. Please note that as identified in the mapping, this requires access to the raw experimental `.npy` result files, as the provided simulation code focuses on the *mechanistic modeling* of these outcomes rather than the *empirical processing* of them.

### Prerequisites
1.  **Environment:** Python 3.x with `numpy`, `matplotlib`, and `pathlib` installed.
2.  **Data:** Access to the experimental artifact directory containing the eight specific `.npy` files:
    *   `joint_cell_odor_pair_exc_{ld, lc, pd, pc}.npy`
    *   `cell_odor_pair_index_pre_{ld, lc}.npy` (Task-suppressed)
    *   `joint_cell_odor_pair_sup_{pd, pc}.npy` (Passive-suppressed)
3.  **Dependency:** A script file `analyze_gc_responses.py` (to be created).

---

### Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Load Masks** | Methods: "Odor response classification" | N/A (New script) | `.npy` files | NumPy arrays | Check `shape` is consistent across all files. |
| **2** | **Pool Conditions** | Results: "Task vs Passive conditions" | N/A (New script) | Exc/Sup arrays | Pooled arrays | `shape[0]` (Total Pairs) matches target. |
| **3** | **Calc Percentages** | Methods: "Response criteria" | N/A (New script) | Pooled arrays | Floats (0-100) | Sum of percentages $\leq 100$. |
| **4** | **Compute Non-Resp** | Methods: "Statistical analysis" | N/A (New script) | Exc/Sup % | Residual % | $100 - (\text{Exc} + \text{Sup}) = \text{Non-Resp}$. |
| **5** | **Visualization** | Figure: Population distribution | N/A (New script) | Calc percentages | EPS/PNG files | Pie chart segments = 3. |

#### Step-by-Step Execution Detail:
1.  **Data Loading:** Use `np.load()` to store the variables. Example: `exc_ld = np.load('joint_cell_odor_pair_exc_ld.npy')`.
2.  **Pooling Logic:** 
    *   `Task_Exc = np.concatenate([exc_ld, exc_lc], axis=0)`
    *   `Task_Sup = np.concatenate([pre_ld, pre_lc], axis=0)`
    *   `Passive_Exc = np.concatenate([exc_pd, exc_pc], axis=0)`
    *   `Passive_Sup = np.concatenate([sup_pd, sup_pc], axis=0)`
3.  **Metrics:** 
    *   `P_Exc = (np.sum(Task_Exc) / Task_Exc.size) * 100`
    *   Repeat for other three arrays.
4.  **Verification:** Ensure `P_Exc + P_Sup` never exceeds 100. If it does, there is an overlap in your binary masks; verify if the empirical pipeline treats these as mutually exclusive.
5.  **Plotting:** Use `fig, (ax1, ax2) = plt.subplots(1, 2)`. Use `ax.pie()` with `labels=['Excited', 'Suppressed', 'Non-responsive']`.

---

### Expected Output
*   **Console Output:** Print statements of calculated percentages for Task (Exc, Sup, Non) and Passive (Exc, Sup, Non).
*   **Visual Output:** A high-resolution figure (side-by-side pie charts) where the "Non-responsive" slice represents the majority of the GC population, consistent with sparse odor representation in the olfactory bulb.

---

### Troubleshooting
*   **Dimensionality Mismatch:** If `np.concatenate` fails, verify that `cell_odor_pair_index_pre_ld.npy` and `joint_cell_odor_pair_exc_ld.npy` share identical dimensions (Total Neurons $\times$ Total Odors).
*   **Zero Division:** Ensure that the denominator (`size`) is not zero. If `size` is zero, the file was not loaded correctly or is empty.
*   **Logic Conflict:** The paper defines specific thresholds for suppression in Task vs Passive. If the labels (`pre_` vs `sup_`) feel interchangeable, double-check the supplementary note to ensure you are not mixing the *passive suppression* definition with the *task-pre-odor* suppression definition.
*   **Plotting:** If segments do not appear, ensure that percentages are passed as a list: `[exc, sup, non]`. Pie charts require all three to sum to 100.