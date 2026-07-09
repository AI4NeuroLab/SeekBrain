# Reproduction Plan for For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco

To reproduce the analysis for the example animal `2022-04-12-04` as specified, follow this technical pipeline.

### 1. Prerequisites
*   **Environment:** Python 3.8+, `numpy`, `scipy`, `scikit-learn`, `matplotlib`, `seaborn`.
*   **Data Files:** 
    *   `data/2022-04-12-04/neural_traces.mat` (contains $T \times N$ matrix of $\Delta F/F$).
    *   `results/2022-04-12-04/cepnem_model.mat` (contains model parameters, specifically the weight matrix $W$ for behavioral components).
*   **Knowledge:** Understand that the CePNEM $W$ matrix is a $[N \times K]$ array, where $K=3$ (Forward, Dorsal, Feeding).

---

### 2. Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Z-score data** | Methods: "Preprocessing" | `scipy.stats.zscore` | Raw $T \times N$ traces | $Z$ ($T \times N$) | Mean=0, Std=1 per column |
| **2** | **Run PCA** | Methods: "Pop. Dynamics" | `sklearn.decomposition.PCA` | $Z$ matrix | `pca.components_.T` | Explained variance ratio |
| **3** | **Hierarchical Clustering** | Methods: "Visualization" | `scipy.cluster.hierarchy` | `loadings[:, :5]` | Linkage matrix / Order | Dendrogram shape consistency |
| **4** | **Load CePNEM Weights** | Methods: "CePNEM Model" | `scipy.io.loadmat` | `model.mat` | $W$ ($N \times 3$ matrix) | Match $N$ with traces |
| **5** | **Permute Data** | Methods: "Order neurons" | `numpy.take` | $W$, `loadings` | Sorted $W$, Sorted $V$ | Array dimensions match |
| **6** | **Plotting** | Methods: "Fig. 1/2/3" | `matplotlib.pyplot` | Sorted matrices | Heatmap + Bar chart | Alignment check |

---

### 3. Detailed Implementation Strategy

**Step 1 & 2: PCA Processing**
```python
# Z-score and PCA
z_neural = zscore(neural_data, axis=0)
pca = PCA(n_components=5)
pca.fit(z_neural)
loadings = pca.components_.T # Shape (N, 5)
```

**Step 3: Clustering**
```python
from scipy.cluster.hierarchy import linkage, leaves_list
# Using Ward's method as it is standard in C. elegans neural dynamics papers
linkage_matrix = linkage(loadings, method='ward', metric='euclidean')
neuron_order = leaves_list(linkage_matrix)
```

**Step 4 & 5: Fetch CePNEM and Sort**
```python
# Assuming 'W' is the weight matrix extracted from CePNEM output
# Rows correspond to neurons, columns to (Forward, Dorsal, Feeding)
sorted_W = W[neuron_order, :]
sorted_loadings = loadings[neuron_order, :]
```

**Step 6: Visualization**
Create a side-by-side visualization:
*   **Left Panel:** Heatmap of `sorted_loadings` (PC1-PC5).
*   **Right Panel:** Stacked or grouped bar chart of `sorted_W` (Forwardness, Dorsalness, Feedingness).
*   *Requirement:* Both plots must share the same y-axis (neuron order indices).

---

### 4. Expected Output
*   **Visualization:** A figure where the y-axis represents ordered neurons. The PC loading columns show functional blocks of co-fluctuating neurons.
*   **Correlation:** You should observe that neurons grouped by PC loading similarity also display similar CePNEM weight signs (e.g., a cluster of neurons with high positive loading on PC1 often shows high weight for "Forwardness").

---

### 5. Troubleshooting
*   **"Visualization looks noisy":** Ensure you are using `zscore(data, axis=0)`. If you z-score across time (`axis=1`), you will remove the absolute fluorescence intensity which carries temporal information.
*   **"Ordering doesn't match paper":** Verify the `method` in `linkage()`. Papers in this domain occasionally use `method='average'` or `method='centroid'`. Check the specific `linkage` parameters in the `plotting.py` file of the repo.
*   **CePNEM Weights:** Ensure the `W` matrix is not normalized differently than the behavioral coefficients expected in the plots. If the bars in your plot look inverse to the paper, multiply `W` by `-1`.
*   **Missing Neurons:** If the number of neurons in `neural_traces.mat` does not match the rows in `cepnem_model.mat`, identify if there was a "bad neuron" mask applied during the original paper’s curation process. Check for a `mask` or `indices_kept` variable in the data file.