---
name: ns_multi-zebrafish-ca_behavior-circular_correlation-tuning_curve
description: Performs circular correlation analysis and visualization to compare neural bump phase against scene orientation across pre-learning, learning, and post-training phases.
triggers:
  - plot bump phase versus scene orientation
  - calculate neural mapping slope for learning epoch
  - compare bump phase to scene orientation across experimental epochs
  - analyze neural representation shift during spatial learning
  - verify bump-scene mapping with mod 2pi transformation
tags:
  - neuroscience
  - spatial navigation
  - circular statistics
  - neural decoding
  - learning dynamics
version: '1.0'
---

# Analyzing Bump–Scene Mapping via Angular Phase Correlation

This recipe focuses on quantifying the relationship between neural representations (the "bump phase") and external environmental cues (the "scene orientation") during spatial learning. By comparing these variables across pre-learning, learning, and post-training epochs, one can identify dynamic shifts in the brain's internal map, specifically the transition from a 1:1 mapping to a 2:1 mapping.

The analysis involves decoding neural population activity to track an angular "bump," synchronizing this with frame-by-frame stimulus orientation ($\theta$), and applying circular statistical methods to assess the slope of their relationship. This process reveals how neural tuning adapts during active learning phases.

## When to use this

- Compare neural bump phase with scene orientation across pre-learning, learning, and post-training epochs.
- Estimate circular mapping slopes and test the predicted transition between 1:1 and 2:1 mappings.
- Do not use this workflow with unsynchronized angular traces or ordinary linear regression across wrap boundaries.

## Scientific context

The dorsal telencephalon (pallium) of the fish maintains a neural representation of the external world. During spatial learning, this representation undergoes a measurable transformation, where the internal "bump" of activity shifts its alignment with visual cues.

## Preconditions

* `numpy`: For array manipulation and modulo arithmetic.
* `scipy`: For circular statistics and signal processing.
* `matplotlib`: For visualization.
* `pandas`: For managing synchronized behavioral and neural time-series.

## Inputs and outputs

1. **Neural Imaging Files:** `.mat` or `.h5` files containing population calcium traces.
2. **Behavioral Logs:** Time-stamped files containing the visual scene orientation $\theta$.
3. **Epoch Metadata:** A lookup table defining the time indices for pre-learning, learning, and post-training.

*   Three side-by-side scatter plots (Pre, Learn, Post) saved as a single vector graphics image (e.g., `.svg` or `.pdf`).
*   A calculated slope coefficient for each epoch to verify the 1.0 vs 2.0 mapping.

## Procedure

1. **Bump Phase Estimation:** The angular position of the neural activity peak is computed using a circular mean or von Mises population vector fit.
2. **Epoch Segmentation:** Data is partitioned into three discrete temporal windows: pre-learning, learning, and post-training, based on experimental markers.
3. **Circular Mapping:** The bump phase is plotted against scene orientation ($\theta$), applying `mod 2π` transformations to analyze the slope of the coupling.
4. **Statistical Fitting:** Reference lines are calculated as $\text{bump phase} = \theta$ for stable states and $\text{bump phase} = 2\theta \pmod{2\pi}$ for the learning epoch.

1. **Load Data:** Extract neural time-series and synchronized behavioral stimulus logs ($\theta$) for the specific subject ID.
2. **Phase Calculation:** Implement a function to calculate the circular phase of neural activity (using `np.angle` or `scipy.stats.circmean`).
3. **Masking:** Create boolean masks to isolate data points into `pre`, `learning`, and `post` epochs.
4. **Visualization:** Use `matplotlib.pyplot.scatter` to plot the phase vs. $\theta$.
5. **Reference Overlays:** Overlay dashed lines using the slope logic: $f(\theta) = 1 \cdot \theta$ and $f(\theta) = 2 \cdot \theta \pmod{2\pi}$.

1. **Epoch Filtering:** Use epoch metadata to index neural and behavioral arrays.
2. **Bump Decoding:** Calculate the instantaneous bump phase ($\phi$) at each time point.
3. **Circular Transformation:** Apply the `mod 2π` operation to ensure $\phi$ and $\theta$ are consistent.
4. **Mapping Analysis:** For each epoch, generate a scatter plot of $\phi$ (y-axis) vs $\theta$ (x-axis).
5. **Reference Plotting:** Plot the expected slope (1 or 2) as a dashed black line over the scatter.

## Expected results

*   **Pre/Post-Training:** A linear relationship with a slope of 1, indicating stable representation of environmental orientation.
*   **Learning Epoch:** A transformed linear relationship with a slope of 2, indicating that the internal representation "doubles" relative to the scene orientation.

*   The `learning` plot must demonstrate a slope of ~2.0 when accounting for the `mod 2π` wrap-around.
*   The `pre` and `post` plots must show high density around the identity line (slope ≈ 1.0).

## Pitfalls

*   **Circular Discontinuities:** Be aware of the $0/2\pi$ wrap-around point; standard linear regression may produce misleading results if not treated with circular statistics.
*   **Windowing:** If the neural bump is unstable, verify that your temporal smoothing window for phase estimation is consistent with the method's reported methods.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
python plot_bump_scene_mapping.py --subject_id 01 --epoch_data metadata.csv --output_dir ./results/
```
