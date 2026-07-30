# Scientific context

## Methodological requirements

*   **PSTH Construction:** The use of Gaussian or boxcar smoothing kernels (e.g., $\sigma = 20-50$ ms) applied to trial-aligned spike trains.
*   **Normalization:** Techniques such as z-scoring or baseline subtraction (using pre-stimulus activity) to allow for the comparison of heterogeneous neurons.
*   **Trial Binning:** The criteria for grouping trials by "difficulty" (often based on stimulus coherence or sensory evidence magnitude) and "choice" (leftward vs. rightward lick/saccade).

## Required data

*   **Raw Spike Times:** Timestamps for every neuron per trial.
*   **Metadata:** Behavioral log files containing:
    *   `Trial_ID`
    *   `Stimulus_Difficulty` (e.g., coherence level)
    *   `Choice` (L/R)
    *   `Alignment_Events` (Stimulus onset, Go-cue, Outcome).
*   **Calculated PSTHs:** Time-binned firing rates ($R_{i,t,d,c}$ where $i$=neuron, $t$=time, $d$=difficulty, $c$=choice).

## Validation criteria

To verify if the PSTHs answer the question, the following must hold true:
1.  **Temporal Alignment:** Are the PSTHs aligned to a task-relevant event (Stimulus Onset or Choice)?
2.  **Condition Segregation:** Are the profiles clearly separated by at least two levels of difficulty and two directions of choice?
3.  **Statistical Validity:** Is there a measure of variance (e.g., SEM shading) included in the plots?
4.  **Sorting Logic:** Is the sorting based on objective sensory evidence (difficulty) rather than purely behavioral output?

***
