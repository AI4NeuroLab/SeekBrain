# Repository File Summaries

## Coding model.ipynb

This file is a Jupyter Notebook (`.ipynb`) containing simulation code and plotting routines for modeling odor coding, sparsity, and glomerular responses in a biological olfactory system.

### 1. Purpose
The file simulates the responses of a population of neurons (glomeruli) to odor stimuli, investigating how mixture components and antagonism (modeled via $\eta$ and $\kappa$ parameters) affect neural sparsity and coding schemes. It generates various figures used to illustrate the scaling of sparsity with the number of background odors and the normalization effects in odor mixture processing.

### 2. Key Functions/Classes
*   `pattern(eta)` / `pattern_c(...)`: Calculates the activation level of a neuron based on input strength ($\eta$) and concentration ($c$).
*   `mixture(...)` / `mixture_c(...)`: Computes the effective activation of a neuron when exposed to a mixture of multiple odorants by calculating weighted sums of input intensities and antagonisms ($\kappa$).

### 3. Data Flow
*   **Initialization**: Defines grids of coordinates ($N \times N$) and initializes log-normal random variables representing odor affinity ($\kappa$) and intensity ($\eta$).
*   **Processing**: Iterates through different concentration levels and background odor counts to compute activation patterns.
*   **Output**: Generates high-quality vector graphic files (`.eps`) and displays plots inline.

### 4. Dependencies
*   **Scientific Stack**: `numpy`, `scipy` (for interpolation and normal distribution statistics), `matplotlib`.
*   **System**: `os`.

### 5. Analysis Methods
*   **Odor Interaction Modeling**: Uses hill-function-like sigmoid models to determine neural firing thresholds ($t$) based on input intensity and antagonistic inhibition.
*   **Stochastic Simulation**: Uses `np.random.randn` to generate diverse odorant profiles, simulating population-level responses to complex mixtures.
*   **Scaling Analysis**: Investigates how the sparsity of the neural code (the percentage of active units) scales as the number of mixture components increases.

### 6. Figures/Outputs
*   **`fig6_sparsity_scaling.eps`**: Shows how neural sparsity changes as a function of the number of background odors.
*   **`fig6_coding_scheme1/2/3.eps`**: Illustrates the binary coding scheme and thresholding behavior of neurons.
*   **`fig6_mixture_scatter_rho.eps`**: Demonstrates the impact of antagonism ($\rho$) on the mixture response.
*   **`fig4_norm_rho_b{1,4,16}.eps`**: Visualizes the spatial "glomerular" activation patterns under varying levels of mixture complexity (b=1, 4, 16).

### 7. Key Parameters
*   **$N$**: Grid resolution (typically 14–25).
*   **$n$**: Hill coefficient (set to 4) controlling the steepness of the response curve.
*   **$\rho$**: Correlation parameter representing the strength of antagonism between odorant intensity and inhibition.
*   **$p$**: Sparsity target (set to 0.3 or 30%).
*   **$b$**: Number of odors/components in the mixture.
*   **$c$**: Concentration level of the odors.

---

## Concentration coding.ipynb

This analysis covers the `Concentration coding.ipynb` file, which appears to be a computational simulation investigating how neural populations (specifically olfactory glomeruli) represent odor concentration and mixtures.

### 1. Purpose
This notebook simulates a neural coding model to investigate how odor concentration is represented and how mixture suppression (inhibition/masking) affects the perception of components within an olfactory system. It specifically explores how these representations change under varying stimulus parameters and correlation structures.

### 2. Key Functions/Classes
*   **`pattern(eta)` / `pattern_c(eta, kappa, c)`**: Defines the neural response function (likely a Hill-type activation) for a single odorant given concentration $c$ and sensitivity parameters.
*   **`mixture(eta, kappa)` / `mixture_c(eta, kappa, c)`**: Models the effective response of the neural population to a mixture of inputs.
*   **`mixture_response_m(...)`**: Models competitive interactions (suppression/masking) between two components in a mixture.
*   **`mono_response_m(...)` / `mono_response_m_c(...)`**: Functions to calculate the response for a single odorant modulated by inhibitory mechanisms ($m$).

### 3. Data Flow
*   **Input**: Generates synthetic odorant receptive fields using `numpy` random distributions (`lnkappa`, `lneta`) and stimulus concentrations (`lnc`).
*   **Processing**: Iteratively calculates population activity across trials, comparing true concentrations against predicted values based on the neural response thresholds.
*   **Output**: Saves multiple EPS files representing plots of concentration coding performance and neural suppression dynamics.

### 4. Dependencies
*   **Standard scientific stack**: `numpy`, `matplotlib`, `scipy.stats`.
*   **Environment**: Requires `matplotlib` with 'Tahoma' font support.

### 5. Analysis Methods
*   **Monte Carlo Simulation**: Performs numerous trials (`numtrials`) to estimate concentration decoding accuracy.
*   **Neural Population Modeling**: Uses sigmoidal/Hill-function-based neural activation models to simulate response curves.
*   **Thresholding**: Uses `norm.ppf` (Percent Point Function) to establish activation thresholds ($t$) based on a sparsity parameter ($p$).
*   **Correlation Modeling**: Uses a `rho` parameter to simulate correlations between neural sensitivity (eta) and affinity (kappa).

### 6. Figures/Outputs
*   **`fig4_glom_conc1e-3.eps`**: Visualization of active glomeruli at a specific concentration.
*   **`fig4_conc_coding.eps`**: Log-log plot showing the accuracy of concentration estimation (True vs. Estimated concentration) for different stimulus conditions.
*   **`fig4_conc_coding_inset.eps`**: Average error analysis of the concentration estimation.
*   **`fig4_conc_coding_fixedA.eps`**: Analysis of mixtures with a fixed background component.

### 7. Key Parameters
*   **`N`**: Grid size for the simulated neural sheet (default: 16x16).
*   **`n`**: Hill coefficient, defining the steepness of the neural response curve (default: 4).
*   **`rho`**: Correlation between sensitivity and affinity; controls the structure of the neural representation.
*   **`p`**: Sparsity parameter, determining the activation threshold ($t$).
*   **`b`**: Number of simulated receptors or trials.

---

## Masking.ipynb

This file, `Masking.ipynb`, is a computational research notebook used to model and simulate olfactory receptor masking (inhibition and synergy) in response to odorant mixtures.

### 1. Purpose
The script models the physiological response of olfactory systems to odorant mixtures, specifically focusing on "masking" effects. It performs non-linear curve fitting to experimental data and simulates time-series responses of receptor populations to single and dual-odorant pulses using differential equations.

### 2. Key Functions/Classes
*   **Response Functions (`mixture_response`, `mono_response`, `mixture_response_m`, `mono_response_m`)**: Implement Hill-equation-based mathematical models for receptor response under various conditions (monomolecular vs. mixture, with and without masking parameters).
*   **`supp_ratio` / `supp_ratio_fitting`**: Models the suppression ratio (masking efficacy) based on concentration; used for parameter estimation against experimental data.
*   **`integrate` / `integrate_mix` / `integrate_mix_mask_2odors`**: Numerical solvers using Euler integration to compute time-dependent concentrations of biological signaling molecules ($R, B, A, C, CNG, Ca, CaM$) and masking dynamics ($M$).

### 3. Data Flow
*   **Input**: Hard-coded lists of experimental concentration-response data (`TCA_c`, `TBA_s`, etc.) for various chemical odorants.
*   **Processing**: Uses `scipy.optimize.curve_fit` to estimate model parameters (affinity $K_m$, efficacy $e_m$, cooperativity $n_m$) based on the hard-coded data.
*   **Output**: Generates `.eps` vector graphics files of modeling results and displays plots inline.

### 4. Dependencies
*   **Libraries**: `numpy`, `matplotlib`, `scipy` (specifically `scipy.interpolate`, `scipy.stats`, `scipy.optimize`).
*   **Files**: Operates as a standalone analysis script; no internal dependencies on other project files are explicitly imported.

### 5. Analysis Methods
*   **Non-linear Least Squares**: Fitting experimental data to theoretical masking curves via `curve_fit`.
*   **Numerical Integration**: Using a discretized Euler method to solve systems of ordinary differential equations representing olfactory signaling pathways (e.g., CNG channel dynamics).
*   **Sigmoidal Modeling**: Use of Hill-type equations to model dose-response relationships.

### 6. Figures/Outputs
*   **`fig3_masking_fit.eps`**: Concentration-response curves for various odorants with fitted models.
*   **`fig4_masking_synergy.eps`**: Theoretical plots demonstrating non-competitive interaction (synergy/inhibition) profiles.
*   **`fig3_mask_timeseries.eps`**: Time-domain simulation showing how a "masking" stimulus (second pulse) alters the primary response.

### 7. Key Parameters
*   **`n` (Hill Coefficient)**: Defines the steepness of the response curve (set to 4).
*   **`Km`, `em`, `nm`**: Affinity, efficacy, and cooperativity parameters characterizing the masking agent's interaction with the receptor.
*   **`stimtime`, `secpulsetime`**: Timing parameters for pulse-based simulation experiments.
*   **`dt`**: Time step size for numerical integration ($0.0001$ seconds).

---

## Quality coding.ipynb

### Analysis Summary: `Quality coding.ipynb`

#### 1. Purpose
This notebook serves as a post-processing and visualization script for numerical simulation results related to olfactory systems, specifically modeling information maximization and component separation in odor mixtures. It generates publication-quality figures by processing pre-computed simulation data.

#### 2. Key Functions/Classes
*   `pattern(eta)`: Calculates the basic odorant response profile.
*   `pattern_c(eta, kappa, c)`: Calculates the response profile in the presence of concentration components.
*   `mixture(eta, kappa)`: Simulates the effective odorant response in a mixture based on receptor/ligand dynamics.
*   `mixture_c(eta, kappa, c)`: Computes the mixture response profile accounting for specific ligand concentrations.

#### 3. Data Flow
*   **Input**: Loads `.dat` files from the `./Numerics/` directory. These files contain simulation results (e.g., info maximization metrics, hit/false-positive rates for component separation) characterized by parameters like `rho` (correlation), `p` (sparsity), and `nb` (number of odors).
*   **Processing**: Uses `scipy.interpolate.UnivariateSpline` to smooth raw simulation data and calculate maxima (`rhomax`).
*   **Output**: Saves multiple EPS files (`fig5_info_cocktail.eps`, `fig5_glom_n...eps`, `fig5_compsep_roc_...eps`) for publication.

#### 4. Dependencies
*   **Python Libraries**: `numpy`, `matplotlib`, `scipy` (specifically `interpolate` and `stats.norm`), and `os`.
*   **External Data**: Relies on a suite of data files in the `./Numerics/` directory which are assumed to exist prior to running the notebook.

#### 5. Analysis Methods
*   **Information Maximization**: Analyzes how odor representation parameters ($\rho$, $p$) affect information output.
*   **Spline Interpolation**: Employs univariate splines to create smooth curves from discrete numerical simulation data.
*   **ROC Analysis**: Generates Receiver Operating Characteristic (ROC) curves (hit rates vs. false-positive rates) to assess component separation performance across different correlation coefficients.
*   **Stochastic Modeling**: Uses `norm.ppf` and random distributions (`np.random.randn`) to simulate receptor/glomeruli odor responses.

#### 6. Figures/Outputs
The notebook produces five distinct visual outputs for "Figure 5" of a research paper:
*   **Information Maximization**: Plots of maximum correlation versus sparsity, including an inset showing specific distribution profiles.
*   **Glomeruli Visualization**: A scatter plot representing the activation patterns of glomeruli in a mixture.
*   **Scaling Analysis**: A log-plot showing information retention as a function of the number of background odors (`nb`).
*   **Component Separation**: ROC curves for various noise/correlation levels (`rho`), quantifying the model's ability to identify individual components in mixtures.

#### 7. Key Parameters
*   `rho`: Correlation coefficient (controls signal-to-noise or input overlap).
*   `p`: Sparsity parameter for odors.
*   `nb`: Number of background odors in the mixture.
*   `n`: Sensitivity index (Hill coefficient style exponent).
*   `c`: Concentration levels.

---

## Temporal dynamics of ORN.ipynb

### Code Analysis: `Temporal dynamics of ORN.ipynb`

#### 1. Purpose
This notebook simulates the temporal dynamics of Olfactory Receptor Neurons (ORNs) in response to odorant stimuli. It models the biochemical signaling pathway—including receptor binding, secondary messenger production (cAMP), and calcium feedback—to analyze response latency, adaptation, and mixture integration.

#### 2. Key Functions/Classes
*   `integrate(...)`: Numerical integration using Euler's method to solve the differential equations for a single odorant stimulus.
*   `integrate_mix(...)`: Solves the system for multiple odorants assuming shared downstream pathways.
*   `integrate_mix_c_2odors(...)`: Specific version for two-odorant mixtures with separate pulse timing control.
*   `response_odor(...)` & `response_mixture(...)`: Analytical steady-state approximations for receptor occupancy and response.

#### 3. Data Flow
*   **Initialization**: Defines rate constants (`k1`, `km1`, `k2`, `km2`) and biophysical constants (`KC`, `kG`, `KCa`, etc.).
*   **Processing**: Functions take stimulus concentration (`Xc`) and timing parameters as input, iterate through time steps, and track species concentrations (`R`, `B`, `A`, `C`, `CNG`, `Ca`, `CaM`).
*   **Output**: Generates time-series arrays for calcium/cAMP dynamics and saves processed figures as EPS files.

#### 4. Dependencies
*   `numpy`: Numerical computations and array handling.
*   `matplotlib`: Plotting and visualization.

#### 5. Analysis Methods
*   **Numerical Differential Equations**: The code simulates an ODE system (mass-action kinetics) for receptor binding and downstream signaling.
*   **Temporal Analysis**: Calculates latencies (time to reach a threshold of max response) and measures adaptation by varying pulse intervals.
*   **Rate Calculation**: Computes the derivative of cAMP concentration over time to determine production rates.

#### 6. Figures/Outputs
The notebook generates several figures (`fig1p1.eps` through `fig1p5.eps`) representing:
*   **Response time series** across varying stimulus concentrations.
*   **Adaptation effects** via multiple stimulus pulses.
*   **Stimulus duration impact** on response magnitude.
*   **cAMP production rates**.
*   **Response latency** as a function of odor concentration.

#### 7. Key Parameters
*   **`n`**: Hill coefficient (4).
*   **`dt`**: Integration time step (typically 0.0001s).
*   **`k1`, `km1`, `k2`, `km2`**: Kinetic rate constants governing receptor-ligand and secondary messenger transitions.
*   **`stimtime` / `secpulsetime`**: Parameters controlling the timing of odorant pulses.
*   **`CaM0` / `nini`**: Parameters controlling calcium-calmodulin feedback loop strength.

---

