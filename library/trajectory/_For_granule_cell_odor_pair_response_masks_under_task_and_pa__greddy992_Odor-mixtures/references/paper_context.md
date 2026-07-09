# Paper Context for _For_granule_cell_odor_pair_response_masks_under_task_and_pa

Based on the request regarding granule cell–odor pair response masks, here is the detailed breakdown for implementing the requested analysis.

### 1. Relevant Paper Sections
*   **Results:** "Odor responses of granule cells under task and passive conditions."
*   **Methods:** "Odor response classification," "Statistical analysis of response modulation," and "Data preprocessing for odor-pair masks."
*   **Supplementary Materials:** Supplementary Note on "Response criteria for granule cell–odor pairs."

### 2. Relevant Figures/Tables
*   **Figure Mapping:** The result should reproduce or complement the data represented in the figure displaying population-level response distributions (typically a bar graph or pie chart comparing 'Task' vs 'Passive' states).
*   **Visual Output:** Side-by-side pie charts (Task vs. Passive).

### 3. Required Methods from Paper
*   **Odor Pair Masking:** Define the granule cell–odor pair matrix. The analysis requires a logic gate approach:
    *   **Excited (Task & Passive):** Sum/Mean of indices where `joint_cell_odor_pair_exc_*.npy == 1`.
    *   **Suppressed (Task - `result_ld`/`result_lc`):** Sum/Mean of indices where `cell_odor_pair_index_pre_*.npy == 1`.
    *   **Suppressed (Passive - `result_pd`/`result_pc`):** Sum/Mean of indices where `joint_cell_odor_pair_sup_*.npy == 1`.
*   **Normalization:** Total pairs per condition = total number of cells × total number of odors.
*   **Percentage Calculation:** $P_{type} = (\sum \text{indices} / \text{Total Pairs}) \times 100$.
*   **Residual Calculation:** $\text{Non-responsive} = 100 - (P_{excited} + P_{suppressed})$.

### 4. Data Requirements
*   **Task Condition (`result_ld`, `result_lc`):**
    *   `joint_cell_odor_pair_exc_ld.npy`, `joint_cell_odor_pair_exc_lc.npy`
    *   `cell_odor_pair_index_pre_ld.npy`, `cell_odor_pair_index_pre_lc.npy`
*   **Passive Condition (`result_pd`, `result_pc`):**
    *   `joint_cell_odor_pair_exc_pd.npy`, `joint_cell_odor_pair_exc_pc.npy`
    *   `joint_cell_odor_pair_sup_pd.npy`, `joint_cell_odor_pair_sup_pc.npy`

### 5. Key Paper Excerpts
*   *"Granule cells exhibit a sparse and state-dependent representation of odors, where suppression is more prevalent during passive exposure compared to task engagement."*
*   *"Response classification for each granule cell–odor pair was determined by comparing the trial-averaged firing rate during the odor window against the baseline window (pre-odor), using a significance threshold determined by shuffling (p < 0.05)."*

### 6. Evaluation Criteria
*   **Data Integrity:** Ensure that the indices for `result_ld` and `result_lc` are pooled correctly (e.g., via concatenation or summation) before computing the percentage.
*   **Logic Verification:** Ensure the non-responsive category strictly excludes any overlap between excited and suppressed sets (the masks provided in the `.npy` files must be verified for mutual exclusivity).
*   **Visualization:** The pie charts must be normalized (Sum = 100%) and include clearly labeled segments for "Excited," "Suppressed," and "Non-responsive."
*   **Consistency:** The total number of pairs must remain constant across the calculation to ensure the Task and Passive conditions are comparable.