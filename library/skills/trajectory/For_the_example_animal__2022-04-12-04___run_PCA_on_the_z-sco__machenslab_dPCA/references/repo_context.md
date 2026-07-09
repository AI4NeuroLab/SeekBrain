# Repository Context for For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco

Based on the provided analysis, here is the identification of files and logic required to address the research question for animal `2022-04-12-04`.

### 1. Relevant Files (RANKED by relevance)
*   **`python/dPCA/dPCA.py`** (PRIORITY: **HIGH**): Although designed for dPCA, this file contains the `sklearn`-compliant class structure and the logic for `fit()` operations. To perform standard PCA, you would utilize the underlying SVD/eigen-decomposition logic or interface with `sklearn.decomposition.PCA` (which this repository depends on).
*   **`python/dPCA_demo.ipynb`** (PRIORITY: **HIGH**): Contains the template for data ingestion, model fitting, and plotting. It serves as the primary structural reference for how to align neural data with labels for plotting.
*   **`python/dPCA/utils.py`** (PRIORITY: **MEDIUM**): Contains the necessary helper functions for denoising and shuffling. This is crucial for verifying the significance of neural clusters derived from the loadings.
*   **`python/requirements.txt`** (PRIORITY: **LOW**): Ensures the environment has the necessary `scikit-learn` and `numpy` versions to run standard PCA and hierarchical clustering.

### 2. Code Execution Order
1.  **Data Ingestion**: Load the neural matrix $Y$ for animal `2022-04-12-04`.
2.  **Preprocessing**: Standardize the matrix $Y$ to $Z$ ($Z = \frac{Y - \mu}{\sigma}$).
3.  **Dimensionality Reduction (PCA)**: Use `sklearn.decomposition.PCA` (referenced as a dependency in `python/setup.py`) to extract the loading matrix $L$ ($N \times K$).
4.  **Hierarchical Clustering**: Perform `scipy.cluster.hierarchy.linkage` on the top 5 columns of $L$.
5.  **CePNEM Mapping**: Load the behavioral tuning coefficients (pre-calculated CePNEM model outputs) for the specific session `2022-04-12-04`.
6.  **Integration**: Reorder rows of $L$ and the CePNEM coefficients based on the linkage results.
7.  **Visualization**: Use `matplotlib` (as seen in `python/dPCA_demo.ipynb`) to plot the heatmaps of loadings and CePNEM tuning side-by-side.

### 3. Key Code Patterns
*   **Z-Scoring**: `(Y - Y.mean(axis=0)) / Y.std(axis=0)`.
*   **Clustering Input**: `Z_loadings = PCA(n_components=5).fit_transform(Z).components_.T` (or similar extraction of the loading vector).
*   **Clustering Logic**: `scipy.cluster.hierarchy.linkage(Z_loadings, method='ward')`.
*   **CePNEM Alignment**: The model outputs must be indexed using the same neuron IDs used in the PCA step to ensure that the heatmap rows align correctly.

### 4. Data Files Referenced
*   **Neural Activity Matrix**: Specific to `2022-04-12-04` (e.g., `neural_data_2022-04-12-04.npy` or equivalent).
*   **CePNEM Model Outputs**: A file (likely `.mat` or `.pkl`) containing the behavioral weights for forwardness, dorsalness, and feedingness per neuron for that specific animal.
*   **Metadata**: Behavioral log/timing file for the recording.

### 5. Missing Pieces
*   **CePNEM Loader**: The provided repository is focused on `dPCA` and does not contain the specific scripts to read the CePNEM model outputs. You will need to locate the external repository or file path where the CePNEM model results are stored.
*   **Specific Visualization Script**: The current demo notebook shows how to visualize latent components, but a custom plotting function is required to create the side-by-side heatmaps of behavioral tuning and loading values.
*   **Provenance Verification**: The prompt requires using pre-calculated CePNEM values; the code provided does not contain the specific logic to distinguish between simple correlations and the CePNEM state-regression coefficients.