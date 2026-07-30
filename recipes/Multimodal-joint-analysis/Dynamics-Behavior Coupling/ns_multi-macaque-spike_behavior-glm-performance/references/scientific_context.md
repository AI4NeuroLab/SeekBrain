# Scientific context

## Methodological requirements

*   **Logistic Regression:** A model defining $P(Right\_Choice) = \beta_0 + \beta_1(Contrast) + \beta_2(Prior) + \beta_3(Neural\_Activity)$. 
*   **Decoding/Neurometric Fitting:** Fitting neural activity data to a psychometric function (e.g., cumulative Gaussian or sigmoid) to derive a threshold and bias (PSE).
*   **Trial Selection:** Exclusion criteria for SC neurons (e.g., must be in the motor-related intermediate layers, showing significant buildup activity during delay).
*   **Time-Window Selection:** A sliding window or a fixed post-stimulus delay window (usually after stimulus offset but before saccade initiation) to isolate "post-stimulus neural activity."

## Required data

*   **Trial-level data:** Signed stimulus contrast, prior probability condition (block type), and neural firing rates (spikes/sec) averaged within the specific post-stimulus window.
*   **Choice data:** Binary outcome (Right vs. Left choice) for every trial.
*   **Neural units:** Identification of SC neurons with spatially selective motor fields (M-neurons) that represent the chosen stimulus location.

## Validation criteria

*   **Precision of the Bias Estimate:** Did the neural activity shift the neurometric curve in the same direction and magnitude as the behavioral choice bias?
*   **Statistical Significance:** Does the interaction term $\beta(Prior \times Contrast)$ in the neural-activity-based regression reach significance ($p < 0.05$)?
*   **Temporal Specificity:** Is the neural modulation restricted to the post-stimulus period, or does it exist throughout the delay (indicating a baseline state rather than a stimulus-processing effect)?
*   **Directionality:** Is the "Right-stimulus choice" decoding sensitive to SC neural activity located in the contralateral (leftward-representing) vs. ipsilateral motor map?
