# Implementation notes

## Prerequisites

1.  **Environment:** Python 3.x with `numpy`, `matplotlib`, and `pathlib` installed.
2.  **Data:** Access to the experimental artifact directory containing the eight specific `.npy` files:
    *   `joint_cell_odor_pair_exc_{ld, lc, pd, pc}.npy`
    *   `cell_odor_pair_index_pre_{ld, lc}.npy` (Task-suppressed)
    *   `joint_cell_odor_pair_sup_{pd, pc}.npy` (Passive-suppressed)
3.  **Dependency:** A script file `analyze_gc_responses.py` (to be created).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Load Masks** | Methods: "Odor response classification" | N/A (New script) | `.npy` files | NumPy arrays | Check `shape` is consistent across all files. |
| **2** | **Pool Conditions** | Results: "Task vs Passive conditions" | N/A (New script) | Exc/Sup arrays | Pooled arrays | `shape[0]` (Total Pairs) matches target. |
| **3** | **Calc Percentages** | Methods: "Response criteria" | N/A (New script) | Pooled arrays | Floats (0-100) | Sum of percentages $\leq 100$. |
| **4** | **Compute Non-Resp** | Methods: "Statistical analysis" | N/A (New script) | Exc/Sup % | Residual % | $100 - (\text{Exc} + \text{Sup}) = \text{Non-Resp}$. |
| **5** | **Visualization** | Figure: Population distribution | N/A (New script) | Calc percentages | EPS/PNG files | Pie chart segments = 3. |

## Expected artifacts

*   **Console Output:** Print statements of calculated percentages for Task (Exc, Sup, Non) and Passive (Exc, Sup, Non).
*   **Visual Output:** A high-resolution figure (side-by-side pie charts) where the "Non-responsive" slice represents the majority of the GC population, consistent with sparse odor representation in the olfactory bulb.

---

## Troubleshooting

*   **Dimensionality Mismatch:** If `np.concatenate` fails, verify that `cell_odor_pair_index_pre_ld.npy` and `joint_cell_odor_pair_exc_ld.npy` share identical dimensions (Total Neurons $\times$ Total Odors).
*   **Zero Division:** Ensure that the denominator (`size`) is not zero. If `size` is zero, the file was not loaded correctly or is empty.
*   **Logic Conflict:** The study defines specific thresholds for suppression in Task vs Passive. If the labels (`pre_` vs `sup_`) feel interchangeable, double-check the supplementary note to ensure you are not mixing the *passive suppression* definition with the *task-pre-odor* suppression definition.
*   **Plotting:** If segments do not appear, ensure that percentages are passed as a list: `[exc, sup, non]`. Pie charts require all three to sum to 100.
