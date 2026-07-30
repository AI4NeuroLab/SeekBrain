---
name: "ns_multi-zebrafish-ca_behavior-vonmises_shuffling-distribution_bar_plot"
description: "Compare empirical bump-to-scene von Mises concentration with circular-shift controls and plot the observed and null distributions. Use to assess phase-locking stability during visual perturbations."
triggers:
- "Analyze statistical validation of neural bump phase-locking to visual scenes"
- "Generate statistical validation of neural bump phase-locking to visual scenes outputs"
- "Apply the ns_multi-zebrafish-ca_behavior-vonmises_shuffling-distribution_bar_plot recipe"
tags:
- "circular-statistics"
- "von-mises-distribution"
- "neural-field-theory"
- "phase-locking"
- "stochastic-modeling"
version: "1.0"
---

# Statistical Validation of Neural Bump Phase-Locking to Visual Scenes

This recipe describes the methodology for determining whether the neural activity "bump" in an animal's head-direction circuit maintains a constant offset relative to a visual stimulus. By analyzing the concentration parameter ($\kappa$) of the scene-bump offset, this approach identifies the stability of the neural representation under experimental perturbations such as scene jumps or background noise.

This workflow connects ring-attractor dynamics with empirical circular statistics. It focuses on validating that the neural circuit's observed behavior aligns with the stable regimes predicted by stochastic neural field simulations.

To quantify the stability of the neural bump phase relative to the scene by fitting circular distributions and comparing observed concentration parameters ($\kappa$) against a null distribution generated via bootstrapping (shuffling).

## When to use this

Use this recipe to plot observed bump-to-scene concentration values against a circular-shift null distribution for each condition or animal. Do not use it when phase and scene traces are not time aligned or when only the concentration estimate, without a null comparison, is needed.

## Scientific context

The neural bump, representing internal head orientation, must remain coupled to the visual environment to provide accurate navigation. During "Jump" (discontinuous shifts) and "Noise" (temporal jitter) epochs, the system's ability to maintain a constant phase offset determines the reliability of the internal representation.

## Preconditions

*   `numpy`: Array manipulation.
*   `scipy`: Specifically `scipy.stats.vonmises` for distribution fitting and `scipy.special` for Bessel functions.
*   `matplotlib`: Plotting $\kappa$ comparisons.

## Inputs and outputs

1.  `bump_phase_array`: A time-series of float values (radians) representing the bump center.
2.  `scene_orientation_array`: A time-series of float values (radians) representing the visual cue.
3.  `epoch_labels`: A boolean or categorical array identifying "Jump", "Noise", and "Constant" epochs.

*   **Data:** A summary table (CSV) containing `Fish_ID`, `Epoch`, `Observed_Kappa`, `Shuffle_Median`, `Shuffle_95th`.
*   **Plot:** A visualization comparing observed $\kappa$ against the shuffle threshold.

## Procedure

1. **Histographic Mapping:** Compute the distribution of the angular difference ($\Delta\phi = \phi_{bump} - \theta_{scene}$) across a time window.
2. **Von Mises Fitting:** Fit a von Mises distribution to the offset histogram to extract the concentration parameter $\kappa$.
3. **Statistical Shuffling:** Generate a null distribution by randomly permuting the bump phase series relative to the scene orientation 1,000 times to determine if $\kappa$ is significantly higher than chance.

This workflow uses importing experimental time-series data for both bump phase and scene orientation. Because forward simulation does not implement the empirical test, the "Analysis Pipeline" must be implemented externally using `scipy.stats` to perform circular fitting on the empirical data, using the repo's kernel logic as a theoretical basis for parameter verification.

1.  **Alignment:** Resample or interpolate `bump_phase` and `scene_orientation` to match sampling frequencies.
2.  **Offset Computation:** Compute $\Delta\phi = (\phi_{bump} - \theta_{scene}) \pmod{2\pi}$.
3.  **Fitting:** For each fish/epoch, run `scipy.stats.vonmises.fit(data, fscale=1)` to derive $\kappa$.
4.  **Shuffling:** Create a loop to perform circular shifts (lags > 5s) on the `bump_phase` data to generate 1,000 instances of the offset, fitting $\kappa$ for each.
5.  **Metric Calculation:** Compute the median and 95th percentile from the 1,000 shuffled $\kappa$ results.

## Expected results

A valid result shows that for stable experimental conditions, the observed $\kappa$ significantly exceeds the 95th percentile of the shuffled null distribution, indicating a non-random, stable phase-locking between the bump and the visual scene.

The stability hypothesis is confirmed if `Observed_Kappa > Shuffle_95th` for the experimental epochs.

## Pitfalls

*   **Circular Statistics:** Ensure that $\Delta\phi$ is correctly wrapped into the $[-\pi, \pi]$ interval before fitting; failure to do so will result in biased $\kappa$ values.
*   **Bimodal Distributions:** If the bump completely loses track of the scene, the distribution will become uniform or bimodal; the `vonmises.fit` function may fail to converge or return an inaccurate $\kappa$ in these cases.

## Bundled files

- `scripts/run_analysis.py` — executable implementation or helper module.
- `scripts/utils.py` — executable implementation or helper module.
- `references/implementation_notes.md` — implementation requirements and validation checks.
- `references/scientific_context.md` — scientific rationale and interpretation.

## Usage

```bash
python scripts/run_analysis.py
```
