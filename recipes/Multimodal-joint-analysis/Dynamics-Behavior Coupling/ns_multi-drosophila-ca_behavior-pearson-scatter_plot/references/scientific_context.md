# Scientific context

## Methodological requirements

*   **EPG Bump Width Estimation:** Calculate the width of the EPG activity bump by fitting a Gaussian or von Mises distribution to the EPG population vector in the 16-segment (or equivalent) torus.
*   **HD Encoding Accuracy:** 
    *   Calculate the offset $\Delta \theta = \phi_{EPG} - \theta_{head}$.
    *   Compute circular variance ($V$) of this offset.
    *   Define Accuracy $= 1 - V$.
*   **Data Filtering:** Subset the time series to include only "movement periods" (e.g., velocity $> \text{threshold}$).
*   **Statistical Test:** Pearson correlation coefficient calculated across the $N=15$ flies.

## Required data

*   **Fly Imaging Data:** Fluorescence traces from the E-PG neurons (calcium imaging or voltage imaging).
*   **Behavioral Data:** Simultaneous tracking of the fly’s head orientation (typically via tethered walking on an air-supported ball).
*   **Trial Metadata:** Identification of the "first dim-cue block" to ensure consistency across the 15 flies.
*   **Sample Size:** Minimum $N=15$ individual fly datasets.

## Validation criteria

*   **Data Filtering Accuracy:** Are movement periods correctly isolated using speed thresholds (e.g., $> 2\text{ mm/s}$)?
*   **Metric Consistency:** Is the circular variance calculated specifically on the offset between the EPG bump phase and the actual head direction?
*   **Statistical Rigor:** Is the Pearson correlation test appropriate for the distribution of these variables (or should a Spearman rank correlation be used if data is non-normal)?
*   **Visual Representation:** Does the scatter plot correctly visualize the inverse or direct relationship with a regression line and the $P$-value clearly annotated?
