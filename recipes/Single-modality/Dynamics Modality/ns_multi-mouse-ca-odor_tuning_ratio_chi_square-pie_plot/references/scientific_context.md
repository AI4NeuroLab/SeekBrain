# Scientific context

## Methodological requirements

*   **Odor Pair Masking:** Define the granule cell–odor pair matrix. The analysis requires a logic gate approach:
    *   **Excited (Task & Passive):** Sum/Mean of indices where `joint_cell_odor_pair_exc_*.npy == 1`.
    *   **Suppressed (Task - `result_ld`/`result_lc`):** Sum/Mean of indices where `cell_odor_pair_index_pre_*.npy == 1`.
    *   **Suppressed (Passive - `result_pd`/`result_pc`):** Sum/Mean of indices where `joint_cell_odor_pair_sup_*.npy == 1`.
*   **Normalization:** Total pairs per condition = total number of cells × total number of odors.
*   **Percentage Calculation:** $P_{type} = (\sum \text{indices} / \text{Total Pairs}) \times 100$.
*   **Residual Calculation:** $\text{Non-responsive} = 100 - (P_{excited} + P_{suppressed})$.

## Required data

*   **Task Condition (`result_ld`, `result_lc`):**
    *   `joint_cell_odor_pair_exc_ld.npy`, `joint_cell_odor_pair_exc_lc.npy`
    *   `cell_odor_pair_index_pre_ld.npy`, `cell_odor_pair_index_pre_lc.npy`
*   **Passive Condition (`result_pd`, `result_pc`):**
    *   `joint_cell_odor_pair_exc_pd.npy`, `joint_cell_odor_pair_exc_pc.npy`
    *   `joint_cell_odor_pair_sup_pd.npy`, `joint_cell_odor_pair_sup_pc.npy`

## Validation criteria

*   **Data Integrity:** Ensure that the indices for `result_ld` and `result_lc` are pooled correctly (e.g., via concatenation or summation) before computing the percentage.
*   **Logic Verification:** Ensure the non-responsive category strictly excludes any overlap between excited and suppressed sets (the masks provided in the `.npy` files must be verified for mutual exclusivity).
*   **Visualization:** The pie charts must be normalized (Sum = 100%) and include clearly labeled segments for "Excited," "Suppressed," and "Non-responsive."
*   **Consistency:** The total number of pairs must remain constant across the calculation to ensure the Task and Passive conditions are comparable.
