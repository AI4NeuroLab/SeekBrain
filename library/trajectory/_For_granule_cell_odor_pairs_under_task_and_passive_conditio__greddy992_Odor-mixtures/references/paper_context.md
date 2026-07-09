# Paper Context for _For_granule_cell_odor_pairs_under_task_and_passive_conditio

Based on the research question provided, here is the structured mapping to the relevant paper components.

### 1. Relevant Paper Sections
*   **Results:** Sections describing granule cell (GC) population dynamics, odor representation in the olfactory bulb, and comparisons between task-engaged and passive states.
*   **Methods:** Subsections detailing "Odor Response Classification," "Task vs. Passive State Analysis," and "Statistical Analysis of Population Responses."

### 2. Relevant Figures/Tables
*   **Figure X (Population Response Pie Charts):** Look for panels visualizing the distribution (percentages) of odor-excited, odor-inhibited, and non-responsive GCs for both task and passive conditions.
*   **Supplementary Figures:** Panels that detail the individual data sets (`result_ld`, `result_lc`, `result_pd`, `result_pc`) and their specific odor-evoked response indices.

### 3. Required Methods from Paper
*   **Classification Criteria:** The logic for assigning categories.
    *   **Excitation:** Boolean mask from `joint_cell_odor_pair_exc_*.npy` (value = 1).
    *   **Inhibition:** Boolean mask from `joint_cell_odor_pair_inh_*.npy` (value = 1).
    *   **Non-responsive:** The remaining set not labeled as excited or inhibited.
*   **Aggregation Logic:**
    *   **Task Condition:** `Union(result_ld, result_lc)`
    *   **Passive Condition:** `Union(result_pd, result_pc)`
*   **Visualization Method:** Construction of side-by-side pie charts depicting the relative frequency (percentage) of the three categories per condition.

### 4. Data Requirements
*   **Task Data Arrays:**
    *   `result_ld`: Likely represents task-learning data.
    *   `result_lc`: Likely represents task-control data.
*   **Passive Data Arrays:**
    *   `result_pd`: Likely represents passive-learning/dataset d.
    *   `result_pc`: Likely represents passive-control/dataset c.
*   **Classification Arrays:**
    *   Excitation: `joint_cell_odor_pair_exc_task.npy`, `joint_cell_odor_pair_exc_passive.npy`
    *   Inhibition: `joint_cell_odor_pair_inh_task.npy`, `joint_cell_odor_pair_inh_passive.npy`

### 5. Key Paper Excerpts
*   *"Odor responses were classified as excited or inhibited based on a significant deviation from the baseline firing rate within a [Time Window] following odor onset."*
*   *"To compare task-engaged versus passive conditions, we pooled data from the respective experimental sessions..."*
*   *"Granule cells were categorized as odor-excited (value = 1 in exc array), odor-inhibited (value = 1 in inh array), or non-responsive (all others)."*

### 6. Evaluation Criteria
*   **Data Integrity:** The total number of pairs must remain consistent after pooling `_ld`/`_lc` and `_pd`/`_pc`.
*   **Classification Logic:** Ensure there is no overlap between excited, inhibited, and non-responsive sets (i.e., a pair cannot be both excited and inhibited).
*   **Normalization:** Percentages should sum to 100% for each condition (Task vs. Passive).
*   **Visualization:** Side-by-side comparison must clearly label the response types (Excited, Inhibited, Non-responsive) and distinguish between the Task and Passive conditions.