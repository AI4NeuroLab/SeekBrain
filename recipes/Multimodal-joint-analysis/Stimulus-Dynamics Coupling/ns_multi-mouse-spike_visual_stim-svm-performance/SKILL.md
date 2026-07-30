---
name: ns_multi-mouse-spike_visual_stim-svm-performance
description: Calculates and visualizes visual responsiveness fractions and population decoding accuracy across cortical regions using Allen Institute Ecephys data.
triggers:
  - How do I compare stimulus decoding accuracy between brain regions?
  - Calculate the fraction of visually responsive neurons per cortical area
  - Perform SVM decoding for visual stimulus identity in Neuropixels data
  - Visualize neural population effect sizes for Gabor patches and natural scenes
  - How to compute the visual responsiveness index using the AllenSDK?
tags:
  - electrophysiology
  - neural-decoding
  - visual-coding
  - AllenSDK
  - data-visualization
  - computational-neuroscience
version: '1.0'
---

# Visualization and Comparison of Effect Sizes for Visual Stimulus Decoding

This recipe focuses on characterizing how information about visual stimuli is distributed across the mouse visual cortex. It bridges the gap between raw neural activity in the Allen Institute Neuropixels dataset and high-level analytical metrics: specifically, the fraction of visually responsive neurons and population-level decoding accuracy.

By quantifying these metrics across cortical areas (e.g., VISp, VISl, VISam), researchers can evaluate how stimulus information is transformed along the visual hierarchy. The implementation relies on processing stimulus-aligned spike trains extracted from NWB files, applying statistical significance tests for responsiveness, and training linear decoders to quantify regional information capacity.

## When to use this

- Compare visual-stimulus decoding accuracy and responsive-unit fractions across cortical regions.
- Train cross-validated linear SVMs after equalizing unit counts and applying common quality filters.
- Do not use this workflow when stimulus labels or anatomical unit assignments are unavailable.

## Scientific context

The Allen Institute "Visual Coding - Neuropixels" dataset provides a massive-scale survey of neural activity. A primary objective is determining if higher-order visual areas (e.g., VISam) encode stimulus identity differently than primary visual cortex (VISp), using both responsive neuron fractions and population decoding as effect size proxies.

## Preconditions

* `allensdk`: Allen Institute SDK
* `scikit-learn`: For `LinearSVC` and `cross_val_score`
* `pandas` & `numpy`: Data aggregation
* `scipy.stats`: For statistical testing

## Inputs and outputs

1. A valid `EcephysSession` object (via NWB file).
2. `stimulus_name` (e.g., "natural_scenes" or "gabors").
3. List of target brain regions (e.g., `['VISp', 'VISl', 'VISam']`).

* A data table containing columns: `region`, `mean_accuracy`, `std_accuracy`, `responsive_fraction`.
* Multi-panel figure comparing ROI performance.

## Procedure

1. **Responsive Neuron Identification:** A neuron is classified as visually responsive if its firing rate during a stimulus window (e.g., 0–250ms) significantly exceeds its baseline firing rate (trial-shuffled control).
2. **Population Decoding:** A multi-class linear Support Vector Machine (SVM) is trained on binned spike counts across a population of units to predict discrete stimulus identities.
3. **Data Normalization:** Decoding performance is compared across regions by subsampling the number of units to a constant $N$ to account for differences in recording density.

1. **Data Loading:** Instantiate `EcephysSession` for specific sessions.
2. **Quality Control:** Filter units using `quality_metrics` (e.g., `isi_violations < 0.1`, `amplitude_cutoff < 0.1`).
3. **Responsiveness:** Iterate over units per `structure_acronym`, calculating significance via Wilcoxon test between baseline and stimulus bins.
4. **Decoding:** Flatten unit activity to an $(n\_trials, n\_units)$ matrix per region, subsample to equal unit counts, and fit `sklearn.svm.LinearSVC`.

1. **Filter Units:** Query `session.units` and retain only units with `isi_violations < 0.1`.
2. **Extract Activity:** Use `session.presentationwise_spike_counts` for the specific stimulus window.
3. **Statistical Masking:** Perform a Wilcoxon signed-rank test on stimulus vs. baseline trial counts per unit; create a binary mask of "responsive" units.
4. **Resampling:** For each region, find the minimum number of units $N_{min}$ across all regions, and randomly subsample $N_{min}$ units to ensure equal feature dimensionality.
5. **SVM Training:** Fit a `LinearSVC` using 5-fold cross-validation on the subsampled matrices.
6. **Visualization:** Plot bar charts of (1) % Responsive Units/Region and (2) Mean SVM Accuracy/Region.

## Expected results

Expected results include region-dependent decoding performance across cortical and thalamic areas. Use the responsive-neuron fraction as a complementary measure of visual sensitivity rather than as a substitute for decoding accuracy.

* Decoding accuracy must be compared against a null distribution (shuffled labels) to ensure values are above chance.
* All ROIs must be compared at the same subsampled unit count ($N$) to avoid correlation between neuron count and accuracy.

## Pitfalls

* **Normalization:** Failing to subsample to a common $N$ will bias your results toward regions with higher probe coverage (e.g., VISp).
* **SVM Parameters:** Ensure the `LinearSVC` uses a fixed `random_state` during cross-validation to maintain reproducibility.
* **Metadata:** The `allensdk` provides data access, but SVM logic must be implemented via standard `scikit-learn` workflows, as it is not an SDK native function.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Conceptual execution flow
python analyze_regional_decoding.py --session_id 123456789 --stimulus natural_scenes --rois VISp VISl VISam
```
