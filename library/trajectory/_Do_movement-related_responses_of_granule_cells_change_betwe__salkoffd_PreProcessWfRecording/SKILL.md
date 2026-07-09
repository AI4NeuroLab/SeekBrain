---
name: "Cerebellar Granule Cell Movement Modulation Analysis"
description: "Analyzes and compares movement-related neural responses of cerebellar granule cells between active task and passive viewing conditions using calcium imaging and motion energy data."
triggers:
  - "Do granule cell responses change between task and passive conditions?"
  - "Analyze movement-related activity in cerebellar granule cells"
  - "Compare neural gain in active versus passive behavior"
  - "Calculate modulation index for granule cell firing relative to movement"
  - "Process motion energy and neural activity heatmap for task engagement"
tags:
  - "neuroscience"
  - "cerebellum"
  - "calcium-imaging"
  - "neural-modulation"
  - "sensorimotor-integration"
  - "data-analysis"
version: "1.0"
---

# Skill: Granule Cell Movement-Related Modulation Analysis

## Overview
This skill focuses on characterizing the plasticity of granule cell (GC) responses to movement by comparing neural activity between active task engagement and passive viewing conditions. By aligning neural calcium transients or electrophysiological spikes with video-derived motion energy, this analysis determines if task engagement induces a gain shift in the cerebellar granule cell layer.

The analysis framework utilizes a comparative approach: calculating the movement-triggered average activity for identical behavioral epochs across two distinct mental states. This distinguishes between purely sensory-motor movement responses and top-down modulations driven by task-specific demands.

## Objective
To quantify whether the amplitude, latency, or gain of movement-related granule cell responses significantly differs between active task performance and passive movement states.

## Background (from Paper)
### Scientific Context
Cerebellar granule cells receive mossy fiber inputs conveying diverse sensory and motor information. In the context of the cerebellar-dependent task described, it is hypothesized that the neural response to physical movement is gated or amplified when the animal is engaged in a behavioral task compared to when it moves spontaneously without task requirements.

### Methods Description
1. **Behavioral Tracking:** Calculate Motion Energy (ME) by calculating pixel-wise absolute intensity differences across sequential video frames.
2. **Event Alignment:** Use TTL/Behavioral log timestamps to extract trials and categorize them as "Active Task" or "Passive Viewing."
3. **Normalization:** Z-score GC activity traces within a pre-stimulus baseline window (e.g., -500ms to 0ms) to ensure inter-session comparability.
4. **Statistical Comparison:** Apply a paired Wilcoxon signed-rank test on peak response magnitudes between task and passive conditions to determine significant modulation.

### Expected Results
The paper reports a significant modulation of movement-evoked response magnitude in the task-engaged state. Specifically, the relationship (slope) between motion energy and GC population activity is expected to be steeper or higher-amplitude in the task condition compared to passive viewing.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context.

### Conceptual Implementation Plan
The analysis assumes the availability of raw video recordings, GC imaging traces, and trial metadata. Implementation should follow these assumptions:
* **Assumption 1:** Motion energy can be successfully computed from provided video files.
* **Assumption 2:** GC activity data exists in a standardized time-series format (e.g., `.npy`, `.h5`, or `.mat`).
* **Assumption 3:** Metadata contains explicit binary flags for "Task" vs "Passive" status.

### Dependencies
* `numpy`, `scipy`, `pandas` (Data manipulation and statistical testing)
* `cv2` (Optical flow/frame differencing)
* `matplotlib` or `seaborn` (Visualization)

## Structured Prompt
### Input Specification
1. **Behavioral Video:** Raw `.avi` or `.mp4` video files.
2. **GC Traces:** Matrix or HDF5 file containing normalized fluorescence or spike rates.
3. **Trial Metadata:** CSV file or log containing `timestamp`, `trial_type` (Task/Passive), and `stimulus_onset`.

### Processing Steps
1. **Compute ME:** Compute pixel-wise absolute difference between frame $t$ and $t-1$. Apply a Gaussian kernel for smoothing.
2. **Epoch Extraction:** Slice GC activity matrices into trials using `stimulus_onset` as $t=0$.
3. **Modulation Index Calculation:** For each GC, compute $MI = (R_{task} - R_{passive}) / (R_{task} + R_{passive})$, where $R$ is the peak response.
4. **Statistical Testing:** Use `scipy.stats.wilcoxon` to compare population-level MI distributions against a zero-median null hypothesis.

### Output Specification
* **PSTH Plots:** Overlaid line plots of GC activity for Task vs. Passive.
* **Heatmap Matrix:** Normalized GC activity sorted by response onset latency.
* **Statistical Summary:** A text report or JSON file containing mean response differences and $p$-values.

### Validation Criteria
* Baseline activity must show no significant difference between conditions (confirming the z-scoring normalization is effective).
* If Motion Energy distributions differ significantly between conditions, implement a "matching" algorithm to downsample trials until ME distributions are statistically indistinguishable.

## File Structure

```
_Do_movement-related_responses_of_granule_cells_change_betwe__salkoffd_PreProcessWfRecording/
    references/
        matched_files/
        connection_analysis.md
        paper_context.md
        paper_figure_methods.md
        paper_structured_summary.md
        question.md
        repo_context.md
        repo_file_summaries.md
        repo_overview.md
        reproduction_plan.md
    scripts/
        run_analysis.py
        utils.py
```

## Scripts Documentation
* `compute_motion_energy.py`: Extracts frame-by-frame movement intensity.
* `process_all_trials.py`: Handles trial alignment and data segmentation.
* `movement_modulation_analysis.py`: Main logic for calculating the modulation index and statistical significance.
* `plot_gc_activity_heatmaps.py`: Generates visualization panels.

## References Documentation
* `experiment_params.yaml`: Contains definition of epoch timestamps and frequency parameters.
* `trial_timestamps.csv`: Contains event markers for trial segmentation.

## Usage Example
```bash
python movement_modulation_analysis.py --data_path ./data/imaging/ --meta_path ./data/metadata/ --output_dir ./results/
```

## Notes & Caveats
* **Behavioral Confound:** If Motion Energy is higher in the task, the "modulation" may be a byproduct of movement vigor. Always correlate GC response amplitude with ME for both conditions.
* **Baseline Carry-over:** Ensure the baseline period is far enough from previous trials to avoid signal contamination.
* **Cell Type Filtering:** If non-granule cell types are present in the dataset, ensure they are masked or filtered out, as they may exhibit different task-state dependencies.