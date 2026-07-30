---
name: "ns_multi-zebrafish-ca_behavior_anatomy_gene-correlation_visual_response-neuronal_subtype_features"
description: "Integrate zebrafish calcium responses, swimming behavior, atlas coordinates, and molecular identity to characterize neuronal subtypes. Use for glyt2/gfra1a visuomotor response and anatomical mapping analyses."
triggers:
- "Analyze characterization of glyt2–gfra1a neuronal subtype dynamics and morphology"
- "Generate characterization of glyt2–gfra1a neuronal subtype dynamics and morphology outputs"
- "Apply the ns_multi-zebrafish-ca_behavior_anatomy_gene-correlation_visual_response-neuronal_subtype_features recipe"
tags:
- "zebrafish"
- "calcium-imaging"
- "neuroinformatics"
- "visuomotor"
- "spatial-transcriptomics"
version: "1.0"
---

# Characterization of glyt2–gfra1a Neuronal Subtype Dynamics and Morphology

This recipe provides a framework for integrating high-resolution anatomical data with functional calcium imaging and behavioral kinematics to characterize the *glyt2–gfra1a* neuronal subtype in zebrafish. By bridging morphological registration tools (using the `natverse` ecosystem) with custom functional analysis routines, this recipe enables the localization of molecularly defined clusters within a standardized brain atlas.

The approach utilizes existing morphological registration scripts to establish spatial coordinates and extends them with temporal alignment pipelines. This allows researchers to correlate trial-averaged calcium dynamics with swimming behavior across multiple validated specimens, providing a holistic view of the cluster's role in visuomotor integration.

To quantify the anatomical, functional, and behavioral profile of the *glyt2–gfra1a* molecular subtype by generating a multi-panel visual report containing 3D brain maps, calcium signal dynamics, and comparative statistical violin plots.

## When to use this

Use this recipe to compare visual responses, swimming correlations, morphology, and atlas localization across molecularly defined neuronal groups. Do not pool measurements until neuron identifiers and biological replicates are aligned across modalities.

## Scientific context

The *glyt2–gfra1a* neuronal population is a distinct molecular subtype implicated in visuomotor transformation. Characterization requires verifying spatial localization within the hindbrain/pretectum, mapping the temporal response to forward-motion visual stimuli, and measuring the correlation between calcium activity and swimming bouts.

## Preconditions

*   **R Packages:** `natverse` (spatial registration), `rgl` (3D rendering), `tidyverse` (data wrangling), `ggplot2` (visualization).
*   **Standard Python Libraries:** `pandas`, `numpy`, `scipy` (if processing functional data outside the R environment).

## Inputs and outputs

1.  **3D Coordinates:** `.swc` files for neurons from three individual fish.
2.  **Calcium Metadata:** `Ca_traces.csv` containing ΔF/F normalized time-series data.
3.  **Kinematic Logs:** `Behavior_Logs.csv` with stimulus timestamps and swim bout intervals.
4.  **Atlas Mesh:** `.surf` or equivalent atlas mesh files for reference space visualization.

*   **3D Brain Map:** A rendered figure (PNG/PDF) showing the *glyt2–gfra1a* cluster in context.
*   **PSTH Figures:** A line plot showing mean calcium trace dynamics (±SEM) aligned to stimulus onset.
*   **Violin Plots:** Comparative summary of max response and swimming correlation across groups.

## Procedure

1. **Spatial Registration:** Transformation of individual neuron coordinates to the Z-Brain atlas using affine and deformable registration.
2. **Calcium Signal Processing:** ΔF/F normalization and baseline correction of fluorescence signals.
3. **Stimulus Alignment:** Peri-stimulus time histogram (PSTH) generation using a fixed window around visual stimulus onset.
4. **Behavioral Correlation:** Cross-correlation calculation between deconvolved calcium activity and kinematic swimming bout output.

*   **Step 1:** Use `prey_capture_neurons.R` to load and register the 3D coordinates for neurons from three validated fish into the standard atlas space.
*   **Step 2 (Assumed):** Supplement the morphological script with a new module in R or Python to process CSV-based time-series data (ΔF/F traces and kinematics).
*   **Step 3:** Perform stimulus-triggered averaging of calcium data and calculate correlation coefficients between neural activity and swimming bout timestamps.
*   **Step 4:** Visualize results using `rgl` for 3D mapping and `ggplot2` for violin plots comparing experimental groups.

1.  **Atlas Registration:** Run `read.hxsurf` and `xform_brain` to align fish coordinates to the common reference space.
2.  **Subtype Clustering:** Apply `nblast_allbyall` followed by `nhclust` to isolate the *glyt2–gfra1a* cluster within the registered space.
3.  **Functional Alignment:** Calculate the mean ΔF/F trace per neuron within a 5-second window around stimulus onset.
4.  **Statistical Aggregation:** Calculate Pearson correlation coefficients for neural-to-locomotor output and compile results into a data frame grouped by animal ID.
5.  **Visualization:** Generate the 3D plot via `plot3d` and generate the comparative violin plots via `ggplot2::geom_violin`.

## Expected results

*   Identification of distinct neuronal clusters localized in defined hindbrain/pretectum regions.
*   Trial-averaged calcium traces showing characteristic response magnitudes aligned to stimulus onset.
*   Statistically significant differences in swimming correlation and response amplitude between the target subtype and control populations.

*   Verify anatomical markers in the 3D plot align with known hindbrain/pretectal boundaries.
*   Ensure ΔF/F normalization is consistent across the three fish samples.
*   Confirm statistical significance (p < 0.05) in violin plots distinguishing the molecular subtype from controls.

## Pitfalls

*   the referenced implementation currently focuses on morphology; functional correlation modules require external implementation (as detailed in the conceptual plan).
*   Ensure coordinate registration is calibrated to the specific zebrafish developmental stage (e.g., 5-7 dpf) to maintain anatomical accuracy.

## Bundled files

- `scripts/run_analysis.py` — executable implementation or helper module.
- `scripts/utils.py` — executable implementation or helper module.
- `references/implementation_notes.md` — implementation requirements and validation checks.
- `references/scientific_context.md` — scientific rationale and interpretation.

## Usage

```bash
python scripts/run_analysis.py
```
