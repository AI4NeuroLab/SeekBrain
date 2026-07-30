# Scientific context

## Methodological requirements

*   **Neurometric Shift Calculation:** The method used to define "post-stimulus neurometric shift." This usually involves calculating the difference in stimulus discriminability or population vector shift relative to the pre-stimulus baseline.
*   **Normalization/Correction:** Documentation on how "corrected" values were derived (likely subtracting spontaneous baseline activity or normalizing by max response per region).
*   **Spearman Correlation:** Statistical test used to assess monotonicity between the two measurement modalities (WFI ΔF/F or d’ vs. Ephys firing rate Δ or d’).
*   **Regression Fitting:** Implementation of the linear model (e.g., `scipy.stats.linregress` or `statsmodels`) with bootstrapping for confidence intervals.

## Required data

*   **Region List:** A list of the 32 mapped cortical regions (CCF-defined) present in both the `ophys_experiments` (widefield) and `ephys_experiments` datasets.
*   **Metric 1 (Ephys):** Post-stimulus neurometric shift values (Ephys).
*   **Metric 2 (WFI):** Post-stimulus neurometric shift values (WFI).
*   **Metadata:** Mapping table to align electrophysiological probe locations to the corresponding WFI cortical ROI indices.

## Validation criteria

To ensure your computational reproduction matches the study’s findings:
1.  **Region Subset Consistency:** Verify that only the exact 32 regions used in the study are included (ensure no exclusion criteria are violated).
2.  **Correlation Type:** Must use **Spearman’s rank correlation** (non-parametric) as specified, not Pearson.
3.  **Visual Elements:** The plot must contain the regression line, the 95% confidence interval (shaded region), and the annotated $ρ$ and $p$-value in the top-left or bottom-right corner.
4.  **Data Alignment:** Ensure the "corrected" shift values in your code match the scaling parameters described in the *Data Processing* methods section (e.g., ensuring WFI calcium transients are converted to a comparable metric to Ephys firing rate shifts).

***

**Note on Implementation:** If you are using the **Allen SDK**, you will need to access the `BrainObservatory` cache to pull the `ophys_experiments` and `ephys_experiments` dataframes, filter by the list of 32 shared cortical areas, and apply the neurometric shift function as defined in the study’s supplemental code bundled implementation.
