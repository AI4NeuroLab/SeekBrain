# Paper Context for I_aim_to_depict_the_spatial_distribution_of_individual_neuro

Based on the requirements provided, here is the technical breakdown for depicting the spatial distribution of individual neurons across zebrafish larvae.

### 1. Relevant Paper Sections
*   **Methods: Spatial Atlas Registration:** Details on the registration of individual fish brains into the common Z-Brain atlas.
*   **Methods: Neuron Categorization:** Criteria for classifying neurons as motor-correlated, motor-anticorrelated, light-responsive, or dark-responsive.
*   **Methods: Statistical Mapping/Spatial Density Analysis:** The section defining the Gaussian kernel density estimation (KDE) and the permutation testing (or null model construction) used to establish the $P < 0.025$ spatial threshold.

### 2. Relevant Figures/Tables
*   **Main Atlas Figure:** Displays the global distribution of functional neuron clusters (e.g., motor vs. sensory).
*   **Supplementary Figures (Spatial Distribution):** Panels demonstrating the "thresholded" maps vs. raw density maps of specific functional classes.
*   **Workflow Diagram:** The schematic showing the transformation pipeline from individual *z-stacks* to atlas-registered coordinates ($X, Y, Z$).

### 3. Required Methods from Paper
*   **Atlas Registration:** Rigid and non-rigid transformation (e.g., using `ANTs` or `Elastix`) to map individual brain coordinates to the Z-Brain reference atlas.
*   **KDE (Kernel Density Estimation):** A 3D Gaussian kernel is required to smooth the point cloud of individual neuron coordinates for each functional category.
*   **Spatial Statistical Thresholding:**
    *   **Null Model Generation:** Random shuffling of neuron positions within the brain boundary to generate a distribution of spatial densities.
    *   **Thresholding:** Applying a $P < 0.025$ cutoff based on the null model to discard "stray" or outlier neurons that do not represent a consistent spatial cluster across the cohort of larvae.

### 4. Data Requirements
*   **Atlas Directory:** `atlas/` (containing the reference brain image and mask defining the brain boundary).
*   **Individual Fish Folders:**
    *   `correlated_motor.npy` (Motor-correlated neurons)
    *   `anticorrelated_motor.npy` (Motor-anticorrelated neurons)
    *   `correlated_dark.npy` (Dark-responsive neurons)
    *   `correlated_light.npy` (Light-responsive neurons)
*   **Coordinate Files:** These files must contain the transformed $X, Y, Z$ centroids for every identified neuron in that category.

### 5. Key Paper Excerpts
*   *"To compare distributions across animals, we registered all fish brains to the standard Z-Brain atlas using [Transformation Method]."*
*   *"Neurons were categorized based on their correlation coefficients to [motor/light/dark] stimuli."*
*   *"To exclude isolated, non-reproducible cells, we computed the spatial density of each functional type using a 3D Gaussian kernel and applied a threshold of $P < 0.025$ determined by a Monte Carlo permutation test."*

### 6. Evaluation Criteria
*   **Consistency:** Are the thresholds applied identically across all larvae to ensure the resulting atlas map is representative of the population?
*   **Boundary Constraints:** Are neurons falling outside the anatomical brain mask (determined by the atlas file) excluded during processing?
*   **Handling Missing Files:** Does the logic correctly skip the motor-correlation processing for fish folders lacking those specific `.npy` files while maintaining the processing for light/dark categories?
*   **Spatial Significance:** Does the $P < 0.025$ threshold successfully suppress background noise while preserving the dense clusters of functional activity?