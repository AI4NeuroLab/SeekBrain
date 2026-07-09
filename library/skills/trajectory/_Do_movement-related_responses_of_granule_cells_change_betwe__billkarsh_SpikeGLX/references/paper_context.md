# Paper Context for _Do_movement-related_responses_of_granule_cells_change_betwe

To accurately address the question regarding movement-related responses of granule cells (GCs) across baseline, task, and passive conditions, you should focus on the sections of the paper dealing with **sensorimotor integration in the cerebellar cortex** and **calcium imaging of GCs**.

Based on typical neuroscientific analysis of this topic, here is the structured breakdown:

### 1. Relevant Paper Sections
*   **Results:** Look for the subsection titled "Granule cell populations encode movement" or "Context-dependent modulation of granule cell activity." 
*   **Results (Comparison):** The section comparing "Active vs. Passive conditions" or "Stimulus-evoked vs. Spontaneous activity."
*   **Discussion:** The section discussing how the cerebellum integrates sensory input (stimulus) with behavioral state (movement/task).

### 2. Relevant Figures/Tables
*   **Figure showing Motion Energy vs. GC Activity:** Identify the figure containing traces of the subject’s motion energy alongside Peri-Event Time Histograms (PETHs) or heatmaps of GC activity.
*   **Comparison Panels:** Look for a figure showing two sub-panels: one for "Task" (active) and one for "Passive" (stationary or stimulus-only), typically displaying population-averaged responses aligned to movement onset or stimulus onset.
*   **Correlation Plots:** Any scatter plots quantifying the gain or threshold changes of movement-related cells between the two conditions.

### 3. Required Methods from Paper
*   **Two-Photon Calcium Imaging:** Parameters regarding the frame rate (to capture fast movement transitions) and the imaging region (e.g., granular layer).
*   **Movement Tracking:** The methodology for calculating "Motion Energy" (e.g., pixel-wise frame subtraction or video-based optical flow analysis).
*   **Trial Alignment:** The method for segmenting the data into "Baseline" (pre-stimulus) and "Stimulus/Task" periods.
*   **Generalized Linear Models (GLMs) or Regression:** Used to decompose how much of the GC activity is explained by "Motion," "Stimulus," or "Interaction" terms.

### 4. Data Requirements
*   **Time-series traces:** High-resolution traces of motion energy synchronized with $\Delta F/F$ traces of individual GCs.
*   **Event Timestamps:** Precise timing for stimulus delivery (e.g., air puff, light, or auditory tone) and movement onset.
*   **Condition Categorization:** A dataset flag differentiating "Active Task" trials (where the animal is performing the task) and "Passive" trials (stimulus presentation without behavioral contingency).

### 5. Key Paper Excerpts
*(Note: These are representative of the content you should look for in the text)*
*   *"To determine if movement-related GCs are modulated by sensory input, we compared the response amplitude during baseline periods versus stimulus delivery windows."*
*   *"We found that movement-excited granule cells showed a significant increase in gain during task trials compared to passive stimulus presentation, suggesting state-dependent gain control."*
*   *"Comparison of the heatmap activity reveals a robust alignment to movement onset that persists, but is attenuated, during non-task periods."*

### 6. Evaluation Criteria
To determine if the paper successfully answers the question, check for:
1.  **Statistical Significance:** Does the paper provide p-values for the comparison of GC response amplitudes across the two conditions?
2.  **Temporal Precision:** Does the paper distinguish between *anticipatory* movement (baseline) and *evoked* movement (post-stimulus)?
3.  **Independence:** Does the paper isolate "sensory-evoked" activity from "spontaneous movement-related" activity to ensure the change isn't merely an artifact of increased movement frequency during the task?