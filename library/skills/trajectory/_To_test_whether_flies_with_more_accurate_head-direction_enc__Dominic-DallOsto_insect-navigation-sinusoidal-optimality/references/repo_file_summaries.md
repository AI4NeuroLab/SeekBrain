# Repository File Summaries

## README.md

This document provides a structured analysis of the `README.md` file from the **Insect Navigation Sinusoidal Optimality** repository.

### 1. Purpose
This repository provides the computational codebase for the paper "Theoretical principles explain the structure of the insect head direction circuit." It demonstrates that sinusoidal activity profiles in circulant ring networks exhibit noise resilience and self-stabilizing properties, providing a theoretical framework for insect navigation circuits.

### 2. Key Functions/Classes
*Note: As this is a `README.md`, it points to Jupyter notebooks rather than source code modules. The logic is contained within the following notebooks:*
*   **`sinusoidal noise rejection...ipynb`**: Analyzes the noise resilience of Fourier mode-based encodings.
*   **`encoding with multiple harmonics...ipynb`**: Models multi-harmonic activity and its robustness to noise.
*   **`insect network graph analysis.ipynb`**: Analyzes the connectivity of 4-population networks.
*   **`fruit_fly_data_analysis.ipynb`**: Processes connectome data to derive network architectures.
*   **`sinusoidal updating activity and weights.ipynb`**: Simulates the development of network weights using Oja’s Rule.

### 3. Data Flow
*   **Input**: Connectome data (derived from Janelia Research Campus datasets).
*   **Processing**: Mathematical simulation of circulant ring networks, implementation of Oja’s rule for weight updates, and harmonic encoding analysis.
*   **Output**: Generation of figures (Figures 1–5, M1–M7, and S1–S5) and comparative analysis between theoretical abstract models and biological network connectivity.

### 4. Dependencies
*   **Biological Data**: Connectome data sourced from Janelia Research Campus.
*   **Reference Paper**: "Theoretical principles explain the structure of the insect head direction circuit" (Vilimelis Aceituno, et al., *eLife* 2024).
*   **Environment**: Likely requires a Python-based scientific stack (standard for Jupyter notebooks: `numpy`, `scipy`, `matplotlib`, `networkx`, and potentially `pandas`).

### 5. Analysis Methods
*   **Fourier Analysis**: Investigating encoding efficiency via harmonic modes.
*   **Network Topology Analysis**: Comparing abstract theoretical models against empirical connectome graph data.
*   **Hebbian Learning (Oja's Rule)**: Simulating the co-evolution of neuronal activity and synaptic weights.
*   **Stochastic Modeling**: Testing network robustness against noise to assess circuit optimality.

### 6. Figures/Outputs
The repository generates a suite of figures supporting the publication:
*   **Figure 1**: Multi-harmonic encoding visualization.
*   **Figure 2**: Noise resilience analysis.
*   **Figures 3-4**: Comparison of abstract network predictions vs. experimental data.
*   **Figure 5**: Simulation of Hebbian weight development.
*   **Supplementary Figures (M1-M7, S1-S5)**: Detailed connectivity and model validation results.

### 7. Key Parameters
While specific parameters are defined within the individual notebooks, the analysis focuses on:
*   **Fourier modes**: Number of modes used to represent activity.
*   **Weight update constants**: Parameters governing the learning rate for Oja's rule.
*   **Noise variance**: Levels applied to test the resilience of the circulant ring networks.
*   **Connectivity constraints**: Parameters derived from the fruit fly (Drosophila) connectome used to map the 4-population network.

---

## connectivity_matrices.py

### Analysis of `connectivity_matrices.py`

#### 1. Purpose
This module serves as a data interface and management layer for neural connectivity matrices of *Drosophila* (fruit fly) and locust, providing structured access to biological data and simplified network models for computational neurobiology simulations. It facilitates the conversion between raw matrix data, human-readable edge lists, and labeled neuron indexing.

#### 2. Key Functions/Classes
*   **`ConnectivityMatrix` (Class)**: Encapsulates metadata about neural networks (e.g., neuron counts for PEN, PEG, EPG, and D7 types), slices for indexing, and a loader function for the underlying matrix data.
*   **`get_connectivity_matrix_bool`**: Converts connectivity weights into a boolean map (connected vs. disconnected).
*   **`get_connectivity_matrix_string`**: Maps matrix indices to human-readable strings denoting the connectivity type (e.g., `connections_PEN_EPG`).
*   **`neuron_index_to_name`**: Translates a matrix index into a specific anatomical label (e.g., `PEN_L1`, `D7_2`).
*   **`get_connectivity_matrix_edge_list`**: Generates a graph-based representation of the network (list of edges with pre/post-synaptic names and weights).
*   **`create_..._simplified_connectivity_matrix`**: Script-level functions that programmatically define idealized circuit topologies and save them as `.npy` files.

#### 3. Data Flow
*   **Reads**: Loads binary data from `.mat` (MATLAB) and `.npy` (NumPy) files located in the `connectivity_matrices/` subdirectory.
*   **Processes**: Uses indexing logic and slicing to slice global matrices into specific neuron groups; calculates graph structures (edge lists).
*   **Writes**: Exports user-defined/simplified network models to `.npy` files via `numpy.save`.

#### 4. Dependencies
*   **Libraries**: `numpy`, `scipy.io` (for MATLAB file compatibility), `itertools`, `os`.
*   **Local Data**: Relies on specific files within the `connectivity_matrices/` folder (e.g., `connectivity_matrix_drosophila_janelia_grouped.npy`).

#### 5. Analysis Methods
*   **Network Graph Representation**: Translates adjacency matrices into labeled edge lists with typed synaptic weights (e.g., inhibitory weights assigned to `D7` type neurons, excitatory to others).
*   **Topological Simplification**: Manually encodes predefined biological hypotheses into connectivity matrices for model testing.

#### 6. Figures/Outputs
*   **Binary/Processed Data Files**: Saves reconstructed matrices (`.npy` files) for use in downstream simulations.
*   **Graph/Edge Objects**: Programmatic representations of the circuits used for network analysis or simulation input.

#### 7. Key Parameters
*   **Neuron Group Counts**: Defined during `ConnectivityMatrix` initialization (`NUM_PEN`, `NUM_PEG`, `NUM_EPG`, `NUM_D7`), which determine the architecture of the specific model being loaded.
*   **Matrix Order**: Note in source code: matrices are stored in `[from, to]` order and require transposition for certain plotting or analytical operations.

---

## encoding with multiple harmonics.ipynb

This analysis provides a structured summary of the `encoding with multiple harmonics.ipynb` file.

### 1. Purpose
This notebook investigates the theoretical feasibility of encoding spatial position by simultaneously using multiple harmonics of a circulant matrix representation. It specifically explores how aligning these harmonics allows for consistent waveform movement and evaluates the system's robustness against noise in neural activity.

### 2. Key Functions/Classes
*   `get_activity`: Computes the neural activity waveform as a summation of harmonics; supports scaling to align waveforms.
*   `xy_decoder`: Maps neural activity back to spatial coordinates ($x, y$) using a pseudo-inverse transformation.
*   `all_xy_decoder`: Extends decoding to handle multiple possible angular solutions for higher frequency harmonics.
*   `gaussian2d`: Generates a likelihood surface (Gaussian distribution) to estimate position from decoded variables.

### 3. Data Flow
*   **Input**: Defines $N$ neurons and harmonic frequencies ($f$). It simulates an "encoder" function that maps angular position $\theta$ into neural activity patterns.
*   **Processing**: Applies noise models (Gaussian and worst-case phase-aligned noise) to the activity patterns. It uses decoders to reconstruct $(x, y)$ coordinates.
*   **Output**: Generates comparison plots showing likelihood distributions and error rates under increasing noise levels.

### 4. Dependencies
*   `numpy`: Array manipulation and mathematical operations.
*   `scipy.linalg`: Matrix operations (specifically for the pseudo-inverse in the decoder).
*   `matplotlib`: Visualization of activity waveforms, likelihoods, and error plots.

### 5. Analysis Methods
*   **Harmonic Alignment**: Demonstrates how scaling the encoded angle for higher harmonics preserves waveform shape during rotation.
*   **Noise Robustness Analysis**: Compares decoding accuracy using single vs. multiple harmonics under varying noise standard deviations.
*   **Maximum Likelihood Estimation**: Multiplies likelihood surfaces from different harmonics to resolve ambiguities (e.g., $f=2$ produces two peaks) and pinpoint position.
*   **Geometric Modeling**: Uses polar transformations to interpret neural population activity in a 2D spatial context.

### 6. Figures/Outputs
*   **Waveform Comparison**: Plots showing aligned vs. unaligned harmonics across different angles ($\theta$).
*   **Likelihood Distributions**: Visualizations of how joint probabilities ($f=1$ and $f=2$) identify a single spatial point from noisy neural input.
*   **Error Performance Curves**: Plots mapping "Noise standard deviation" against "Decoded position error" for different harmonic combinations ($f=1, f=1+2, f=1+3$).
*   **Exported Files**: Saves results to `plots/` as `.pdf` files (e.g., `combined-harmonics-movement.pdf`, `combined-harmonics-error-snapping-example.pdf`).

### 7. Key Parameters
*   `N`: Total number of neurons (set to 8).
*   `fs`: List of frequency harmonics to include (e.g., `[1, 2]`).
*   `scaled`: Boolean; determines if higher harmonics are scaled to align with the fundamental frequency.
*   `noise`: Standard deviation of the noise injected into the neural activity to test model stability.
*   `sigma`: Spatial spread of the Gaussian likelihood decoder.

---

## fruit_fly_data_analysis.ipynb

### Structured Summary: `fruit_fly_data_analysis.ipynb`

#### 1. Purpose
This notebook processes raw connectomic data from the Janelia Hemibrain dataset to construct, aggregate, and visualize synaptic connectivity matrices for specific neuronal populations (PEN, PEG, EPG, and Delta7) within the *Drosophila* central complex.

#### 2. Key Functions/Classes
The notebook primarily uses functional programming via `pandas` and `numpy`:
* **Sorting/Grouping Logic**: Uses lambda functions applied to the `instance` column of the neuron dataframe to organize neurons by glomerulus (L1-R1) and handle hemispheric symmetry.
* **Matrix Construction**: Uses iterative loops over connection subsets to build adjacency matrices where values represent synaptic weight (count).
* **Visualization Routine**: Uses `matplotlib.pyplot.imshow` with custom annotation logic to delineate functional neuron groups on the matrix axes.

#### 3. Data Flow
* **Input**: 
    * `janelia-data/traced-neurons.csv`: Contains neuron metadata (names, IDs, types, instances).
    * `janelia-data/traced-total-connections.csv`: Contains synaptic connection lists (pre-synaptic ID, post-synaptic ID, weight).
* **Processing**: Filters raw connections to include only target neuron types, then aggregates them into three formats: full individual-neuron matrix, glomerulus-grouped matrix, and one-sided (hemisphere-collapsed) matrix.
* **Output**: Exports `.npy` files for the three matrices and `.pdf` files containing connectivity visualizations.

#### 4. Dependencies
* **Standard Python**: `pandas`, `numpy`, `matplotlib`.
* **External Datasets**: Janelia Hemibrain v1.2 (`traced-neurons.csv`, `traced-total-connections.csv`).
* **Environment**: `matplotlib` with LaTeX/Computer Modern fonts configured for publication-quality figures.

#### 5. Analysis Methods
* **Adjacency Matrix Construction**: Maps specific synaptic counts to indices corresponding to defined neuron populations.
* **Granular Aggregation**: Implements data grouping by anatomical features (glomeruli) and functional logic (combining PEN1/PEN2 or EPG/EPGt).
* **Hemispheric Folding**: Performs a structural collapse of left/right hemisphere neurons to produce a "one-sided" symmetry model, allowing for direct comparison with existing theoretical models (e.g., Pisokas et al., 2020).

#### 6. Figures/Outputs
* **Full Connectivity Matrix**: A high-resolution heatmap showing all individual neurons in the central complex circuit.
* **Grouped Glomeruli Matrix**: A reduced matrix showing connectivity between functional glomeruli.
* **One-sided Matrix**: A further reduced, symmetric 34-group matrix representing the central complex circuit.
* **Diagnostic Plots**: Bar charts showing the distribution/count of neurons assigned to each glomerulus group.

#### 7. Key Parameters
* **`np.random.seed(7)`**: Ensures reproducibility of plotted figures.
* **`ids_set`**: A lookup set for optimized filtering of connectivity data.
* **`type_borders`**: Computed dynamically via `np.cumsum` to correctly place visual delimiters and annotations on heatmaps for different neuron types.
* **Group identifiers**: Manually defined strings (e.g., `PEN_L2`, `D7_R4`) used to bin neurons into functional units.

---

## insect network graph analysis.ipynb

This notebook provides a computational framework to analyze and simplify complex insect neural connectivity data (specifically from the fly ellipsoid body) into theoretical one-population network models for comparison.

### 1. Purpose
The notebook facilitates the transformation of multi-population neural connectivity matrices into simplified single-population equivalent networks. This allows for direct comparison between high-dimensional experimental biological data and simplified theoretical models based on spatial frequency harmonics.

### 2. Key Functions/Classes
*   **`draw_graph`**: A customized visualization utility for plotting neural connectivity networks, featuring specific rendering logic for inhibitory (bar-head) vs. excitatory (arrow-head) connections and arc-based edge routing.
*   **`get_graph_paths_with_length`**: Processes the connectivity matrix to identify and aggregate paths of specific lengths between EPG neurons, effectively "collapsing" multi-step neuronal interactions into direct edges.
*   **`get_circulant_matrix_profile`**: Extracts the average spatial profile from a matrix, assuming circulant properties (translation invariance) common in ring-attractor networks.
*   **`profile_to_mu_amp_phase`**: Decomposes connectivity profiles into mean, amplitude, and phase to interpret the synaptic structure as a vector population code.
*   **`MLE`**: Implements a Maximum Likelihood estimator to fit linear models (parameters $A, B$) to connectivity data with precision weighting.

### 3. Data Flow
*   **Input**: Reads neural connectivity matrices (via `connectivity_matrices` module).
*   **Processing**: Filters and transforms these matrices to account for multi-population dynamics (PEN, PEG, EPG, D7 neurons). Performs matrix multiplication to find multi-hop connections and uses Fourier/Circulant transformations to simplify the network.
*   **Output**: Visualizations of network graphs, spatial profiles, and parameter fits for theoretical models.

### 4. Dependencies
*   **Standard/Scientific**: `numpy`, `scipy`, `matplotlib`, `itertools`.
*   **Graph/Network**: `networkx`.
*   **Custom**: `connectivity_matrices` (a local repository file containing the raw data).

### 5. Analysis Methods
*   **Graph Simplification**: Reduces 4-population networks to 1-population equivalent networks by calculating paths between EPG neurons and weighting them by path length.
*   **Spectral Analysis**: Uses FFT and circulant matrix profiles to map spatial connectivity onto specific frequencies/harmonics.
*   **Statistical Fitting**: Implements weighted least-squares/MLE to reconcile experimental connectivity with theoretical sinusoidal models.

### 6. Figures/Outputs
*   **Network Visualizations**: Graph plots showing connectivity between EPG neurons with customized edge styles (arrows/bars) to indicate excitation/inhibition and spatial positioning.
*   **Profile Plots**: Visualizations of circulant matrix profiles with shaded error margins (standard deviation) to show the "ring" structure of the connections.
*   **Harmonic Comparison**: Panels displaying theoretical connectivity networks generated across different spatial frequencies ($f=1$ to $4$).

### 7. Key Parameters
*   **`N = 8`**: The number of neurons/sub-units in the ring network.
*   **`path_lengths`**: Defines the depth of neuronal chain calculations for simplification.
*   **`neuron_colours`**: Dictionary mapping neuron types (EPG, PEN, PEG, D7) to specific colors for visual consistency.
*   **`neuron_pos`**: A geometric definition for placing nodes in a circular arrangement, mirroring the physical structure of the fly's ellipsoid body.

---

## noise affected multiple harmonics encoding.ipynb

This file, `noise affected multiple harmonics encoding.ipynb`, is a research notebook designed to investigate the robustness of neural representations when position information is encoded using multiple harmonic frequencies.

### 1. Purpose
The notebook demonstrates that encoding spatial information using multiple harmonics leads to increased fragility against noise compared to single-harmonic encoding. It specifically highlights how noise can cause "snapping" or "jumping" errors, where the decoder erroneously maps noisy activity to an incorrect harmonic peak.

### 2. Key Functions/Classes
*   **`activity`**: Generates synthetic neural population responses based on harmonic input ($\theta$) and frequency scaling.
*   **`likelihood_distribution`**: Computes the spatial likelihood map (2D Gaussian distribution) based on neural activity and a specific harmonic $f$.
*   **`decoder` / `all_xy_decoder`**: Performs the inverse mapping from neural activity to coordinates, accounting for phase ambiguity in higher harmonics.
*   **`decode_likelihood_xy` / `decode_multi_likelihood_xy`**: Extracts spatial estimates from likelihood distributions by finding maximum likelihood peaks.
*   **`plot_2_likelihood_distributions`**: Visualizes the overlap and competition between two different frequency harmonics.

### 3. Data Flow
*   **Inputs**: The model defines synthetic parameters (neuron count $N$, frequencies $fs$, noise magnitude/angles).
*   **Process**: It computes clean neural activity, adds controlled Gaussian or oscillatory noise to the signal, calculates likelihood surfaces for multiple harmonics, and performs maximum-likelihood decoding to identify the estimated position.
*   **Outputs**: Produces visualizations of neural activity, likelihood landscapes, and decoding error sensitivity plots.

### 4. Dependencies
*   `numpy`: Numerical computations and signal generation.
*   `matplotlib.pyplot`: Data visualization and plotting.
*   `scipy.linalg`: Matrix operations (specifically pseudoinverse for decoding).

### 5. Analysis Methods
*   **Harmonic Encoding/Decoding**: Uses Fourier-like encoding to represent angular/spatial data in neural populations.
*   **Likelihood Competition**: Analyzes how different harmonics interact when noise is present, specifically tracking how "jumps" occur between different harmonic peaks.
*   **Noise Sensitivity Analysis**: Systematically varies noise magnitude and phase to determine the worst-case decoding errors for different combinations of harmonics (e.g., $f=1,2$ vs $f=1,3$).

### 6. Figures/Outputs
*   **Likelihood Contour Plots**: Shows the spatial likelihood distributions for different harmonics; demonstrates how noise causes the maximum likelihood peak to shift from the target to an incorrect harmonic bump.
*   **Noise Contour plots**: Visualizes how noise in specific frequency bands maps onto distorted decoded coordinates.
*   **Error Sensitivity Plots**: Quantifies decoding error as a function of noise magnitude and noise phase for different harmonic combinations.
*   **Saved PDFs**: Generates publication-ready figures in a `plots/` directory (e.g., `combined-harmonics-error-snapping-example.pdf`).

### 7. Key Parameters
*   **`N`**: Number of neurons in the population (set to 8).
*   **`fs`**: The list of harmonic frequencies used for encoding.
*   **`sigma`**: Width parameter for the Gaussian likelihood distributions.
*   **`noise_ratio` / `noise_angle`**: Parameters controlling the magnitude and directional bias of the simulated noise added to neural activity.

---

## phase portaits.ipynb

This file, `phase portraits.ipynb`, is a computational notebook used to visualize the dynamics of neural activity and synaptic weights in a recurrent neural network model. It analyzes the stability and evolution of the system by plotting phase portraits for activity and weight updates.

### 1. Purpose
The notebook models the co-evolution of neuronal activity patterns and synaptic weight matrices, using phase portraits to characterize the trajectories and stability of these variables over time.

### 2. Key Functions
*   `roll_matrix_rows`: Utility to circularly shift rows of a 2D matrix by varying amounts.
*   `profile_to_matrix`: Converts a 1D vector into a circulant matrix using `scipy.linalg.circulant`.
*   `simulate_fixed_activity`: Performs gradient descent on synaptic weights $W$ given a fixed activity pattern.
*   `simulate_fixed_weights`: Performs gradient descent on activity patterns $a$ given a fixed weight matrix.
*   `get_grad_W_over_period` / `get_grad_a`: Compute the displacement (gradient) in parameter space ($\mu$, amplitude, phase) to facilitate quiver plotting.
*   `get_circulant_matrix_profile`: Extracts mean and standard deviation profiles from a matrix to characterize its structure.

### 3. Data Flow
*   **Initialization**: Defines initial synaptic weights ($W$) and activity profiles ($a$) using Fourier modes and cosine functions.
*   **Processing**: Iterates over grids of $\mu$ (mean) and amplitude parameters to calculate local gradients. These gradients define vectors for phase portraits.
*   **Simulation**: Uses the defined gradient rules to evolve the system over time and track the trajectory toward steady-state (stable weights).

### 4. Dependencies
*   `numpy`: Array manipulation and numerical operations.
*   `matplotlib`: Plotting and visualization.
*   `scipy.linalg`: Circulant matrix generation.

### 5. Analysis Methods
*   **Phase Portrait Analysis**: Uses vector fields (quiver plots) to visualize the dynamics of the system in a low-dimensional feature space (mean $\mu$ vs. amplitude).
*   **Fourier Analysis**: Constructs weight profiles using Inverse Fast Fourier Transforms (IFFT) to ensure specific spectral characteristics.
*   **Gradient Descent**: Simulates the evolution of the network by numerically integrating defined weight and activity updates.

### 6. Figures/Outputs
*   **Activity Phase Portrait**: A quiver plot showing the trajectory of neuronal activity parameters.
*   **Weight Phase Portrait**: A quiver plot showing the evolution of synaptic weights, overlayed with a trajectory line demonstrating convergence toward a "stable weights" point.

### 7. Key Parameters
*   `N = 32`: The number of neurons.
*   `eta = 0.001`: The learning rate for weight/activity updates.
*   `_lambda`: A scaling parameter related to the decay or weight constraint.
*   `gamma`: A constant offset parameter involved in the weight update rule.
*   `mu_range`/`amp_range`: The parameter space bounds used for generating the quiver plots.

---

## polar coordinates noise distribution.ipynb

This analysis covers the Jupyter notebook file `polar coordinates noise distribution.ipynb`.

### 1. Purpose
This notebook derives and validates the transformation of a 2D Cartesian Gaussian distribution (representing neural spatial encoding) into polar coordinates ($r, \theta$). It aims to show how random noise in neural activity results in an analytical probability distribution for the insect's inferred position in polar terms.

### 2. Key Functions/Classes
*   `x_y_to_r_theta(x, y)`: Converts Cartesian coordinates to radial distance ($r$) and angle ($\theta$).
*   `prob_xy(x, y)`: Calculates the 2D Gaussian probability density in Cartesian space.
*   `prob_r_theta(r, theta)`: Calculates the probability density in polar space based on the analytical transformation derived in the markdown cells.
*   `prob_theta(theta)`: Estimates the marginal distribution of the angle, scaled by $r_0$ to ensure proper integration.

### 3. Data Flow
*   **Initialization**: Sets random seed and constants ($\mu_x, \mu_y, \sigma$).
*   **Simulation**: Generates `num_points` ($10,000$) sampled from a 2D Gaussian distribution.
*   **Processing**: Computes $r$ and $\theta$ from the generated samples; performs symbolic derivations of the probability density function.
*   **Comparison**: Compares the simulated (empirical) histogram/scatter data against the derived analytical distribution functions to verify mathematical correctness.

### 4. Dependencies
*   `numpy`: Used for numerical computation and array manipulation.
*   `matplotlib.pyplot`: Used for generating plots and visualizations.
*   `scipy.linalg`: Imported but not explicitly used in the active logic flow.

### 5. Analysis Methods
*   **Coordinate Transformation**: Applies a Jacobian-based conversion of a 2D Gaussian density function from Cartesian to polar coordinates.
*   **Marginalization**: Integrates the joint probability $p(r, \theta)$ over $r$ to find the marginal distribution $p(\theta)$.
*   **Statistical Validation**: Uses `np.allclose` to verify equality between Cartesian and transformed polar density functions.

### 6. Figures/Outputs
*   **Scatter Plots**: Visualize the spatial distribution of noise around the "nest" position $(\mu_x, \mu_y)$.
*   **Histograms**: Show the empirical distributions of angle and distance, overlaid with the analytical curves.
*   **Color-coded Scatter**: Maps distance values ($r \geq r_0$) onto the scatter plot to visualize deviation from the mean position.
*   **Numerical Verification**: Console output confirming the match between the X-Y and R-Theta distributions.

### 7. Key Parameters
*   `mu_x`, `mu_y`: The center coordinates (nest location).
*   `sigma`: The standard deviation of the Gaussian noise added to neural activity.
*   `num_points`: The number of samples (10,000) used for the empirical verification.
*   `angle0`, `r0`: Derived polar coordinates of the mean position $(\mu_x, \mu_y)$.

---

## sinusoidal Hebbian learning weights negative activity with errors.ipynb

### Analysis of `sinusoidal Hebbian learning weights negative activity with errors.ipynb`

This Jupyter Notebook investigates how Oja's Hebbian learning rule performs in the presence of noise or errors in input neural activity, specifically focusing on how weights converge to represent sinusoidal profiles in circulant weight matrices.

#### 1. Purpose
The file performs a simulation study to analyze how errors (white noise or multi-frequency inputs) in neural activity affect the convergence and stability of weights in a neural network governed by Oja's rule. It seeks to validate the theoretical expectation that the Fourier spectrum of the learned weights relates directly to the normalized power spectrum of the input activity.

#### 2. Key Functions/Classes
*   `simulate_and_plot_fixed_activity`: Executes the weight update loop based on Oja's rule and records the evolution of the weight matrix.
*   `roll_matrix_rows`: Utility to roll rows of a 2D matrix independently (essential for handling circulant matrices).
*   `fill_fourier_modes_in_range`: Constructs a synthetic input spectrum by setting specific Fourier modes to 1 and others to 0.
*   `get_circulant_matrix_profile`: Extracts the mean profile and standard deviation of a circulant matrix.
*   `plot_circulant_matrix_as_profile`: Visualizes the weight matrix as a 1D spatial profile with variance shading.

#### 3. Data Flow
*   **Input**: Defines synthetic sinusoidal activity vectors via Fourier mode construction.
*   **Processing**: Applies Oja’s learning rule $\Delta W = a a^T - \lambda a^2 W$ iteratively.
*   **Output**: Generates weight traces (`W_trace`), Fourier analysis comparisons, and matplotlib visualization plots showing weight convergence over time.

#### 4. Dependencies
*   **Core Libraries**: `numpy`, `scipy` (for `circulant` matrices), `matplotlib` (for visualization).
*   **System**: Relies on `matplotlib.lib.stride_tricks` for efficient matrix manipulation.

#### 5. Analysis Methods
*   **Spectral Analysis**: Uses FFT to decompose activity into harmonic components.
*   **Circulant Matrix Analysis**: Assumes spatial translation invariance, allowing weights to be represented as a 1D "profile."
*   **Convergence Testing**: Compares empirical weight evolution against the theoretical prediction derived from the Fourier spectrum of the input ($F[W] \propto |F[a]|^2$).

#### 6. Figures/Outputs
*   **Plots**: Line plots showing the evolution of the weight profile over 1, 10, 100, and 1000 periods, overlayed with the target predicted profile.
*   **Console Output**: Prints Fourier coefficients and norms ($||a||^2$, $||W||_1$) to verify the relationship between input power and weight magnitude.

#### 7. Key Parameters
*   `N`: Size of the network/period (default: 8).
*   `eta`: Learning rate (typically 0.01 or 0.1).
*   `sigma`: Magnitude of white noise added to the activity.
*   `f`: The harmonic/frequency mode used to define the input activity pattern.
*   `_lambda`: Scaling factor in Oja's rule (set to $\approx N/2$ to normalize effects).

---

## sinusoidal Hebbian learning weights negative activity.ipynb

### 1. Purpose
This Jupyter notebook investigates how Hebbian learning with a weight decay term allows a system to learn a sinusoidal weight matrix when exposed to forced sinusoidal neural activity. It uses simulations and phase portrait analysis to demonstrate weight convergence and stability under various conditions.

### 2. Key Functions/Classes
*   `roll_matrix_rows`: Performs circular shifts on rows of a matrix.
*   `fill_fourier_modes_up_to_N` / `fill_fourier_modes_in_range`: Utility functions to construct frequency-domain masks for generating target signal profiles.
*   `simulate_and_plot_fixed_activity`: The core simulation loop that updates weights $W$ based on the input activity $a$ and a decay constant $\lambda$.
*   `get_circulant_matrix_profile`: Extracts the mean and standard deviation of a matrix as a function of the circular distance between neurons.
*   `get_grad_over_period`: Calculates the gradient of the weights over a full period of activity to enable phase portrait generation.

### 3. Data Flow
*   **Inputs**: Hardcoded sinusoidal activity patterns (defined via Fourier modes).
*   **Processing**: Iterative weight updates using $W_{t+1} = W_t + \eta(aa^T - \lambda W_t)$.
*   **Outputs**: Numerical traces of weights ($W\_trace$) and weight gradients ($delta\_W\_trace$), followed by visualization outputs.

### 4. Dependencies
*   `numpy`: Array manipulation and numerical operations.
*   `scipy.linalg`: Used specifically for constructing circulant matrices (`scipy.linalg.circulant`).
*   `matplotlib`: Used for all visualization, including p-color maps, line plots, and quiver plots for phase portraits.

### 5. Analysis Methods
*   **Hebbian Learning**: Implements a standard Hebbian update rule modified by a negative weight decay (Oja-like regularization) to prevent weight explosion.
*   **Phase Portrait Analysis**: Computes the gradient of mean and amplitude for a range of configurations to visualize the convergence landscape of the system.
*   **Fourier Analysis**: Uses inverse FFT to generate target sinusoidal profiles and analyze frequency modes.
*   **Statistical Analysis**: Tracks the mean and variance (standard deviation) of weights relative to the circular distance between neurons.

### 6. Figures/Outputs
*   **Weight Convergence Plots**: Shows how weights evolve over time (1, 10, 100, 1000 periods) starting from zero and noisy initial conditions.
*   **Phase Portraits**: Quiver plots demonstrating the vector field of weight mean and amplitude, showing the system's trajectory toward stable points.
*   **Parameter Sensitivity Plots**: Illustrates how learning rate ($\eta$) impacts convergence speed and final weight variance.
*   **PDF Exports**: Saves high-quality plots to a `plots/` directory (e.g., `hebbian-learning-fixed-activity-negative-activity.pdf`).

### 7. Key Parameters
*   `eta` ($\eta$): The learning rate; dictates the speed of convergence and final weight stability.
*   `_lambda` ($\lambda$): The weight decay factor; tuned to ensure weights settle at a specific magnitude (derived as $\lambda = \frac{4}{N} ||a||^2$).
*   `N`: The number of neurons (dimensionality of the weight matrix).
*   `v_magnitude`: Defines the amplitude of the input activity.

---

## sinusoidal Hebbian learning weights.ipynb

### 1. Purpose
This Jupyter notebook investigates the emergence of a sinusoidal weight matrix through Hebbian learning in a recurrent neural network. It simulates weight evolution under periodic input activity and evaluates convergence using both numerical time-series simulations and phase portrait analysis.

### 2. Key Functions/Classes
*   `roll_matrix_rows`: Circularly shifts rows of a matrix by independent amounts.
*   `fill_fourier_modes_up_to_N`: Constructs a Fourier-domain vector with specific frequency modes enabled to define target weight profiles.
*   `simulate_and_plot_fixed_activity`: Iteratively updates weights according to a Hebbian rule ($ \Delta W = aa^T - \lambda W - \gamma $) and tracks convergence.
*   `get_circulant_matrix_profile`: Extracts the mean and standard deviation of weight profiles from circulant matrices.
*   `get_grad_over_period`: Calculates the gradient of the weight change over one full period of input activity to construct a phase portrait.

### 3. Data Flow
*   **Input**: Defines a circulant matrix $a$ derived from a cosine function.
*   **Process**: Performs iterative gradient-based updates on a weight matrix $W$ across $T$ time steps.
*   **Output**: Generates weight traces, convergence plots, and vector field data (phase portraits) representing the stability of weight parameters (mean and amplitude).

### 4. Dependencies
*   `numpy`: Array manipulation and numerical operations.
*   `scipy.linalg`: Circulant matrix generation.
*   `matplotlib`: Plotting and visualization.

### 5. Analysis Methods
*   **Hebbian Learning Rule**: Implements a standard weight update rule with decay ($-\lambda W$) and a subtractive constraint ($-\gamma$).
*   **Fourier Analysis**: Uses discrete Fourier components to define the target structure of the weight matrix.
*   **Phase Portrait Analysis**: Computes the gradient of weight parameters (mean/amplitude) over a period to visualize the system's attractor dynamics (quiver plots).
*   **Statistical Profiling**: Calculates mean and standard deviation of weight profiles to characterize convergence stability.

### 6. Figures/Outputs
*   **Weight Convergence Plots**: Visualizes the evolution of weight profiles over time (after 1, 10, 100, and 1000 periods).
*   **Phase Portrait**: A quiver plot showing the flow of the mean and amplitude of the weight profile toward stable points.
*   **Final Output**: Saves a summary figure as `plots/hebbian-learning-fixed-activity.pdf`.

### 7. Key Parameters
*   `N` (32): Number of neurons/dimension of the weight matrix.
*   `eta` (0.001 - 1.0): Learning rate; affects convergence speed and steady-state variance.
*   `_lambda`: Decay constant for the weight updates.
*   `gamma`: Constant term for the Hebbian update (related to the subtractive normalization).
*   `v_magnitude`: Defines the amplitude of the input signal.

---

## sinusoidal Oja's rule negative activity.ipynb

This file is a Jupyter Notebook used to investigate the convergence behavior of synaptic weights under Oja's rule when the neural activity is constrained to a fixed sinusoidal pattern.

### 1. Purpose
The notebook demonstrates how a neural weight matrix, initially zero or noisy, evolves toward a sinusoidal profile using Oja's rule under a fixed sinusoidal input. It analyzes the stability of these weights and generates phase portraits to visualize the gradient dynamics of the learning process.

### 2. Key Functions/Classes
*   **`simulate_and_plot_fixed_activity`**: Executes the weight update loop based on Oja's rule and tracks the trace of weight evolution.
*   **`fill_fourier_modes_up_to_N` / `fill_fourier_modes_in_range`**: Helper functions to generate specific frequency components in the Fourier domain for target weight profiles.
*   **`get_circulant_matrix_profile`**: Extracts the mean and standard deviation of weight values across a circulant matrix.
*   **`grad_over_period`**: Calculates the cumulative weight gradient over a full period of sinusoidal input.
*   **`get_grad_over_period`**: Computes the gradient of weight parameters (mean, amplitude, phase) to facilitate phase portrait generation.

### 3. Data Flow
*   **Input**: Defines sinusoidal input activity patterns based on Fourier mode settings.
*   **Process**: Iteratively updates a weight matrix $W$ using Oja’s learning rule: $\Delta W = a a^T - \lambda a^2 W$.
*   **Output**: Produces time-series traces of weight convergence, phase portrait data, and graphical plots saved as PDF/PGF files.

### 4. Dependencies
*   **Standard scientific stack**: `numpy`, `scipy.linalg`, `matplotlib`.
*   **Internal logic**: Relies on specific matrix manipulation techniques (circulant matrices and stride tricks) to model neural connectivity.

### 5. Analysis Methods
*   **Oja's Rule**: Applied to study stable weight convergence.
*   **Fourier Analysis**: Used to define target weight profiles and analyze the frequency content of the resulting weight matrices.
*   **Phase Portrait Analysis**: Employs quiver plots to visualize the gradient flow of weight features (mean and amplitude) in parameter space.
*   **Stability Analysis**: Evaluates how noise perturbation affects convergence by comparing starting conditions (zero vs. noisy sinusoid).

### 6. Figures/Outputs
*   **Weight Convergence Plots**: Multi-period snapshots showing the evolution of weights toward a target sinusoid.
*   **Phase Portraits**: Quiver plots demonstrating the vector field of weight gradients (mean vs. amplitude).
*   **Scientific Figures**: Multiple figures exported as PDF and PGF files for publication or presentation, specifically tracking noise rejection and convergence speed.

### 7. Key Parameters
*   **`eta` ($\eta$)**: The learning rate; affects the speed of convergence and the residual variance of the weights.
*   **`_lambda` ($\lambda$)**: The scaling parameter for the negative feedback term in Oja's rule, set to $N/2$.
*   **`N`**: The dimension of the weight matrix (number of neurons), set to 8.
*   **`v_magnitude`**: The scale of the sinusoidal input.

---

## sinusoidal input rejection.ipynb

This analysis provides a structured summary of the `sinusoidal input rejection.ipynb` file.

### 1. Purpose
This notebook investigates the noise resilience of circulant neural networks. It demonstrates that using a weight matrix consisting only of low-frequency Fourier modes (0 and 1) allows the network to effectively perform low-pass filtering, rejecting non-sinusoidal inputs and noise while maintaining stable activity.

### 2. Key Functions/Classes
*   `scaled_cosine`/`gaussian`: Generator functions for predefined neural activity profiles.
*   `profile_to_matrix`: Converts a 1D neural activity profile into a circulant weight matrix ($W$) using `scipy.linalg.circulant`.
*   `get_cosine_from_fourier_modes`: Constructs a weight profile by performing an inverse FFT on specified Fourier coefficients.
*   `simulate_and_plot`: Executes a dynamical systems simulation of the neural network activity ($\Delta a = -a + Wa + u$), calculates the Root Mean Square (RMS) error relative to the initial state, and visualizes the results.

### 3. Data Flow
*   **Input**: Defined Fourier modes, number of neurons ($N$), and external input vectors ($u$).
*   **Processing**: The code transforms Fourier components into a circulant spatial weight matrix, initializes a noisy neural state, and evolves the activity state over time using a discrete-time approximation of a linear dynamical system.
*   **Output**: Console prints of RMS error metrics and plots depicting the network's steady-state response versus the initial activity profile.

### 4. Dependencies
*   `numpy`: Numerical operations and FFTs.
*   `matplotlib.pyplot`: Data visualization.
*   `scipy.linalg`: Circulant matrix construction.

### 5. Analysis Methods
*   **Linear Dynamical Systems**: Modeling neural activity as a self-recurrent system ($\dot{a} = -a + Wa + u$).
*   **Fourier Analysis**: Utilizing frequency domain manipulation to constrain the connectivity of the network.
*   **Noise Analysis**: Evaluating robustness via RMS error and standard deviation of activity states under stochastic perturbation.

### 6. Figures/Outputs
*   **Performance Plots**: Overlaid graphs showing the "original activity" vs. "example response" with shaded regions representing standard deviation.
*   **Error Metrics**: Quantitative feedback (RMS mean and standard deviation) on how well the network preserves the encoded variable under different input frequencies.

### 7. Key Parameters
*   `N`: Total number of neurons (default: 32), determining the dimensionality of the circulant matrix.
*   `fourier_modes`: A vector used to define the weight matrix, where non-zero indices at specific positions dictate the frequency response of the network.
*   `noise`: Magnitude of Gaussian noise applied to the initial activity state.
*   `dt`: Integration time step (default: 0.001) for the differential equation solver.

---

## sinusoidal noise rejection negative activity.ipynb

### Code Analysis: `sinusoidal noise rejection negative activity.ipynb`

#### 1. Purpose
This notebook investigates how the spectral content of a circulant weight matrix impacts noise resilience in a linear neural network. It demonstrates that limiting the weight matrix to the first Fourier mode acts as an optimal band-pass filter, minimizing noise variance in the network's stable activity state.

#### 2. Key Functions/Classes
*   **`fill_fourier_modes_in_range(first, last, period)`**: Constructs a Fourier spectrum vector where specific modes are set to 1, facilitating the creation of structured weight matrices.
*   **`profile_to_matrix(profile)`**: Converts a connectivity profile into a `scipy.linalg.circulant` matrix representing the network's synaptic connections.
*   **`simulate_and_plot(...)`**: Simulates the evolution of neural activity ($\dot{a} = -a + Wa$) under Gaussian noise until convergence, calculating the resulting variance and visualizing the stable state.

#### 3. Data Flow
*   **Input**: Defines network size ($N$), noise intensity ($\sigma$), and selects active Fourier modes.
*   **Processing**: Generates weight matrices based on Fourier components, initializes neural activity (cosine-based), and iteratively solves the linear dynamical system to find a stable noisy attractor.
*   **Output**: Produces statistical summaries of noise variance, console prints of decoding parameters, and saved PDF plots.

#### 4. Dependencies
*   `numpy`: Numerical operations and matrix manipulation.
*   `matplotlib`: Data visualization and plotting.
*   `scipy.linalg`: Specifically `circulant` for building network connectivity matrices.

#### 5. Analysis Methods
*   **Fourier Analysis**: Uses discrete Fourier transform concepts to build specific weight kernels (band-pass filtering).
*   **Numerical Simulation**: Employs an iterative Euler-style integration to simulate neural activity dynamics toward steady-state.
*   **Statistical Validation**: Compares simulation results for noise variance against theoretical predictions derived from Fourier mode summation.
*   **Decoding**: Uses `arctan2` and circular correlations to determine if the network preserves directional information despite the added noise.

#### 6. Figures/Outputs
*   **Weight Profile Comparison**: Visualization of how adding Fourier modes changes the shape of the connectivity matrix.
*   **Noise Variance Analysis**: Plots comparing simulation results with theoretical predictions for both increasing Fourier modes and increasing network size ($N$).
*   **PDF Exports**: Saves plots to a `plots/` directory (e.g., `sinusoidal-noise-rejection-fourier-modes-negative-activity.pdf`).

#### 7. Key Parameters
*   `N`: The number of neurons in the circulant network.
*   `noise` / `noise_stddev`: The standard deviation of the additive Gaussian noise injected into the network.
*   `dt`: Time step for the numerical integration of activity dynamics.
*   `last_mode_range`: The range of Fourier harmonics used to define the synaptic weight architecture.

---

## sinusoidal noise rejection.ipynb

### Analysis of `sinusoidal_noise_rejection.ipynb`

This Jupyter notebook investigates the relationship between neural network weight matrix architecture (specifically the number of Fourier modes) and its resilience to noise in circulant networks. It demonstrates that limiting the weight matrix to low-frequency Fourier modes acts as a low-pass filter, optimizing noise rejection.

#### 1. Purpose
The file performs a simulation-based study to prove that a sinusoidal weight matrix with minimal Fourier modes provides the most robust encoding in linear circulant networks. It quantifies how noise variance scales with the complexity of the weight matrix and the total number of neurons in the network.

#### 2. Key Functions/Classes
*   `fill_fourier_modes_up_to_N(last_fourier_mode, period)`: Generates a Fourier spectrum vector where specific modes are set to 1, facilitating control over frequency components.
*   `simulate_and_plot(a0, W, ...)`: Simulates the neural network activity over time under noisy conditions, calculates error metrics (mean/stdev), and plots the results.
*   `profile_to_matrix(profile)`: Converts a weight profile into a circulant matrix format using `scipy.linalg.circulant`.
*   `get_cosine_from_fourier_spectrum(fourier_spectrum)`: Performs an inverse FFT to transform frequency-domain weight definitions into spatial (neuron) domain weights.

#### 3. Data Flow
*   **Input**: Defines network configurations (number of neurons $N$, Fourier mode range, noise level).
*   **Processing**: Computes weight matrices via frequency-domain filtering, initializes activity with Gaussian/Cosine profiles, and executes iterative discrete-time updates (`a += dt * (-a + W@a)`).
*   **Output**: Generates statistical metrics for error variance and produces diagnostic plots comparing simulation results against theoretical predictions.

#### 4. Dependencies
*   **Scientific Stack**: `numpy`, `scipy.linalg`, `matplotlib.pyplot`.
*   **Repository Internal**: No external local file dependencies; it is a self-contained analysis script.

#### 5. Analysis Methods
*   **Circulant Network Simulation**: Models neural activity as a dynamical system where the steady state is influenced by a circulant weight matrix.
*   **Fourier Domain Filtering**: Uses frequency-domain constraints to design filters that act as noise suppressors.
*   **Error Analysis**: Computes mean squared error (MSE) and variance of neural activity following injected Gaussian noise to validate the theoretical relationship $\text{Var} \propto \sum ||\mathcal{F}_f[\omega]||^2$.

#### 6. Figures/Outputs
*   **Weight Profile Plots**: Visualizes how weight matrices change as more Fourier modes are included.
*   **Noise vs. Complexity Plot**: Shows a linear increase in noise variance as the number of Fourier modes increases.
*   **Noise vs. Scale Plot**: A log-log plot demonstrating that noise variance decreases inversely with the number of neurons ($1/N$ scaling).
*   **PDF Exports**: Saves figures to `plots/sinusoidal-noise-rejection-fourier-modes.pdf` and `plots/sinusoidal-noise-rejection-number-neurons.pdf`.

#### 7. Key Parameters
*   `N` (Number of neurons): Defaults to 32, tested across a power-of-two range ($2^2$ to $2^8$).
*   `noise` (Noise level): Set to 0.3 (standard deviation).
*   `dt` (Time step): 0.001 for the numerical simulation loop.
*   `repetitions`: 100 for statistical averaging of noise effects.

---

## sinusoidal phase portraits negative activity.ipynb

This analysis provides a structured summary of the `sinusoidal phase portraits negative activity.ipynb` file.

### 1. Purpose
This notebook investigates the coupled dynamics of neural activity and synaptic weight evolution in a circular network architecture. It uses phase space analysis to compare Oja’s rule and standard Hebbian learning models, specifically characterizing stability through the amplitude of sinusoidal activity and weight profiles.

### 2. Key Functions/Classes
*   `roll_matrix_rows`: Utility to circularly shift rows of a weight matrix.
*   `fill_fourier_modes_up_to_N`: Generates frequency-domain filters to construct specific synaptic weight profiles (e.g., cosines).
*   `simulate_and_plot_input`: Computes the temporal trajectory of weights ($W$) and activity ($a$) based on input-driven learning rules.
*   `phase_plot`: Generates a vector field (quiver plot) representing the gradient dynamics of weight/activity amplitudes in phase space.
*   `instantaneous_grad_a_W` / `Hebbian_instantaneous_grad_a_W`: Compute the update steps ($\Delta a, \Delta W$) for the two different learning models evaluated.

### 3. Data Flow
*   **Input**: Synthetically generated sinusoidal profiles representing initial neural activity and weight connection strengths.
*   **Processing**: The notebook applies iterative updates (Hebbian/Oja rules) to these profiles, calculating gradients in the space of Fourier-mode amplitudes.
*   **Output**: Numerical traces of activity/weight evolution and visualizations of the corresponding phase portraits.

### 4. Dependencies
*   **Standard scientific stack**: `numpy`, `scipy.linalg` (for circulant matrix operations), `matplotlib.pyplot`.

### 5. Analysis Methods
*   **Phase Space Analysis**: Maps the system's evolution onto a 2D plane defined by the amplitude of the first Fourier mode of the weights vs. the activity.
*   **Fourier Decomposition**: Uses circular convolution (via circulant matrices) to simplify the simulation of recurrent network dynamics.
*   **Vector Field Visualization**: Uses `plt.quiver` to identify steady states (nodes/saddles) and convergence behavior of the learning rules.

### 6. Figures/Outputs
*   **Heatmaps/Line Plots**: Displays the temporal evolution of weights and activity profiles.
*   **Phase Portraits**:
    *   **Oja’s Rule Plot**: Illustrates convergence behavior, indicating a "line attractor" configuration.
    *   **Hebbian Learning Plot**: Includes the nullclines ($\dot{a}=0$ and $\dot{W}=0$), visualizing the system's "saddle" point behavior.

### 7. Key Parameters
*   `N` (32): Number of neurons in the circular network.
*   `eta` (0.001): Learning rate for the updates.
*   `_lambda`: Scaling factor used in weight decay/normalization.
*   `v_magnitude`: Base amplitude for the initial sinusoidal input.
*   `gamma`: Decay parameter for Hebbian weight updates.

---

## sinusoidal updating activity and weights.ipynb

This analysis covers the Jupyter Notebook `sinusoidal updating activity and weights.ipynb`, which explores the co-evolution of neuronal activity and synaptic weights in a recurrent network.

### 1. Purpose
This notebook simulates the dynamics of a neural network where synaptic weights evolve according to Oja’s rule while neural activity updates in response to external sinusoidal or square-wave inputs. The goal is to demonstrate how network weights converge to a stable configuration that supports consistent activity "bumps" despite initial noise.

### 2. Key Functions/Classes
*   **`simulate_dynamic_weights_and_activity`**: Simulates a linear network, updating activity via gradient descent and weights (using Oja's rule) at the end of each period.
*   **`simulate_dynamic_weights_and_activity_nonlinear`**: A version of the simulation for nonlinear neurons using a `tanh` activation function.
*   **`fill_fourier_modes_up_to_N` / `fill_fourier_modes_in_range`**: Utilities to construct weight matrices with specific spectral profiles (e.g., sinusoidal).
*   **`roll_matrix_rows`**: A helper function using `stride_tricks` to cyclically shift rows of a matrix, useful for analyzing circulant connection profiles.
*   **`profile_to_mu_amp_phase`**: Extracts amplitude and positional information (phase) from neural activity using population coding.

### 3. Data Flow
*   **Inputs**: Initial weights ($W_0$), initial activity ($a_0$), and external stimulus array.
*   **Processes**: Iterative updates where activity evolves via differential equations ($\dot{a}$) and weights are accumulated and updated periodically.
*   **Outputs**: Trace arrays recording the history of weights, activity patterns, and root-mean-square (RMS) error relative to a target stable configuration.

### 4. Dependencies
*   **Standard scientific stack**: `numpy`, `scipy.linalg`, `matplotlib`.
*   **Repo-specific**: Relies on custom matrix manipulation and signal processing helper functions defined in Cells 3 and 4.

### 5. Analysis Methods
*   **Oja's Rule**: Implemented to enforce synaptic stability and weight normalization (L2 norm).
*   **Fourier Analysis**: Used to generate and analyze the connectivity profiles of the weight matrix.
*   **Population Coding/Bump Analysis**: Uses trigonometric projection (cosine/sine filters) to track the amplitude and position of neural activity "bumps."
*   **Nonlinear Dynamics**: Incorporates `tanh` activation to simulate neural saturation and distorted (square-wave) inputs.

### 6. Figures/Outputs
*   **Weight Convergence Plots**: Visualizations comparing weight profiles over time (after 1, 5, 10, 25, 100+ periods) against the "stable" theoretical weights.
*   **Activity Dynamics**: Plots showing the trajectory of activity bumps over time versus ideal positions.
*   **Error Curves**: RMS error plots showing the convergence of weights over the course of the simulation.
*   **Export**: The notebook saves key findings as a PDF plot (`plots/ojas-rule-dynamic-activity-weight-convergence-both.pdf`).

### 7. Key Parameters
*   **`N` (8)**: Number of neurons.
*   **`eta` (0.1)**: Learning rate for synaptic updates.
*   **`dt` (0.01)**: Simulation timestep.
*   **`f` (1)**: Frequency of the sinusoidal input/weight profile.
*   **`periods`**: Number of simulation iterations (varied between 100 for linear and 2500 for nonlinear cases).

---

## sinusoidal-ei-network-maths.ipynb

This file, `sinusoidal-ei-network-maths.ipynb`, is a research notebook that derives and numerically validates the stability conditions for a two-population (Excitatory-Inhibitory) neural network with circulant connectivity matrices.

### 1. Purpose
The notebook models the dynamics of an EI network using leaky rate-based neurons and performs Fourier analysis to determine the conditions under which the system reaches stable sinusoidal activity states. It provides numerical simulations to test different connectivity weight regimes and verify stability conditions derived from linear systems theory.

### 2. Key Functions/Classes
*   `profile_to_matrix`: Converts a connectivity profile vector into a full circulant weight matrix using `scipy.linalg.circulant`.
*   `fourier_modes_to_time_domain`: Transforms Fourier harmonic coefficients into a time-domain signal profile.

### 3. Data Flow
*   **Input**: Manually defined scalar weights for EE, EI, IE, and II connectivity; initial activity states for excitatory ($E$) and inhibitory ($I$) populations.
*   **Processing**: Computes circulant matrices based on predefined connectivity profiles, then iteratively solves the differential equations for $\dot{a}_E$ and $\dot{a}_I$ using an Euler integration step.
*   **Output**: Plots of final $E/I$ population activities and the convergence (or growth) of the first harmonic derivatives.

### 4. Dependencies
*   **Libraries**: `numpy`, `matplotlib`, `scipy.linalg`.
*   **Styling**: Uses `seaborn-notebook` and LaTeX font rendering.

### 5. Analysis Methods
*   **Fourier Analysis**: Uses the Fourier domain to simplify convolution operations ($\ast$) into algebraic products to find fixed points.
*   **Linear Stability Analysis**: Calculates the eigenvalues of the Jacobian matrix of the system to check if fixed points are attractor states or unstable.
*   **Numerical Integration**: Implements a simple Euler method (`a += 0.01 * a_dot`) to observe the dynamical evolution of the neural populations over time.

### 6. Figures/Outputs
*   **Activity Plots**: Line charts showing the spatial distribution of $E$ and $I$ populations across the neural index.
*   **Derivative Convergence Plots**: Time-series plots showing the evolution of the derivative of the first activity mode to visualize approach to stability.

### 7. Key Parameters
*   `N`: The number of neurons in the simulation (set to 16).
*   `w_ee, w_ie, w_ei, w_ii`: Weight scalars/profiles representing the connectivity strengths between and within populations.
*   `a_E, a_I`: Initial activity states (often set as cosine functions to reflect the sinusoidal hypothesis).
*   `dt`: Time step for integration (set to 0.01).

---

