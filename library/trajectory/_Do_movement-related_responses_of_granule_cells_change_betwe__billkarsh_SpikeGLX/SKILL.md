---
name: "Cerebellar Granule Cell Movement Modulation Analysis"
description: "Analyzes the shift in movement-related granule cell activity between baseline and task periods, comparing active task performance against passive stimulus conditions."
triggers:
  - "Do granule cell movement responses change between task and passive conditions?"
  - "How does task stimulus impact granule cell activity modulation?"
  - "Compare movement-excited granule cell activity during baseline and task periods"
  - "Analyze state-dependent modulation of granule cells in the cerebellar cortex"
  - "How do movement-related responses of granule cells compare between active and passive trials?"
tags:
  - "Cerebellar Cortex"
  - "Granule Cells"
  - "Sensorimotor Integration"
  - "Calcium Imaging"
  - "State-dependent Modulation"
  - "Neuroscience"
version: "1.0"
---

# Skill: Analysis of Context-Dependent Modulation in Granule Cell Movement Responses

## Overview
This skill facilitates the investigation of cerebellar granule cell (GC) sensorimotor integration by evaluating how neuronal responses to movement change between active task performance and passive stimulus presentation. By utilizing precisely timed synchronization signals (TTL pulses) from the SpikeGLX acquisition system as a temporal anchor, this analysis framework integrates neural imaging data with behavioral motion energy metrics.

The objective is to quantify whether GCs exhibit gain control or state-dependent modulation. By comparing Peri-Event Time Histograms (PETHs) and activity heatmaps across trial conditions, researchers can distinguish between movement-excited activity intrinsic to the task versus spontaneous activity occurring during passive stimulus delivery.

## Objective
To quantify the modulation index and gain change of movement-excited granule cell activity by contrasting behavioral "Task" and "Passive" conditions using synchronized high-resolution neural and behavioral time series.

## Background (from Paper)
### Scientific Context
Granule cells act as the primary input layer of the cerebellar cortex, integrating sensory stimuli with motor intent. Research indicates that GC responses to peripheral stimuli are not static but are modulated by behavioral state (e.g., active task vs. stationary/passive states) through gain-control mechanisms.

### Methods Description
1.  **Synchronization:** Trigger stimulus delivery and imaging acquisition via a unified clock (NI-DAQ/SpikeGLX).
2.  **Preprocessing:** Perform motion correction on two-photon data and extract $\Delta F/F$ traces for individual GCs.
3.  **Behavioral Tracking:** Calculate motion energy via optical flow or pixel-wise subtraction of high-frame-rate video.
4.  **Condition Labeling:** Segment trials into "Task" (active behavioral contingency) and "Passive" (stimulus-only) epochs based on TTL timestamps.
5.  **Statistical Modeling:** Utilize a Generalized Linear Model (GLM) incorporating movement, stimulus, and interaction terms to determine the weight of each component on GC activity.

### Expected Results
Movement-excited GCs are expected to display significantly higher amplitude responses during "Task" trials compared to "Passive" trials. Heatmaps aligned to movement onset should reveal robust, persistent activation in the Task condition, with attenuated or jittered responses during Passive stimulus presentation.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The provided repository is an electrophysiological data acquisition suite (SpikeGLX) and contains no downstream analysis scripts for calcium imaging or motion energy processing.

### Conceptual Implementation Plan
The plan relies on external analysis pipelines (e.g., Suite2p, custom Python/MATLAB scripts) using the SpikeGLX-generated metadata as the "Source of Truth" for temporal alignment.
1.  **Sync:** Parse SpikeGLX `.meta` files to extract TTL timestamps for stimuli and movement indicators.
2.  **Extraction:** Extract ROI-based fluorescence traces.
3.  **Normalization:** Use the baseline period defined in the paper to calculate $\Delta F/F$.
4.  **Regression:** Execute a GLM regression using the extracted movement indices and stimulus labels.
5.  **Comparison:** Perform a t-test on the gain coefficients ($\beta_{movement}$) between Task and Passive conditions.

### Dependencies
*   Python 3.x (NumPy, Pandas, SciPy, Scikit-learn)
*   Imaging analysis software (e.g., Suite2p or CaImAn)
*   SpikeGLX metadata parser (e.g., `spikeglx.py` utilities)

## Structured Prompt
### Input Specification
1.  **Binary Data:** Raw imaging Tiff/ScanImage files.
2.  **Sync Data:** `.meta` files from SpikeGLX containing `~snsMnMa` (TTL channel data).
3.  **Behavioral Video:** Raw .mp4 or .avi files recording subject movement.
4.  **Trial Metadata:** CSV/JSON categorizing trials as "Task" or "Passive".

### Processing Steps
1.  **Extract Timestamps:** Use SpikeGLX metadata to map TTL pulses to imaging frame indices.
2.  **Motion Computation:** Apply a pixel-wise difference algorithm (frame $i$ minus frame $i-1$) to behavioral video to generate a continuous Motion Energy (ME) time-series.
3.  **Trial Alignment:** Segment GC $\Delta F/F$ and ME traces based on trial timestamps.
4.  **Interaction Modeling:** Fit the model: $GC_{i}(t) = \beta_{0} + \beta_{1}(ME(t)) + \beta_{2}(Stim(t)) + \beta_{3}(ME(t) \cdot Stim(t)) + \epsilon$.
5.  **Compare Gains:** Compare the coefficient $\beta_{1}$ across "Task" and "Passive" groups using a Wilcoxon signed-rank test.

### Output Specification
1.  **PETH Plot:** Averaged $\Delta F/F$ traces $\pm$ SEM for both conditions.
2.  **Modulation Index:** Calculated as $(Activity_{task} - Activity_{passive}) / (Activity_{task} + Activity_{passive})$.
3.  **Heatmap:** Population activity heatmap aligned to movement onset.

### Validation Criteria
1.  **Timing Accuracy:** Verify `run.missed_samples` is zero in SpikeGLX metadata.
2.  **Statistical Power:** Ensure condition comparisons use trials matched for similar motion energy distributions to prevent confounding effects of movement frequency.

## File Structure

```
_Do_movement-related_responses_of_granule_cells_change_betwe__billkarsh_SpikeGLX/
    references/
        matched_files/
            Agenda.txt
            LICENSE.txt
            Markdown_Audio_Help.md
            Markdown_BIST_Help.md
            Markdown_CalSRate_Help.md
            Markdown_ColorTTL_Help.md
            Markdown_DevTab_Help.md
            Markdown_FileViewer_Help.md
            Markdown_Firmware_Help.md
            Markdown_Force_Help.md
            Markdown_GateTab_Help.md
            Markdown_Graphs_Help.md
            Markdown_HST_Help.md
            Markdown_IMRO_T0_Help.md
            Markdown_IMTab_Help.md
            Markdown_Metadata_Help.md
            Markdown_Metrics_Help.md
            Markdown_NIClock_Help.md
            Markdown_NITab_Help.md
            Markdown_OBXTab_Help.md
            Markdown_SaveTab_Help.md
            Markdown_ShankView_Help.md
            Markdown_SimProbes_Help.md
            Markdown_Slot_Help.md
            Markdown_SpikeGLX_Broken_Shank_Support.md
            Markdown_SpikeGLX_FAQ.md
            Markdown_SpikeGLX_OneBox_Quickstart.md
            Markdown_SpikeGLX_PXIe_Quickstart.md
            Markdown_SpikeGLX_Quadbase_Quickstart.md
            Markdown_SpikeView_Help.md
            Markdown_SyncTab_Help.md
            Markdown_SystemRequirements_PXI.md
            Markdown_SystemRequirements_Xilinx.md
            Markdown_TrigTab_Help.md
            Markdown_UserManual.md
            Markdown_WavePlan_Help.md
            Markdown_pandoc-commandline.txt
            Markdown_tutorial_toc.md
            NI_Readme.txt
            QLed-LGPLv2-LICENSE.txt
            README.md
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
*   `SpikeGLX_Sync_Extraction.py` (Conceptual): Extracts the trigger timestamps from the binary metadata provided by the hardware system to ensure the imaging data is correctly aligned.

## References Documentation
*   `Markdown/FileViewer_Help.md`: Provides context on how raw hardware signals are encoded, useful for verifying if a stimulus signal was correctly recorded.
*   `Agenda.txt`: Details the digital/analog output commands used to trigger experimental events, essential for defining the "Task" vs. "Passive" windows.

## Usage Example
```bash
python run_gc_modulation_analysis.py --data_path ./raw_data --metadata_path ./spikeGLX_meta --output ./results
```

## Notes & Caveats
*   **Hardware Sync:** Any frame loss reported in SpikeGLX metadata will propagate as a temporal jitter in the PETHs, potentially invalidating the comparison of transient neuronal responses.
*   **Imaging vs. Ephys:** This repo supports Neuropixels (electrophysiology). If your GC data is two-photon imaging, ensure your synchronization protocol involves a TTL "handshake" between the imaging controller and the SpikeGLX DAQ board.