---
name: ns_multi-macaque-spike_behavior-glm-performance
description: Quantifies whether post-stimulus superior colliculus activity reflects prior-dependent shifts in perceptual choice using trial-aligned firing rates and logistic regression.
triggers:
  - test prior-dependent modulation in superior colliculus activity
  - fit a choice model with contrast, prior, and neural activity
  - compare neurometric curves across prior conditions
  - quantify post-stimulus firing-rate effects on perceptual choice
  - estimate prior-dependent shifts in point of subjective equality
tags:
  - neuroscience
  - superior-colliculus
  - logistic-regression
  - choice-bias
version: '1.0'
---

# Quantifying Prior-Dependent Shifts in Superior Colliculus Neural Activity

This recipe describes the methodology and implementation for testing whether neural activity in the superior colliculus (SC) reflects prior-dependent biases in perceptual decision-making. By combining behavioral tasks with high-resolution neural recordings, we investigate how the SC—a key node for saccadic motor output—integrates stimulus evidence with prior knowledge (choice history or block probability).

The experimental design relies on the **Lablib** framework to manage precise trial-state machines, allowing for the manipulation of prior probabilities across experimental blocks. By synchronizing neural data with these state-controlled epochs, we can construct neurometric curves and evaluate how the SC’s motor-related activity accounts for trial-to-trial shifts in the Point of Subjective Equality (PSE).

## When to use this

- Test whether post-stimulus superior-colliculus activity reflects prior-dependent choice shifts.
- Fit a trial-level choice model containing contrast, prior condition, and neural firing rate.
- Do not use this workflow when stimulus, choice, prior, and neural event clocks cannot be aligned.

## Scientific context

The superior colliculus is traditionally viewed as an eye-movement command center. However, research suggests that SC activity, particularly in intermediate motor-related layers, reflects the accumulation of sensory evidence and prior biases during decision-making. Testing this requires evaluating if the neural neurometric curve (choice probability vs. contrast) shifts laterally in response to prior-informed trial blocks.

## Preconditions

*   MATLAB (for execution of Lablib infrastructure).
*   External statistical software (e.g., Python/R/MATLAB) for logistic regression modeling and neurometric fitting.
*   Neural recording suite (e.g., Plexon/Blackrock) capable of receiving TTL markers.

## Inputs and outputs

1.  Raw neural spike trains (timestamps).
2.  Format 6 Binary logs containing `SignedContrast`, `PriorCondition`, and `Choice`.
3.  TTL event markers denoting `StimulusOff`.

*   **Coefficients ($\beta$):** Statistical output showing the significance of the `Prior` and `Neural_Activity` terms.
*   **Neurometric Plots:** A visual comparison of $P(Right)$ curves across different trial blocks.
*   **PSTHs:** Averaged firing rates for high-prior vs. low-prior trials, aligned to `StimulusOff`.

## Procedure

1.  **Prior Manipulation:** Implement block-based stimulus probability where the probability of a "Right" vs "Left" choice shifts periodically.
2.  **Trial Selection:** Select neurons in the SC intermediate layers that demonstrate significant buildup activity during the pre-saccadic delay period.
3.  **Window Definition:** Isolate firing rates within a fixed post-stimulus, pre-saccadic window.
4.  **Logistic Regression Modeling:** Fit $P(Right\_Choice) = \beta_0 + \beta_1(Contrast) + \beta_2(Prior) + \beta_3(Neural\_Activity)$ to evaluate the contribution of neural activity to choice.

### Code Architecture
The implementation uses an object-oriented `LLTaskPlugin` architecture to control experimental timing. State transitions, monitored via `LLStateSystem`, provide the precise temporal anchors needed for neural epoching. Data is exported as "Format 6" binary logs for offline analysis.

### Key Functions and Modules
*   **`LLStateSystem`**: Manages the Finite State Machine (FSM), triggering transitions between trial states (e.g., `StimulusOff`).
*   **`LLDataDoc`**: Encapsulates trial metadata (Signed Contrast, Prior Condition) for downstream statistical processing.
*   **`LablibITC18`**: Provides thread-safe data locking (`dataLock`) to align hardware spike events with trial-time anchors.
*   **`LLTaskPlugin`**: The base class for defining custom block-based behavioral trials.

1.  **Initialize Task Plugin:** Modify the task to implement a block-switching mechanism (e.g., `setPrior`) to control stimulus probability.
2.  **Epoching:** Define the analysis window (e.g., 200–500ms post-`StimulusOff`).
3.  **Synchronization:** Merge spike timestamps with `LLStateSystem` event markers using a common clock.
4.  **Regression:** Perform a logistic regression using the firing rate ($FR$), contrast, and prior condition as predictors.
5.  **Neurometric Fitting:** Compute the PSE for "Low-prior" and "High-prior" trials to compare with the neural modulation shift.

## Expected results

Expected results show whether SC neural trajectories diverge by prior block. A significant prior or neural-activity term indicates that neural activity mirrors the behavioral PSE shift and combines sensory evidence with prior belief.

*   The interaction term $\beta(Prior \times Contrast)$ must reach $p < 0.05$.
*   The PSE shift must occur in the same direction as the behavioral choice bias.

## Pitfalls

*   **Temporal Precision:** Ensure that TTL pulses are latency-corrected if the recording system has internal buffering delays.
*   **Neuron Selection:** Analysis must strictly isolate M-neurons; visual-only SC neurons may introduce noise into the motor-preparatory epoch.
*   **Data Integrity:** Always verify the synchronization of `dataLock` events to avoid "dropping" trials where the FSM state transitioned during a disk-write operation.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Process binary logs to extract trial-specific firing rates
matlab -batch "ExportTrialData('log_file_001.dat', 'output.mat')"

# Run the regression analysis in Python
python3 analyze_biases.py --input output.mat --model logistic
```
