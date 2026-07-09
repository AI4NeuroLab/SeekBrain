# Repository File Summaries

## CMakeLists.txt

### Code Analysis: `CMakeLists.txt` (Stalefish)

#### 1. Purpose
This file provides the build configuration for the "Stalefish" project, defining the compilation environment, platform-specific flags, and external dependencies. It automates the process of generating build files (e.g., Makefiles) required to compile the project’s source code and link against necessary research libraries.

#### 2. Key Functions/Classes
*Note: As a CMake file, this does not contain classes or functions, but performs build-time logic:*
*   **Platform Detection**: Uses `CMAKE_SYSTEM` to identify the host OS (Linux, BSD, macOS, Windows) and defines corresponding preprocessor macros (e.g., `__GLN__`, `__OSX__`).
*   **Compiler Configuration**: Sets global flags for C++17, adds warning suppression (e.g., for Clang brace initializers), and enables debugging symbols where applicable.
*   **Module Organization**: Orchestrates the build process by directing CMake into subdirectories: `/src`, `/allen`, and `/data`.

#### 3. Data Flow
*   **Input**: Reads source code in `src/`, `allen/`, and `data/`, as well as header files from the `morphologica` dependency.
*   **Processing**: Compiles and links library files into a shared library format, injecting compile-time paths (e.g., `MORPH_FONTS_DIR`) into the binary.
*   **Output**: Produces compiled binaries and shared libraries; generates diagnostic build logs and status messages for the user.

#### 4. Dependencies
*   **Internal**: `morphologica` (located in the project root).
*   **External Libraries**:
    *   **Scientific Computing**: OpenCV, HDF5, Armadillo, LAPACK.
    *   **Graphics/Visualization**: OpenGL, glfw3, Freetype.
    *   **Data Handling**: jsoncpp.
    *   **Parallelization**: OpenMP.

#### 5. Analysis Methods
While the file itself does not perform scientific analysis, it enables high-performance computation by explicitly linking **LAPACK** (linear algebra) and **Armadillo** (C++ linear algebra library), and enables **OpenMP** for multi-threaded parallel processing.

#### 6. Figures/Outputs
*   **Primary Output**: Compiled shared library or executable binary (in the `lib/` directory).
*   **Console Output**: Provides feedback on the installation prefix, operating system detection, and library finding status during the configuration phase.

#### 7. Key Parameters
*   `CMAKE_CXX_STANDARD`: Set to **17** (C++17).
*   `CMAKE_OSX_DEPLOYMENT_TARGET`: Hardcoded to **10.14** for macOS compatibility.
*   `MORPH_FONTS_DIR`: A dynamic path variable that maps to the `morphologica/fonts` directory.
*   `DEBUG_VARIABLES`: An optional toggle (default: OFF) that, if enabled, prints all CMake variables for debugging the build environment.

---

## LICENSE.txt

### Code Analysis Summary: `LICENSE.txt`

1. **Purpose**
   This file contains the full legal text of the **GNU General Public License (GPL) version 3**, a copyleft license used to ensure the software remains free and open-source. It provides the legal framework governing the distribution, modification, and usage rights of the repository's source code.

2. **Key Functions/Classes**
   *   **N/A**: As a legal document, this file does not contain functional code, classes, or executable logic. It serves as a regulatory document rather than a program component.

3. **Data Flow**
   *   **Processes**: It dictates the "data flow" of the source code by stipulating that any modified version or derivative work must also be licensed under the GPLv3, ensuring the availability of the "Corresponding Source" to recipients.

4. **Dependencies**
   *   **N/A**: This is a standalone text document; it has no code-level dependencies on other repository files.

5. **Analysis Methods**
   *   **N/A**: No scientific or statistical methods are implemented. It is a legal contract governing software copyright.

6. **Figures/Outputs**
   *   **N/A**: This file does not generate visual plots, figures, or computational outputs.

7. **Key Parameters**
   *   **N/A**: There are no configurable parameters or variables. However, the license enforces specific requirements on developers, such as:
       *   **Retention of Notices**: Requirement to keep copyright and warranty disclaimers intact.
       *   **Source Provision**: Mandate to provide "Corresponding Source" when distributing object code.
       *   **Copyleft Clause**: The requirement that derivative works must be released under the same license terms.

---

## README.md

This README file serves as the primary documentation and user manual for **Stalefish**, a scientific software tool designed for reconstructing 3D gene expression surfaces from 2D *in situ* hybridization (ISH) brain slice images.

### 1. Purpose
Stalefish allows neurobiologists to reconstruct 3D gene expression surfaces from sets of 2D brain slice images, which can then be "unwrapped" into 2D maps for further spatial analysis. It provides a specialized environment for manual curve annotation, 3D mesh construction, and data alignment.

### 2. Key Functions/Utilities
*   **`stalefish`**: The main executable for the user interface, used for defining sampling curves on images and performing alignment.
*   **`sfmakejson`**: A utility tool to generate project configuration files from a set of input images.
*   **`sfgetjson`**: A utility to extract configuration data from an existing HDF5 project file.
*   **`sfview`**: A C++-based visualization tool for rendering 3D expression surfaces and 2D unwrapped maps.

### 3. Data Flow
*   **Input**: Takes a set of brain slice images (e.g., `.png`) and a configuration file (`.json`).
*   **Processing**: Users manually define curves on images; the program computes mean luminance along sampling bins to create 3D meshes stored in HDF5 (`.h5`) format.
*   **Output**: Generates HDF5 project files and can export 2D unwrapped expression maps for further image analysis.

### 4. Dependencies
*   **Language/Build**: C++, CMake, Git.
*   **Core Libraries**: `morphologica` (included as a submodule), `OpenCV`, `Armadillo`, `GLFW`, `HDF5`, `FreeType`, `libpopt`, `libomp`.
*   **OS Packages**: Requires various system-level dev libraries (e.g., `freeglut3-dev`, `liblapack-dev`).

### 5. Analysis Methods
*   **Curve Fitting**: Manual annotation of anatomical features with automated fitting of sampling bins along the curves.
*   **Background Subtraction**: Uses Gaussian blurring (controlled by `bg_blur_screen_proportion`) to estimate and subtract background luminance from ISH images.
*   **Spatial Normalization**: Alignment of brain slices using user-defined landmark points and curve-based fitting across the stack.
*   **Digital Unwrapping**: Geometric transformation to flatten 3D meshes into 2D gene expression maps.

### 6. Figures/Outputs
*   **3D Meshes**: Rendered as sphere meshes in `sfview`.
*   **2D Maps**: Flattened representations of 3D expression surfaces.
*   **HDF5 Projects**: Comprehensive data storage containing images, alignment parameters, and expression values.

### 7. Key Parameters
*   **`pixels_per_mm`**: Calibrates image resolution.
*   **`thickness`**: Defines the physical depth of individual brain slices.
*   **`bg_blur_subtraction_offset`**: Tuning parameter for signal-to-noise ratio adjustment.
*   **`save_per_pixel_data`**: Toggle to record granular raw signal values (increases output file size).
*   **`scaleFactor`**: Down-sampling factor to optimize GUI performance and file storage.

---

## Stalefish_Analysis_Correlations_3.5.21.ipynb

This file is a Jupyter Notebook used for the comparative analysis of gene expression data (likely *in situ* hybridization) between mouse and vole brain samples.

### 1. Purpose
The notebook performs spatial correlation analysis of gene expression maps (stored as HDF5 files) to quantify similarities across different brain layers (L2/3, L5, L6) and species (mouse vs. vole). It uses transformation files (`.TF.`) to align spatial expression data and generates statistical summaries and visualizations of these correlations.

### 2. Key Functions/Classes
*   **`getZ(fname)`**: Opens an HDF5 file, extracts resampled coordinates and expression values, and reshapes them into a 2D matrix representing the expression spatial map.
*   **`getMask(Z, T)`**: Generates a binary mask of pixels where the expression value is below a specified threshold `T`.
*   **`combi(fnames, thresh)`**: Takes a list of HDF5 files, iterates through them to generate aligned 3D stacks of expression data, and applies a common mask (NaNs) to regions below the threshold.

### 3. Data Flow
*   **Input**: Reads multiple `.h5` files containing resampled spatial coordinates and gene expression data. Many files follow a naming convention indicating the source, target, and transformation matrix (e.g., `[Source].TF.[Target].h5`).
*   **Processing**: Extracts raw data, reshapes it, filters via thresholding to remove low-expression noise, and flattens the maps into vectors for cross-correlation.
*   **Output**: Produces statistical summaries (mean $\pm$ std) of correlation coefficients and exports PDF plots of correlation matrices and bar charts.

### 4. Dependencies
*   **Data Handling**: `h5py`, `numpy`, `pandas`.
*   **Visualization**: `matplotlib.pyplot`, `pylab`, `seaborn`, `cv2` (OpenCV).
*   **Statistical/Math**: `scipy`, `sklearn` (preprocessing modules), `statsmodels`.
*   **Image Processing**: `PIL` (Pillow).

### 5. Analysis Methods
*   **Spatial Correlation**: Calculates Pearson correlation coefficients (`np.corrcoef`) between flattened gene expression maps across different layers or species.
*   **Grouping/Classification**: Uses predefined category lists (`c` arrays) to group correlations into meaningful biological comparisons (e.g., intra-layer vs. inter-layer, or cross-species comparisons).
*   **Masking**: Uses threshold-based masking to ignore background or low-expression regions during statistical comparison.

### 6. Figures/Outputs
*   **Heatmaps**: Correlation matrices (`pcolor`) displaying the similarity between different sample files.
*   **Bar Charts**: Comparative plots showing mean correlation coefficients with error bars (standard deviation) grouped by experiment conditions (e.g., "L23/L23", "L23/L5", "Mouse/Vole").
*   **PDF Exports**: Generates files such as `_all.pdf`, `MouseCorrs.pdf`, and `MouseVolRZRCorr_matrix.pdf`.

### 7. Key Parameters
*   **`thresh` / `T`**: The expression threshold (e.g., `0.00074` or `0.0008`) used to mask out background signal.
*   **`c` (Class array)**: An integer-based mapping array used to categorize samples for group-wise statistical comparison (e.g., assigning files to "L23", "L5", or "L6" categories).
*   **Plotting bounds**: Fixed parameters for bar plot visualization (`minV = -0.5`, `maxV = +1.25`, `nbars`).

---

## Stalefish_Analysis_Single_Brain.ipynb

### File Summary: `Stalefish_Analysis_Single_Brain.ipynb`

#### 1. Purpose
This notebook provides a pipeline for processing and visualizing neural imaging data stored in HDF5 (`.h5`) files generated by the "Stalefish" analysis software. It focuses on scaling box-level signal intensities, interpolating spatial data across slices, and generating heatmaps for anatomical brain visualization.

#### 2. Key Functions/Classes
*   **`stalefish` (Class)**: Encapsulates the core logic for parsing HDF5 files and performing "within-box" signal scaling.
    *   `box_scaling()`: Iterates through HDF5 slices and boxes, applying statistical transformations (mean, z-score, min-max, etc.) to the raw signals.
*   **`single_scaling()`**: Helper function (outside class) to apply various normalization methods (standardization, background normalization) to individual box frames.
*   **`slice_scale()`**: Applies "within-slice" scaling to normalize mean signal intensities across an entire slice of the brain.

#### 3. Data Flow
1.  **Read**: Ingests `.h5` files containing raw brain signal data (`nframes`, `means`, `sbox_linear_distance`).
2.  **Transform**: Processes data through hierarchical scaling (Within-Box $\rightarrow$ Within-Slice).
3.  **Interpolate**: Aligns data across different slice lengths using 1D interpolation (`scipy.interpolate.interp1d`).
4.  **Visualize**: Pivots processed DataFrames to create signal heatmaps or renders polygon-based anatomical plots.

#### 4. Dependencies
*   **Data/Math**: `h5py`, `numpy`, `pandas`, `scipy`, `scikit-learn` (`minmax_scale`, `scale`).
*   **Visualization**: `matplotlib`, `seaborn`, `PIL`.
*   **Image Processing**: `skimage` (measure, skeletonize, filters), `scipy.ndimage` (shift, gaussian_filter).

#### 5. Analysis Methods
*   **Statistical Normalization**: Z-score calculation, min-max scaling, and background-level normalization.
*   **Interpolation**: 1D linear interpolation to standardize spatial axes across disparate brain slices.
*   **Signal Processing**: Gaussian filtering for smoothing heatmaps.
*   **Spatial Mapping**: Polygon-based rendering of 3D brain structure flattened into 2D heatmaps.

#### 6. Figures/Outputs
*   **Heatmaps**: Generates `seaborn` heatmaps displaying normalized signals (mean-centered, min-max) across slice linear distances.
*   **Flattened Heat Plot**: A custom matplotlib figure using `matplotlib.patches.Polygon` to render a 2D map of the brain slice, accounting for varying slice thicknesses.

#### 7. Key Parameters
*   **`background_level`**: Used for background normalization (set to `0.85` in the example).
*   **`bin_number`**: Determines the resolution/grouping for slice alignment.
*   **`true_start_slice`**: Configurable offset parameter for slice alignment.
*   **`interp_list`**: Defines which signal features to interpolate (e.g., `slice_mean_center`, `slice_z_score`).

---

## Stalefish_Combined_Cases_CONTROL.ipynb

### Analysis of `Stalefish_Combined_Cases_CONTROL.ipynb`

#### 1. Purpose
This notebook aggregates and normalizes neuroanatomical expression data (e.g., *Id2* expression) across multiple experimental subjects ("cases"). It standardizes data across different brains by performing slice-wise interpolation and mean-centering, ultimately generating a population-average heatmap.

#### 2. Key Functions/Classes
The script relies primarily on `pandas` for data manipulation and `scipy.interpolate` for spatial normalization.
*   **`interpolate.interp1d`**: Used to map sparse/variable experimental data onto a uniform linear distance grid (`sbox_lin_dist`) for consistent cross-subject comparisons.
*   **`pandas.pivot`**: Used to restructure the data into matrix formats suitable for visualization.
*   **`sns.heatmap`**: Used for the final visualization of the averaged spatial distribution of expression.

#### 3. Data Flow
*   **Input**: Loads three types of CSV files for each subject (e.g., `17_299.csv`, `17_299_interp.csv`, and `17_299_sliceminmax.csv`).
*   **Processing**:
    1.  Labels data with case identifiers.
    2.  Calculates global bounds for interpolation based on the intersection of min/max values across all subjects.
    3.  Performs linear interpolation on normalized features (mean-centered, z-scored, or min-max scaled).
    4.  Aggregates (averages) values for every `sbox_lin_dist` coordinate across all subjects.
*   **Output**: Exports processed data (optional) and generates heatmap figures representing the "average brain."

#### 4. Dependencies
*   **Data Handling**: `pandas`, `numpy`.
*   **Visualization**: `matplotlib.pyplot`, `seaborn`.
*   **Scientific/Image Processing**: `scipy` (interpolation, ndimage), `scikit-image` (`skimage` modules for morphology, though imported, the specific morphology functions are not actively used in the provided snippet).

#### 5. Analysis Methods
*   **Mean-Centering/Scaling**: Pre-processes data within slices to account for intensity variations across subjects before aggregation.
*   **Linear Interpolation**: Resolves discrepancies in sample spacing by remapping data to a fixed, common step size (`0.005`) for all subjects.
*   **Group Averaging**: Calculates the population mean expression per spatial coordinate across all subjects.

#### 6. Figures/Outputs
*   **Individual Heatmaps**: Generates 6 separate heatmaps (one per subject) visualized using `seaborn` to check data quality/consistency.
*   **Population Average Heatmap**: A final aggregate heatmap representing the average *Id2* expression across the control group (n=6).

#### 7. Key Parameters
*   **Interpolation Step (`0.005`)**: The resolution used for resampling the linear distribution of the "sbox" (likely a region of interest or cortical box).
*   **Slice Range**: Dynamically determined by calculating the maximum of the lower bounds and the minimum of the upper bounds across all subjects to ensure valid interpolation regions.

---

## Stalefish_Combined_Cases_P4ENUC_all.ipynb

### Analysis of `Stalefish_Combined_Cases_P4ENUC_all.ipynb`

#### 1. Purpose
This notebook aggregates and normalizes spatial expression data from multiple biological specimens ("brains"). It interpolates localized coordinate data (`sbox_lin_dist`) across different slices to create a consistent spatial framework, allowing for the generation of a mean heatmap representing gene expression across the combined cases.

#### 2. Key Functions/Classes
*   **`pandas` methods**: Heavily relies on `read_csv`, `groupby`, `pivot`, and `concat` for data manipulation.
*   **`scipy.interpolate.interp1d`**: Used to perform one-dimensional linear interpolation to map data onto a uniform spatial grid.
*   **`seaborn.heatmap`**: Used to visualize the processed spatial expression data.

#### 3. Data Flow
*   **Input**: Reads multiple CSV files (e.g., `19_18_all.csv`, `19_47_all.csv` and their corresponding interpolation/min-max summary files).
*   **Processing**:
    1.  Concatenates case data and calculates global bounds for interpolation using `min_max_df`.
    2.  Iterates through slices to compute uniform ranges (`avg_min_max_list`).
    3.  Performs interpolation on scaling methods (`slice_mean_center`, `slice_z_score`, `slice_min_max`).
    4.  Aggregates processed data across all brains and calculates the mean value per `sbox_lin_dist`.
*   **Output**: Generates visualization heatmaps and provides an option to export the aggregated mean data to a CSV file.

#### 4. Dependencies
*   **Data Science Stack**: `pandas`, `numpy`, `scipy`, `sklearn`.
*   **Visualization**: `matplotlib`, `seaborn`.
*   **Image/Morphology (Imported but mostly unused)**: `skimage` (includes `medial_axis`, `skeletonize`, `filters`, etc.), suggesting this script might be part of a larger pipeline involving image analysis.

#### 5. Analysis Methods
*   **Spatial Normalization**: Uses linear interpolation to map non-uniform spatial coordinates (`sbox_lin_dist`) to a standardized interval for comparison across specimens.
*   **Statistical Scaling**: Implements within-slice normalization techniques, specifically **Mean Centering**, **Z-score transformation**, and **Min-Max scaling**.
*   **Averaging**: Calculates the population mean of interpolated expression values across multiple specimens for each spatial coordinate.

#### 6. Figures/Outputs
*   **Heatmaps**: Generates individual heatmaps per case (Cells 8-9) and a final averaged heatmap representing the "average brain" (Cell 17).
*   **CSV (Optional)**: Can produce `mean_heatmap_p36_id2_p4enuc.csv` (commented out in Cell 17).

#### 7. Key Parameters
*   **`xnew` step size**: Set to `0.005` in Cell 11; this determines the resolution of the interpolated spatial grid.
*   **Interpolation methods**: `slice_mean_center`, `slice_z_score`, `slice_min_max` are the primary variables being scaled.
*   **Slice indices**: Referenced via `True_Order` and `slice` columns, which act as the primary grouping variables for the biological specimens.

---

## allen/CMakeLists.txt

This analysis covers the `allen/CMakeLists.txt` file, which is a build configuration script for a C++ utility focused on scientific data comparison.

### 1. Purpose
This file serves as the build configuration for the `compare` executable, which integrates computer vision and linear algebra libraries to perform analysis on data. It automates the compilation process by linking the necessary external dependencies to the source code.

### 2. Key Functions/Classes
*   **`compare` (Executable)**: The primary output of this build script, compiled from `compare.cpp`. It acts as the command-line interface for the project's comparison logic.

### 3. Data Flow
*   **Input**: The script processes source files (`compare.cpp`) and links against external library headers.
*   **Processing**: By linking OpenCV and Armadillo, the executable likely performs matrix-based computations or image-based data comparisons.
*   **Output**: Produces a binary executable named `compare`.

### 4. Dependencies
*   **OpenCV**: Used for image/matrix processing and computer vision tasks.
*   **Armadillo**: Used for high-performance linear algebra and scientific computing.
*   **CMake**: Required to interpret this file and generate the build system.

### 5. Analysis Methods
*   **Linear Algebra**: Enabled via the Armadillo library, likely for statistical modeling or vector/matrix transformations.
*   **Computer Vision**: Enabled via OpenCV, likely for processing visual data or utilizing feature-matching algorithms to compare datasets.

### 6. Figures/Outputs
*   **Executable**: The final product is a binary (`compare`) which, when executed, likely prints comparison metrics, statistical differences, or diagnostic logs to the standard output (terminal).

### 7. Key Parameters
*   **`include_directories`**: Defines the search paths for OpenCV and Armadillo headers, ensuring the compiler can resolve necessary scientific math functions and image processing headers.
*   **`target_link_libraries`**: Defines the specific external library archives to be linked, ensuring that the compiled binary can execute complex mathematical and vision-related operations at runtime.

---

## allen/expt/readme.md

This is a structured analysis of the provided documentation file.

### 1. Purpose
The `allen/expt/` directory serves as the primary output destination for data retrieval scripts within the repository. It acts as a storage location for collected experimental images and their corresponding metadata in JSON format.

### 2. Key Functions/Classes
*   **N/A**: This is a documentation/directory manifest file rather than a source code file. It describes the intended use of the directory by the `retrieve.py` script.

### 3. Data Flow
*   **Writes**: Receives image files (e.g., TIFF, PNG) and associated metadata files (`.json`) generated by the `retrieve.py` script.
*   **Reads**: N/A (this directory acts as a sink for processed data).

### 4. Dependencies
*   **Internal**: `retrieve.py` (located elsewhere in the repository) is the script responsible for populating this directory.

### 5. Analysis Methods
*   **N/A**: No scientific or statistical methods are implemented within this file.

### 6. Figures/Outputs
*   **Images**: Stores raw or processed experimental images retrieved from external sources (e.g., Allen Institute databases).
*   **Metadata**: Stores `.json` files containing experimental parameters, identifiers, or descriptive data associated with the saved images.

### 7. Key Parameters
*   **N/A**: As a directory manifest, it defines no configurable parameters itself; however, the `retrieve.py` script likely uses parameters to define the specific naming conventions and organizational structure within this folder.

---

## allen/genes.sh

### Structured Analysis: `allen/genes.sh`

#### 1. Purpose
This script automates the retrieval of a comprehensive list of gene metadata from the Allen Brain Atlas API specifically for the "Developing Mouse" (DevMouse) dataset.

#### 2. Key Functions/Classes
*   **`wget`**: A command-line utility used to perform an HTTP GET request to the Allen Brain Atlas RESTful API to download structured data.

#### 3. Data Flow
*   **Reads**: An external URL (Allen Brain Atlas API endpoint) containing specific query parameters.
*   **Writes**: A CSV file (by default saved as `query.csv?criteria=...`) in the local directory containing gene-related information.

#### 4. Dependencies
*   **`wget`**: Requires the `wget` network utility to be installed on the host system.
*   **Allen Brain Atlas API**: Relies on the external connectivity and availability of the `api.brain-map.org` service.

#### 5. Analysis Methods
*   **Data Retrieval**: The script utilizes API querying (a standard method for data extraction in bioinformatics) to filter and export genomic metadata based on relational criteria.

#### 6. Figures/Outputs
*   **Output**: A CSV file (default filename structure derived from the URL parameters) containing the following columns:
    *   `id`: Gene ID.
    *   `gene_symbol`: Gene acronym.
    *   `gene_name`: Full gene name.
    *   `entrez_gene_id`: Entrez identifier.
    *   `homologene_group_id`: Homologene database identifier.

#### 7. Key Parameters
*   **`products[abbreviation$eq'DevMouse']`**: Filters the query specifically for the Developing Mouse brain dataset.
*   **`num_rows=all`**: Ensures the API returns the entire dataset rather than a paginated subset.
*   **`order$eq'genes.acronym'`**: Sorts the output data alphabetically by the gene symbol.

---

## allen/plotcolors.py

### Code Analysis: `allen/plotcolors.py`

#### 1. Purpose
The script visualizes and validates the reverse-engineered color transformation used in the Allen Developing Mouse Brain Atlas. It generates 3D and 2D plots to illustrate how gene expression data is mapped to specific color channels (Red, Green, Blue).

#### 2. Key Functions/Classes
*   **`sebcolour.Colour()`**: A custom module/class used to define specific color palettes (e.g., `mediumpurple1`, `sapgreen`, `purple4`) for consistent aesthetic styling of the plots.

#### 3. Data Flow
*   **Input**: Reads data from `pydata.h5`, an HDF5 file containing processed color and expression variables generated by a predecessor MATLAB script (`plotcolors.m`).
*   **Processing**: Extracts multidimensional arrays representing expression values (`n_expr`, `ex`), transformed coordinates (`fully_transformed`), and regressed color components.
*   **Output**: Renders and saves a composite figure (`allencolors.svg`) containing three specific visualizations.

#### 4. Dependencies
*   **Standard/Scientific**: `h5py` (HDF5 reading), `matplotlib` (plotting), `numpy` (numerical array operations).
*   **Local/Repo**: `sebcolour` (a local custom module for color definitions).

#### 5. Analysis Methods
*   **Reverse-Engineering Validation**: Uses linear regression (implied by `greenred_calc` and the "best fit line" comment) to analyze the relationship between RGB channels in expressing pixels.
*   **Coordinate Transformation**: Implements geometric mapping (ellipsoids) to visualize how non-expressing and expressing pixels are separated in color space.
*   **Normalization**: Performs pixel-wise scaling (`/255.0`) and axis reorientation (`np.flip`) to match the color data for visualization.

#### 6. Figures/Outputs
*   **`allencolors.svg`**: A high-resolution figure featuring:
    *   **Subplot 1**: 3D scatter plot of Red/Green/Blue color space for expressing vs. non-expressing pixels with a best-fit regression line.
    *   **Subplot 2**: 3D scatter plot showing the "fully transformed" color space, including the boundaries of the transformed expression clusters.
    *   **Subplot 3**: 2D scatter plot correlating gene expression signals against the Blue color channel.

#### 7. Key Parameters
*   **Plotting Defaults**: Font is set to 'Arial', size 14, with SVG font embedding enabled for post-processing in software like Inkscape.
*   **View Angles**: `axim` (azimuth) = -22 and `elev` (elevation) = 39 are used to standardize the viewing perspective for the 3D plots.
*   **Marker Aesthetics**: Marker size (`s=60` to `80`) and edge colors are defined to improve clarity between expression clusters.

---

## allen/retrieve.py

This analysis covers `allen/retrieve.py`, a script designed to interact with the Allen Developing Mouse Brain Atlas API.

### 1. Purpose
This script automates the retrieval of histological image data and metadata for specific developmental experiments from the Allen Brain Atlas. It processes, registers, and formats this information into a JSON configuration file compatible with external visualization tools (specifically "Stalefish").

### 2. Key Functions/Classes
*   `getImageToImageOffsets_byid(images, x, y)`: Queries the Allen API to calculate spatial pixel offsets between a reference image and a sequence of section images.
*   `getImageToImageOffsets(images, x, y)`: A wrapper that reorganizes the offset dictionary by section number and sorts it.
*   `retrieve(exptstr, downsample, do_download_expr)`: The main orchestration function that handles experiment metadata retrieval, image downloading, registration (alignment), and final JSON output generation.

### 3. Data Flow
1.  **Input**: Takes an experiment ID (`exptstr`) via command-line arguments.
2.  **API Requests**: Fetches experiment metadata (thickness, plane) and image lists from `api.brain-map.org`.
3.  **Processing**: Calculates resolutions, performs image registration via offset queries, and creates a structured directory (`./expt/[exptstr]`).
4.  **Output**: Downloads raw image files (as `.jpg`) and writes a formatted `[exptstr].json` file containing metadata, spatial offsets, and color transformation parameters.

### 4. Dependencies
*   `requests`: Used for HTTP communication with the Allen Brain API.
*   `json`: Used for parsing and generating JSON configuration files.
*   `collections`: Used to maintain order in dictionary structures.
*   `os`: Used for local directory and file system management.

### 5. Analysis Methods
*   **Image Registration**: Implements a 2D registration approach by querying `image_to_image_2d` to retrieve X/Y coordinate offsets. It performs two queries at different coordinates (1000,1000 and 2000,2000) to account for both translation and potentially rotation across slices.
*   **Geometric Mapping**: Converts section numbers into axial positions based on `section_thickness` retrieved from metadata.

### 6. Figures/Outputs
*   **Images**: Downloads original ISH (In Situ Hybridization) images and optionally expression-view images, saved as `.jpg` files in an experiment-specific folder.
*   **Metadata**: A JSON file (`[exptstr].json`) containing:
    *   Slice sequence information.
    *   Resolution and axial positioning.
    *   Hardcoded color transformation parameters (`colour_trans`, `colour_rot`, `ellip_axes`).

### 7. Key Parameters
*   `exptstr`: The experiment ID string used to query the API.
*   `downsample`: Determines the resolution of the downloaded images (higher values result in smaller file sizes).
*   `do_download_expr`: Boolean flag determining whether to download expression-specific image views.
*   `section_thickness`: Derived from metadata (converted from micrometers to millimeters).

---

## allen/retrieve_forpaper.sh

This analysis provides a structured summary of the `retrieve_forpaper.sh` script, which serves as a workflow orchestration tool for a scientific research repository.

### 1. Purpose
This script automates the retrieval of specific developmental mouse gene expression datasets from the Allen Institute database. It acts as a reproducible configuration file to generate data used in the paper’s figures, specifically targeting gene "Id2."

### 2. Key Functions/Classes
*   **`python3 retrieve.py`**: This is the primary execution command. It is a standalone Python script (external to this shell file) that performs the API calls or data fetching operations.

### 3. Data Flow
*   **Input**: The script takes numerical ID arguments (e.g., `100076267`) representing specific developmental time points or experiment IDs from the Allen Institute’s database.
*   **Processing**: The script triggers the `retrieve.py` utility, which presumably queries the Allen Institute API, downloads relevant gene expression data, and formats it for local use.
*   **Output**: Although not explicitly named, the script outputs data files (likely CSV, JSON, or NPY formats) intended for downstream analysis or visualization.

### 4. Dependencies
*   **`retrieve.py`**: A local Python script residing in the same directory.
*   **Allen Institute API**: Implicitly depends on network access to the Allen Brain Atlas or related public data repositories.
*   **Python 3**: Requires a Python 3 environment.

### 5. Analysis Methods
*   **Data Extraction/Ingestion**: The script implements a "fetch-on-demand" method to collect raw transcriptomic or developmental data. No complex statistical analysis is performed within this shell script; it serves strictly as a data retrieval pipeline.

### 6. Figures/Outputs
*   **Extended Data Figure 1**: The script specifically notes that the data retrieved for `100076267` (E18.5) is utilized for Extended Data Figure 1 in the associated publication.

### 7. Key Parameters
*   **`100076267`**: Identifier for the E18.5 developmental time point (active).
*   **`100081391`**: Identifier for the P4 developmental time point (commented out/deactivated).
*   **Hard-coded IDs**: The script relies on specific hard-coded biological experiment IDs, ensuring reproducibility for the exact datasets used in the research study.

---

## allen/sebcolour.py

This file serves as a utility module within a research repository, acting as a static color palette library for data visualization.

### 1. Purpose
The `sebcolour.py` file provides a centralized repository of color definitions (stored as RGB tuples) to be used for consistent color-coding in plots, charts, or graphical representations within the repository's research pipeline.

### 2. Key Functions/Classes
*   **`class Colour`**: A non-instantiated class containing a extensive list of static class attributes. Each attribute is named after a standard color (e.g., `indian_red`, `forestgreen`) and mapped to a tuple of three normalized floating-point values (0.0 to 1.0) representing the Red, Green, and Blue (RGB) components.

### 3. Data Flow
*   **Reads/Processes**: The file does not perform active data processing; it serves as a static data provider. It is intended to be imported by other modules in the repository that require specific color values for rendering tasks.
*   **Writes**: N/A (The file contains hard-coded values only).

### 4. Dependencies
*   **External**: None. This file uses standard Python syntax and does not require external libraries (such as `matplotlib` or `numpy`), though it is designed to be compatible with them.
*   **Internal**: None. It is a standalone utility module.

### 5. Analysis Methods
*   **None**: This module is strictly descriptive rather than analytical. It provides the metadata (color definitions) for visual analysis tools rather than performing numerical computations or statistical modeling.

### 6. Figures/Outputs
*   **Outputs**: The file itself outputs nothing. It provides the raw constants used by other modules to generate graphical outputs (e.g., plots or heatmaps) elsewhere in the repository.

### 7. Key Parameters
*   **RGB Tuples**: The core data units are tuples `(R, G, B)`, where each value is a float between 0.0 and 1.0. 
*   **Legacy Metadata**: Each attribute includes a comment (e.g., `# ,176,23,31`) that provides the original integer-based (0–255) color values, serving as a reference to the source website (cloford.com) from which the data was curated.

---

## allen/template_mouse_brain/retrieve_P56_coronal.sh

This file is a shell script designed to automate the retrieval of standard neuroimaging template data from the Allen Mouse Brain Atlas using an auxiliary Python utility.

### 1. Purpose
This script automates the downloading/retrieval of structural MRI data and corresponding anatomical annotations for the P56 (postnatal day 56) mouse brain from the Allen Institute’s Common Coordinate Framework (CCF).

### 2. Key Functions/Classes
*   **`retrieve_template.py`**: While not defined in this file, this is the core Python script invoked by the shell. It likely handles API requests or local filesystem checks to fetch specific atlas volumes based on the provided IDs.

### 3. Data Flow
*   **Input**: The script uses hardcoded IDs (`602630314`) and parameters (`3`, `1`) to specify which volumes to request.
*   **Process**: It executes two sequential calls to the Python retrieval utility.
*   **Output**: It writes structural MRI data and anatomical annotation files (likely in NIfTI or NRRD format) to the local directory.

### 4. Dependencies
*   **`retrieve_template.py`**: A local Python script within the repository that likely uses the `allensdk` (Allen Institute Software Development Kit) to interface with the Allen Brain Atlas API.

### 5. Analysis Methods
*   **Atlas Registration/Retrieval**: The script facilitates data acquisition for template-based analysis, common in neuroimaging pipelines where individual subject brains are registered to a standard template (the P56 atlas).

### 6. Figures/Outputs
*   **Structural MRI Volume**: A 3D volumetric file representing the mouse brain structure.
*   **Annotation Volume**: A 3D volumetric file (label map) that identifies specific neuroanatomical regions (parcellation).

### 7. Key Parameters
*   **`602630314`**: The unique identifier for the specific Allen Mouse Brain template version (P56).
*   **`3`**: The downsampling factor (specifying the resolution of the retrieved volumes).
*   **`1` (second argument in the second call)**: A flag indicating that the user is requesting the "annotations" (segmentation map) rather than the raw structural data.

---

## allen/template_mouse_brain/retrieve_template.py

### Structured Analysis: `retrieve_template.py`

#### 1. Purpose
This script automates the retrieval of mouse brain atlas image slices and their associated spatial metadata from the Allen Developing Mouse Brain Atlas API. It processes these images to generate a formatted JSON configuration file compatible with external visualization/analysis tools (e.g., "Stalefish").

#### 2. Key Functions/Classes
*   **`retrieve(atlasstr, ...)`**: The main controller; coordinates directory creation, API queries for image metadata, image downloading, registration calculations, and final JSON output.
*   **`getImageToImageOffsets_byid(...)`**: Queries the Allen API to calculate spatial offsets between different image slices to support alignment.
*   **`getImageSliceX(...)`**: Maps section images to their relative physical coordinates along the reference axis.
*   **`getImageSliceX_byid(...)`**: Interacts with the `image_to_reference` API endpoint to obtain the X-position for individual brain slices.

#### 3. Data Flow
*   **Input**: Takes an `atlas_number` (string) and optional `downsample` factor via command-line arguments.
*   **Processing**: 
    *   Queries the Allen API for slice lists and metadata (resolution, section numbers).
    *   Downloads `.jpg` images from the API to a local `./atlas/` directory.
    *   Calculates relative spatial offsets and X-positions.
*   **Output**: Writes a structured `.json` file containing registration offsets, physical slice coordinates, resolution, and hardcoded color transformation parameters.

#### 4. Dependencies
*   `requests`: Used for handling HTTP/API requests.
*   `json`: Used for processing API responses and writing output.
*   `collections`: Used for ordering dictionaries to maintain sequence consistency.
*   `os`: Used for file system management.

#### 5. Analysis Methods
*   **Image Registration (Heuristic)**: Implements a multi-point spatial offset calculation by sampling coordinates (1000, 1000 and 2000, 2000) across slices to determine alignment parameters.
*   **Metadata Normalization**: Calculates `pixels_per_mm` using image resolution metadata and user-defined downsampling factors.
*   **Spatial Mapping**: Converts slice numbering into physical `axial_position` and uses hardcoded color transformation matrices to standardize visual properties.

#### 6. Figures/Outputs
*   **Image Files**: Downloads a set of `.jpg` slices of the mouse brain.
*   **Configuration File**: Generates a `<atlas_number>.json` file summarizing the entire stack, including registration offsets, resolution, and transformation matrices.

#### 7. Key Parameters
*   **`atlasstr`**: The unique identifier for the specific brain atlas on the Allen Brain Atlas portal.
*   **`downsample`**: (Default: 2) The factor by which the image resolution is reduced (original dimensions divided by $2^{downsample}$).
*   **`do_download_annot`**: Boolean flag toggling between greyscale MRI-style images and colored annotation masks.
*   **`section_thickness`**: Hardcoded to `0.1` (mm) in the current implementation.

---

## allen/template_mouse_brain/threemaps.sh

This file is a shell script used to execute a specific visualization or data-processing command using the `sfview` utility within the Allen Institute’s mouse brain template research repository.

### 1. Purpose
The script executes the `sfview` application to overlay and visualize mouse brain volumetric data (H5 format) against a reference atlas. It serves as a batch command to align and view specific registered datasets from the Vole/Mouse research project.

### 2. Key Functions/Classes
*   **`sfview`**: The primary executable (located in `./build/src/`) designed for viewing and manipulating neuroanatomical volumetric data.

### 3. Data Flow
*   **Reads**:
    *   `atlas/602630314_annot/602630314_annot.h5`: Reference brain atlas annotations.
    *   `P9_Mouse_2_Litter_4_RZRB.h5`: A specific experimental mouse brain sample.
    *   `~/gdrive_inshare/Stalefish/SebJames/Vole_P1/Rzrb/46_12A_rzrb_L4.h5`: An external experimental file (Vole/Mouse specimen).
*   **Processes**: Loads these three volumetric files into a common coordinate space for comparative analysis.
*   **Writes**: N/A (this script performs interactive visualization).

### 4. Dependencies
*   **`sfview` binary**: The core visualization tool compiled from the repository's source code.
*   **HDF5 Files**: Requires the H5 data format for all volumetric inputs.

### 5. Analysis Methods
*   **Volumetric Overlay**: Uses spatial registration parameters to align multiple datasets into a common view.
*   **Coordinate-based Clipping**: Implements spatial trimming via defined coordinate boundaries to isolate regions of interest within the 3D volume.

### 6. Figures/Outputs
*   **Interactive Visualization**: Launches a graphical interface displaying the combined spatial data of the atlas and the two experimental specimens, allowing for manual inspection of alignment and anatomical features.

### 7. Key Parameters
*   **`-a`**: Likely enables the atlas overlay mode.
*   **`-m1`**: Specifies the rendering or blending mode for the first dataset.
*   **`-M=16,36`**: Defines specific intensity mapping or data range thresholds for the visualization.
*   **`-T`**: Likely toggles transparency or texture mapping for the overlay.
*   **`-x -0.5,12,-23,12`**: Defines the spatial clipping boundaries (or "axes") to crop the view to specific coordinates in the 3D brain space.

---

## data/CMakeLists.txt

This file is a configuration script for the CMake build system, specifically designed for managing project data assets.

### 1. Purpose
This file manages the installation process for example data files required by the project. It ensures that the `vole_65_7E_id2_L23.h5` dataset is correctly moved to the designated data directory during the software installation process.

### 2. Key Functions/Classes
*   **`install(FILES ...)`**: A standard CMake command that defines a rule to copy the specified file to the installation target directory (`TYPE DATA`) when the `make install` command is executed.

### 3. Data Flow
*   **Reads**: The file `vole_65_7E_id2_L23.h5` (expected to be located in the source directory).
*   **Writes**: Copies the specified `.h5` file into the system's installation data folder defined by the CMake project configuration.

### 4. Dependencies
*   **CMake**: Requires the CMake build system to process and execute the installation logic.
*   **Data File**: Requires the existence of `vole_65_7E_id2_L23.h5` within the repository structure.

### 5. Analysis Methods
*   **None**: This is a build configuration file and does not contain scientific or statistical implementation logic.

### 6. Figures/Outputs
*   **Outputs**: During the installation phase, this results in the deployment of the `.h5` (Hierarchical Data Format) file to the project's install prefix, making it available for subsequent scientific analysis scripts or binaries.

### 7. Key Parameters
*   **`FILES`**: Specifies the path to the data source file.
*   **`TYPE DATA`**: A CMake keyword that tells the build system to place the file in the standard directory defined for project data (usually `share/<project_name>/`).

---

## mac/README.md

This file serves as a developer-facing documentation and instruction guide for creating a macOS application bundle for the software project "Stalefish."

### 1. Purpose
This file provides a step-by-step workflow for developers to build, install, and package the Stalefish application into a distributable macOS `.dmg` (disk image) format.

### 2. Key Functions/Classes
*   **`bundle.sh`**: A shell script located in the `mac/` directory that automates the creation of the macOS application bundle structure (`.app`) by gathering compiled binaries from their installation directory.

### 3. Data Flow
*   **Reads**: Source code from the `models/Stalefish` directory (via `git pull`).
*   **Processes**: Uses `cmake` to compile C++ source code into executable binaries.
*   **Writes**: Installs binaries to `/usr/local` (via `make install`) and generates an `.app` directory structure and a final `.dmg` installer file.

### 4. Dependencies
*   **`morphologica`**: Referenced as a potential submodule dependency that may need to be updated alongside Stalefish.
*   **`cmake`**: Used for the build configuration process.
*   **`make`**: Used for the compilation and installation process.
*   **External Documentation**: Relies on a third-party guide (linked medium.com article) for disk image creation steps.

### 5. Analysis Methods
*   **Build/Compilation**: Standard C++ build pipeline (CMake/Make) designed for macOS deployment.

### 6. Figures/Outputs
*   **`Stalefish.app`**: A macOS application bundle directory.
*   **`.dmg` file**: A disk image file ready for distribution to end-users.

### 7. Key Parameters
*   **`CMAKE_INSTALL_PREFIX`**: Configured to `/usr/local` to specify where binaries are installed.
*   **`CMAKE_OSX_DEPLOYMENT_TARGET`**: Configured to `10.14` to specify the minimum macOS version compatibility.

---

## mac/bundle.sh

This analysis pertains to the `mac/bundle.sh` script, which is part of the Stalefish repository’s macOS deployment pipeline.

### 1. Purpose
The script automates the creation of a standalone macOS application bundle (`Stalefish.app`) by gathering compiled binaries, resource files, and necessary dynamic libraries (`.dylib` files). It ensures the application is portable by resolving library dependencies via RPATH configuration.

### 2. Key Functions/Operations
*   **Asset Preparation**: Converts iconsets to `.icns` format and sets up the application bundle directory structure (`Contents/MacOS`, `Contents/Resources`).
*   **Dependency Management**: Copies required libraries (HDF5, Armadillo, OpenCV, etc.) into the bundle and uses `install_name_tool` to modify dynamic link paths.
*   **RPATH Configuration**: Configures binaries to search for libraries within the bundle using `@loader_path`, ensuring the app can run on systems without the specific development environment installed.
*   **Metadata Generation**: Dynamically writes the `Info.plist` file, which defines essential application properties like the bundle identifier and icon file.

### 3. Data Flow
*   **Reads**: 
    *   Compiled binaries from the `../build/src/` directory.
    *   Library files from `/usr/local/lib/` and `/opt/X11/lib/`.
    *   Example data (`vole_65_7E_id2_L23.h5`).
*   **Writes**: 
    *   An `Stalefish.app` directory tree.
    *   An `Info.plist` configuration file.
    *   `sf_icons.icns` (processed icon resource).

### 4. Dependencies
*   **External System Tools**: `iconutil`, `install_name_tool`.
*   **Internal Build**: Assumes the user has already run a local `cmake` build and install process.
*   **External Libraries**: Specifically requires HDF5, Armadillo, JSONCPP, OpenCV, `libomp`, `libpopt`, and `libfreetype`.

### 5. Analysis Methods
*   *None.* This is a build/deployment script; it does not perform scientific analysis or statistical processing.

### 6. Figures/Outputs
*   **Primary Output**: A macOS Application bundle (`Stalefish.app`) ready for distribution.
*   **Secondary Output**: `sf_icons.icns` (a binary macOS icon file).

### 7. Key Parameters
*   **`PROGRAM_LIST`**: Defines the list of binaries (`stalefish`, `sfview`, `sfresave`, `sfgetjson`, `sfmakejson`) to be bundled.
*   **`STALEFISH_LIBS`**: A comprehensive list of specific library versions (e.g., `libarmadillo.9.dylib`) that the application requires to function.
*   **`RPATHS_IN_EXE`**: A toggle (set to `1`) that dictates whether library path patching is required for the executable binaries.

---

## mac/sf_icons.iconset/sf_dafticon.sh

### Code Analysis Summary

**1. Purpose**
This script automates the generation of a macOS-compatible icon set (`.iconset`) by resizing a high-resolution source image into the various standard dimensions required by the Apple operating system.

**2. Key Functions/Classes**
*   **None**: This is a procedural Bash shell script; it does not contain defined functions or classes.

**3. Data Flow**
*   **Input**: Reads `sf_dafticon.png` (assumed to be a 1024x1024 source file).
*   **Processing**: Iterates through specific pixel dimensions, using the ImageMagick `convert` utility to perform downsampling/resizing.
*   **Output**: Writes multiple PNG files with specific naming conventions (e.g., `icon_16x16.png`, `icon_16x16@2x.png`, etc.) to the local directory.

**4. Dependencies**
*   **ImageMagick (`convert`)**: The script relies entirely on the ImageMagick command-line tool suite to perform image manipulation.

**5. Analysis Methods**
*   **Image Resampling**: Employs standard image scaling algorithms (defaulting to ImageMagick’s internal filters) to create multi-resolution assets. No scientific or statistical analysis is performed.

**6. Figures/Outputs**
*   **Output Files**: Generates a set of 10 PNG files:
    *   Standard resolutions: 16x16, 32x32, 128x128, 256x256, 512x512.
    *   Retina/High-DPI resolutions (@2x): 32x32, 64x64, 256x256, 512x512, and a copy of the 1024x1024 source as `icon_512x512@2x.png`.

**7. Key Parameters**
*   **Source Filename**: `sf_dafticon.png` (hardcoded).
*   **Target Resolutions**: 
    *   `16, 32, 128, 256, 512` (standard sizes).
    *   `32, 64, 256, 512` (doubled sizes for @2x assets).

---

## mac/sf_icons.iconset/sf_rendericon.sh

This file is a utility script used for asset preparation in a scientific software repository (likely related to a project named "Stalefish").

### 1. Purpose
The script automates the generation of a macOS-compatible icon set (`.iconset`) by resizing a base high-resolution 1024x1024 pixel image into multiple standard Apple-required dimensions.

### 2. Key Functions/Classes
This is a procedural Bash script; it does not utilize formal classes. Its primary operations are:
*   **Loop-based resizing**: Iterates through a set of standard dimensions to generate base icon files.
*   **Retina (@2x) generation**: Explicitly creates high-density variants of standard icons.
*   **File copying**: Duplicates specific assets to meet packaging requirements (e.g., Snap packages).

### 3. Data Flow
*   **Input**: Reads `sf_rendericon.png` (assumed 1024x1024).
*   **Process**: Performs image downsampling using the `convert` utility.
*   **Output**: Writes multiple PNG files with specific naming conventions (e.g., `icon_16x16.png`, `icon_16x16@2x.png`) and one copy renamed as `stalefish.png`.

### 4. Dependencies
*   **ImageMagick (`convert`)**: The script relies on the `convert` command-line tool, which is a standard part of the ImageMagick suite for image manipulation.
*   **Bash**: Requires a Unix-like shell environment.

### 5. Analysis Methods
*   **None**: This is an infrastructure/build script; it performs no scientific or statistical analysis.

### 6. Figures/Outputs
*   **Icon Assets**: Generates a set of 11 distinct PNG files:
    *   Standard sizes: 16x16, 32x32, 128x128, 256x256, 512x512.
    *   Retina sizes: 16x16@2x, 32x32@2x, 128x128@2x, 256x256@2x, 512x512@2x.
    *   Application alias: `stalefish.png`.

### 7. Key Parameters
*   **Source filename**: `sf_rendericon.png` (Hardcoded as the base input).
*   **Resizing ratios**: The script assumes a 1:1 input aspect ratio and applies specific pixel dimensions as defined in the `for` loop and individual `convert` commands.

---

## mac/sf_icons.iconset/sf_sliceicon.sh

Here is the structured analysis of the provided shell script:

### 1. Purpose
This script automates the generation of an macOS icon set by creating multiple resized versions of a single 1024x1024 source image (`sf_sliceicon.png`). It ensures the icon meets Apple's requirements for various display densities (standard and Retina/high-DPI) across different system contexts.

### 2. Key Functions/Classes
*   **`for` loop**: Iterates through a defined set of pixel dimensions (16, 32, 128, 256, 512) to generate standard resolution icon files.
*   **`convert` command**: Invokes ImageMagick to perform the actual image downscaling and file format output.
*   **`cp` command**: Performs a direct copy of the original 1024x1024 file to satisfy the naming requirement for the highest-resolution Retina icon (`icon_512x512@2x.png`).

### 3. Data Flow
*   **Input**: Reads one source file: `sf_sliceicon.png` (assumed 1024x1024 resolution).
*   **Processing**: Applies image resampling (scaling) based on target dimensions.
*   **Output**: Writes 10 distinct PNG files into the local directory with naming conventions compliant with macOS `.iconset` standards (e.g., `icon_16x16.png`, `icon_16x16@2x.png`).

### 4. Dependencies
*   **ImageMagick**: Relies on the `convert` command-line tool, which must be installed and in the system PATH.
*   **Environment**: Requires a Unix-like shell environment (bash).

### 5. Analysis Methods
*   **None**: This is a utility/automation script for graphical asset management and contains no scientific or statistical analysis.

### 6. Figures/Outputs
*   **Outputs**: Generates a set of 10 PNG files:
    *   Standard sizes: `icon_16x16.png`, `icon_32x32.png`, `icon_128x128.png`, `icon_256x256.png`, `icon_512x512.png`.
    *   Retina sizes: `icon_16x16@2x.png` (32x32), `icon_32x32@2x.png` (64x64), `icon_128x128@2x.png` (256x256), `icon_256x256@2x.png` (512x512), and `icon_512x512@2x.png` (1024x1024).

### 7. Key Parameters
*   **Target Resolutions**: The list `{16, 32, 128, 256, 512}` defines the target dimensions for the standard set.
*   **Source Filename**: `sf_sliceicon.png` is hardcoded as the source input.
*   **Scaling Factors**: Implicit logic (e.g., doubling the target size for `@2x` files) determines the resolution of high-density assets.

---

## mac/sfv_icons.iconset/sf_sliceicon.sh

### Code Analysis Summary: `sf_sliceicon.sh`

#### 1. Purpose
This script automates the generation of a macOS-compatible icon set (`.iconset`) by resizing a high-resolution source image into various standard dimensions required for high-DPI (Retina) and standard displays.

#### 2. Key Functions/Classes
*   **None**: The script is a procedural Bash shell script utilizing command-line utility calls rather than defined functions or classes.

#### 3. Data Flow
*   **Input**: Reads `sf_sliceicon.png` (assumed to be a 1024x1024 pixel source file).
*   **Processing**: Uses the ImageMagick `convert` utility to perform downsampling and scaling operations.
*   **Output**: Writes multiple PNG files with specific naming conventions (e.g., `icon_16x16.png`, `icon_16x16@2x.png`) into the local directory.

#### 4. Dependencies
*   **ImageMagick**: Requires the `convert` command-line tool to be installed and available in the system PATH.
*   **System**: Requires a Unix-like environment (macOS/Linux) with Bash support.

#### 5. Analysis Methods
*   **Image Processing**: Implements basic **Resampling/Interpolation** via ImageMagick to create derivative image assets from a master file.

#### 6. Figures/Outputs
The script generates a collection of 10 PNG files:
*   **Standard resolution**: `icon_16x16.png`, `icon_32x32.png`, `icon_128x128.png`, `icon_256x256.png`, `icon_512x512.png`.
*   **High-DPI (@2x) resolution**: `icon_16x16@2x.png`, `icon_32x32@2x.png`, `icon_128x128@2x.png`, `icon_256x256@2x.png`, `icon_512x512@2x.png` (a direct copy of the source).

#### 7. Key Parameters
*   **Source File**: `sf_sliceicon.png` (The primary image input).
*   **Resolution Targets**: 
    *   Standard sizes: `16, 32, 128, 256, 512`.
    *   Retina sizes: `32 (for 16@2x), 64 (for 32@2x), 256 (for 128@2x), 512 (for 256@2x)`.

---

## mac/sfv_icons.iconset/sfview_view.sh

### Code Analysis Report: `sfview_view.sh`

#### 1. Purpose
This script automates the generation of a macOS-compatible icon set (`.iconset`) by resizing a high-resolution source image into multiple standard dimensions. It ensures that the application icon is correctly scaled for various display densities (standard and Retina).

#### 2. Key Functions/Classes
*   **Shell Loop**: Iterates through a defined set of integer sizes to create standard 1x resolution icons.
*   **Image Scaling Commands**: Executes a series of individual resize operations to create high-density (@2x) variations.
*   **File Copying**: Performs direct copies for specific format requirements (Snap packaging).

#### 3. Data Flow
*   **Reads**: An input file named `sfview_view.png` (assumed to be 1024x1024 pixels).
*   **Processes**: Performs image downsampling using the `convert` utility.
*   **Writes**: Generates a collection of 10 PNG files with standard naming conventions (e.g., `icon_16x16.png`, `icon_16x16@2x.png`, etc.) and one standalone `sfview.png`.

#### 4. Dependencies
*   **ImageMagick (`convert`)**: The script relies entirely on the ImageMagick suite to handle image processing and resizing.
*   **Bash**: The execution environment.

#### 5. Analysis Methods
*   **None**: This is a utility/build script for UI asset management, not a scientific or statistical analysis file.

#### 6. Figures/Outputs
*   **Output Files**:
    *   Standard Icons: 16x16, 32x32, 128x128, 256x256, and 512x512.
    *   Retina Icons (@2x): 32x32, 64x64, 256x256, 512x512, and 1024x1024 (via copy).
    *   Snap Package Asset: `sfview.png`.

#### 7. Key Parameters
*   **Source Image Size**: Assumes an input size of 1024x1024 pixels for optimal downsampling quality.
*   **Resolution Targets**: 
    *   `16, 32, 128, 256, 512` (Standard).
    *   `32, 64, 256, 512` (Retina/High-DPI targets).

---

## mac/sfviewbundle.sh

This analysis covers the `mac/sfviewbundle.sh` script, a deployment utility used in a scientific research repository to package an application for macOS.

### 1. Purpose
This script automates the creation of a macOS application bundle (`Sfview.app`) for the "Stalefish" software suite. It packages the `sfview` executable with its necessary dynamic libraries and configuration files to ensure the application is portable and functional on other macOS systems.

### 2. Key Functions/Operations
*   **Icon Conversion:** Uses `iconutil` to compile an iconset into a standard `.icns` file.
*   **Directory Structuring:** Uses `mkdir` to generate the standard macOS `Contents/MacOS` and `Contents/Resources` directory hierarchy.
*   **Dependency Injection:** Copies binary executables and their associated dylibs (HDF5, Armadillo, OpenCV, etc.) into the bundle.
*   **Link Path Modification:** Uses `install_name_tool` to update dynamic library lookup paths (`@rpath`, `@loader_path`) within the binaries, ensuring the app can locate its bundled dependencies.
*   **Metadata Generation:** Generates an `Info.plist` file, which is required by macOS for application identification and configuration.

### 3. Data Flow
*   **Inputs:**
    *   `sfv_icons.iconset`: Source icons for the application.
    *   `../build/src/sfview`: The pre-compiled scientific visualization executable.
    *   System libraries: Various `.dylib` files found in `/usr/local/lib/` and `/opt/X11/lib/`.
*   **Outputs:** 
    *   `Sfview.app`: A self-contained macOS application directory.
    *   `Sfview.app/Contents/Info.plist`: The application property list.

### 4. Dependencies
*   **System Tools:** `iconutil`, `install_name_tool` (macOS development tools).
*   **Scientific/Computational Libraries:**
    *   **HDF5:** For hierarchical data storage.
    *   **Armadillo:** For C++ linear algebra.
    *   **OpenCV:** Extensive suite of libraries for image processing and computer vision.
    *   **Misc:** `libpopt` (command-line parsing), `libfreetype` (font rendering), `libomp` (OpenMP).

### 5. Analysis Methods
*   **None.** This is a DevOps/deployment script, not a scientific computation script. It facilitates the distribution of software that likely performs scientific analysis, but the script itself contains no statistical or scientific algorithms.

### 6. Figures/Outputs
*   **Output:** The script generates an executable macOS `.app` bundle, which serves as the final distribution format for the user.

### 7. Key Parameters
*   `PROGRAM_LIST`: Defines which binaries to include in the bundle (currently `sfview`).
*   `STALEFISH_LIBS`: A hardcoded list of essential dynamic libraries required for the software to run.
*   `RPATHS_IN_EXE`: A toggle (1/0) that determines if the script should manually force library path updates using `install_name_tool` for specific dependencies.

---

## misc/README.md

Based on the provided content of `misc/README.md`, here is the structured analysis:

1. **Purpose**: 
   This file serves as a documentation placeholder providing external references for related neuroimaging tools. It directs users to the NeuroImaging Tools & Resources Collaboratory (NITRC) for additional resources.

2. **Key Functions/Classes**: 
   None. This is a text-based documentation file and contains no executable code.

3. **Data Flow**: 
   None. No data is processed, read, or written by this file.

4. **Dependencies**: 
   None. It provides an external link to a web resource (www.nitrc.org).

5. **Analysis Methods**: 
   None.

6. **Figures/Outputs**: 
   None.

7. **Key Parameters**: 
   None.

---

## misc/paper_figures/Fig_depth/Fig_depth.py

This file is a data visualization script designed for the Stalefish research project to generate depth-profile plots from processed HDF5 datasets.

### 1. Purpose
The script extracts depth and signal intensity data from a specific frame of an HDF5 file (`Fig_depth.h5`) to generate per-box scatter plots, averaged depth profiles, and a 2D surface map (heatmap) representing the spatial distribution of signal intensity.

### 2. Key Functions/Classes
*   **`h5py.File`**: Used as a context manager to access and iterate through the hierarchical HDF5 data structure.
*   **`np.histogram`**: Used for binning signal intensity data against depth to calculate mean profiles.
*   **`plt.imshow`**: Used to generate a 2D colormap (flatmap) representing signal intensity across both linear distance and depth.
*   **Custom Library `sebcolour`**: An external local module (`sc_`) used for consistent color palette selection.

### 3. Data Flow
*   **Input**: Reads data from `Fig_depth.h5` containing frames, box metadata (`nboxes`), box centers (`sbox_centers`), depth arrays (`box_depth`), and signal arrays (`box_signal`).
*   **Processing**: Calculates linear distance between box centers, computes mean signal intensities per depth bin, and aggregates these into a matrix (`msigs`).
*   **Output**: Saves multiple SVG files (individual box plots and a consolidated surface/flatmap plot) to the `./svg/` directory.

### 4. Dependencies
*   **Standard Libs**: `os`
*   **Scientific Stack**: `h5py`, `numpy`, `matplotlib`, `scipy.ndimage.interpolation`
*   **Local Dependencies**: `sebcolour` (A repository-specific color utility).

### 5. Analysis Methods
*   **Linear Distance Calculation**: Computes cumulative Euclidean distance (`dl`) between sequential spatial boxes based on their 3D coordinates.
*   **Binning/Averaging**: Uses weighted histogramming to compute the `mean_signal` at specific depth intervals, effectively smoothing raw data points.
*   **Coordinate Transformation**: Maps 1D signal/depth profiles into a 2D array (`msigs`) to visualize the cross-section of the specimen.

### 6. Figures/Outputs
*   **Individual Box Plots**: Scatter plot of raw signal vs. depth with an overlay of the averaged depth profile (exported per box as `.svg`).
*   **Surface Map**: A heatmap (`imshow`) showing signal intensity distribution across linear distance (x-axis) and depth (y-axis), exported as `FrameXXX_surf.svg`.

### 7. Key Parameters
*   **`filename`**: The source data file (`Fig_depth.h5`).
*   **`selected_frame`**: The specific time/spatial frame to analyze (default is `1`).
*   **`bins=100`**: Defines the resolution of the depth profiling histogram.
*   **`figsize=(6,3)`**: Controls the dimensions of the generated plots.
*   **`axs.set_xlim((0, 0.6))` / `ylim((0.2, 0.8))`**: Hard-coded view constraints for the signal-depth plots.

---

## misc/paper_figures/Fig_depth/sebcolour.py

### Code Analysis Summary: `misc/paper_figures/Fig_depth/sebcolour.py`

#### 1. Purpose
This file serves as a utility module that provides a comprehensive collection of predefined color constants (as RGB tuples normalized between 0 and 1) to be used for consistent color-coding in scientific visualizations.

#### 2. Key Functions/Classes
*   **`Colour` (Class)**: A container class holding hundreds of static attributes, each representing a specific color. Each attribute is a tuple of three floats (representing Red, Green, and Blue intensities normalized from 0–255 to 0.0–1.0).

#### 3. Data Flow
*   **Input**: None.
*   **Processing**: Acts as a hard-coded lookup table.
*   **Output**: Provides normalized RGB values when imported and accessed by other scripts (e.g., `sebcolour.Colour.indian_red`).

#### 4. Dependencies
*   **Standard Library Only**: This file does not depend on any external libraries or other files within the repository. It is a standalone "config" or "data" file.

#### 5. Analysis Methods
*   None. This module does not perform mathematical or statistical analysis; it is purely declarative.

#### 6. Figures/Outputs
*   **None directly**: The file itself does not generate figures. It is designed to be imported by plotting scripts within the `paper_figures` directory to define the color palettes used in published scientific charts.

#### 7. Key Parameters
*   **RGB Tuples**: The primary "parameters" are the RGB intensity values (e.g., `(0.6901960784, 0.0901960784, 0.1215686275)`). These values are hard-coded constants derived from external web resources for standard color naming conventions.

---
**Analyst Note:** The file appears to be a helper script designed to facilitate clean and readable code in plotting scripts by replacing arbitrary RGB numbers with semantic, human-readable color names. The commented-out integers (e.g., `# 176, 23, 31`) provide a reference to the original 0–255 integer scale used in standard web design.

---

## misc/paper_figures/Fig_depth/svg/README.md

This file is a documentation placeholder for a directory within a scientific research repository. Below is the structured analysis:

### 1. Purpose
This file serves as a directory-level README documenting the storage location for SVG-format depth images. It indicates that the images housed here are generated by an external Python script for the purpose of creating figures for a research paper.

### 2. Key Functions/Classes
*   **None**: As this is a Markdown documentation file, it contains no executable code, functions, or classes.

### 3. Data Flow
*   **Input**: The directory acts as a destination for output generated by a separate Python script (likely located elsewhere in the `misc/paper_figures/` directory structure).
*   **Output**: Stores static SVG image files representing processed depth data.

### 4. Dependencies
*   **External/Internal**: Depends on the parent Python script (implied) responsible for depth-map visualization and SVG rendering. No direct software dependencies are listed within this file.

### 5. Analysis Methods
*   **N/A**: This file is descriptive and does not contain algorithmic logic. However, the files stored in this folder are presumably results of **Depth Estimation** or **3D Scene Reconstruction** algorithms, converted into vector graphics for publication.

### 6. Figures/Outputs
*   **Outputs**: The folder is intended to contain Scalable Vector Graphics (SVG) files of depth maps. These are likely high-quality, resolution-independent plots used in the final version of the associated research paper.

### 7. Key Parameters
*   **N/A**: There are no configurable parameters defined in this file. Any parameters governing the output (such as colormaps, resolution, or normalization of the depth data) would be handled by the generation script that writes to this directory.

---

## misc/plot_contours.py

### Code Analysis: `misc/plot_contours.py`

#### 1. Purpose
This script processes spatial expression data stored in HDF5 files to visualize anatomical or expression-based contours. It applies Gaussian blurring techniques to detect features and produces comparative visualizations of multiple samples using matplotlib.

#### 2. Key Functions/Classes
*   **`getZ(fname)`**: Extracts 2D spatial expression data and coordinate dimensions from an HDF5 file and reshapes them into a 2D matrix.
*   **`getP(Z, T, k1, k2)`**: Performs image processing on the expression matrix, including flipping, background masking, and Difference of Gaussians (DoG) filtering to extract specific contour features.

#### 3. Data Flow
*   **Reads**: HDF5 files (specifically formatted with keys: `output_map/twod/expression_resampled` and `coordinates_resampled`).
*   **Processes**: Reshapes flat array data into grid structures, performs Gaussian smoothing/DoG filtering using OpenCV, and generates masked arrays for contour plotting.
*   **Outputs**: Renders interactive matplotlib figures showing grayscale intensity maps and overlaid colored contours.

#### 4. Dependencies
*   `numpy`: Numerical operations and array manipulation.
*   `pylab` / `matplotlib`: Visualization and plotting.
*   `h5py`: Interfacing with HDF5 scientific data files.
*   `cv2` (OpenCV): Image processing and Gaussian blurring.
*   `sys`: Handling command-line arguments for filter kernel sizes.

#### 5. Analysis Methods
*   **Difference of Gaussians (DoG)**: Used as a band-pass filter to isolate features (likely edges or localized high-expression regions) by subtracting a blurred version of the image from a less-blurred version.
*   **Masked Arrays**: Used to exclude background pixels (values below threshold `T`) from the contour calculation.
*   **Contour Extraction**: Uses `matplotlib.pyplot.contour` to identify and plot the boundary where the processed signal crosses zero.

#### 6. Figures/Outputs
*   **Figure 1**: A 1x3 grid displaying the raw, processed grayscale intensity maps for three input samples.
*   **Figure 2**: A 1x4 grid displaying individual samples with overlaid contours (Red, Green, Blue) and central crosshairs, followed by a final panel showing an overlay of all three samples' contours with transparency (`alpha=0.5`).

#### 7. Key Parameters
*   **`T` (Threshold)**: 0.0008; defines the value below which pixels are considered background/outside.
*   **`k1`, `k2` (Kernel Sizes)**: Configurable Gaussian kernel sizes for the DoG filter (defaults: 37 and 93). These control the scale of the features being detected.
*   **Input File Paths**: Currently hardcoded to `65_7E_id2_L23_3gl.h5`, `65_8A_id2_L23_3gl.h5`, and `66_6B_id2_L23_3gl.h5`.

---

## reading/README.md

This file is a documentation document for the **Stalefish** application. It serves as a schema guide for users needing to access and interpret HDF5 data files generated by the software.

### 1. Purpose
This `README.md` explains the internal structure and organization of HDF5 data files produced by the Stalefish research application. It provides guidance on how to interface with the data using various programming environments (Python, MATLAB, C++, etc.) and defines the hierarchical organization of brain slice data, landmarks, and expression signals.

### 2. Key Functions/Classes
*   **HDF5 Structure**: The repository uses `HDF5` for data persistence.
*   **`morph::HdfData`**: A C++ wrapper class specifically mentioned for interacting with the Stalefish HDF5 files.

### 3. Data Flow
*   **Input**: The Stalefish application writes brain slice preparation data into an HDF5 file.
*   **Processing**: Users can read these files to perform analysis on gene expression sampling, curve reconstruction, and slice alignment.
*   **Post-processing**: The application may add an `output_map` structure to the HDF5 file after a post-processing step (`sfview`).

### 4. Dependencies
*   **HDF5**: The underlying storage format.
*   **External tools/languages**: `h5py` (Python), `pandas` (Python), MATLAB, GNU Octave, and `h5dump`.

### 5. Analysis Methods
*   **Curve Fitting**: Uses Bezier curves defined by user-supplied points.
*   **Alignment**: Supports two methods for registering brain slices:
    *   **Auto-alignment**: Translates and rotates slices based on user-provided curve points.
    *   **Landmark-alignment (`lmalign`)**: Aligns slices based on user-supplied tissue landmarks.
*   **Signal Processing**: Includes background subtraction and linear normalization (0 to 1 range).
*   **Flattening/Unwrapping**: Generates 2D expression maps from 3D reconstructions.

### 6. Figures/Outputs
*   **Expression Maps**: 2D heatmaps generated by unwrapping 3D reconstructions.
*   **Resampled Maps**: Rectangular grid transformations of expression data for uniform analysis.
*   **Signal Statistics**: Means, standard deviations, and min/max values for sample boxes and freehand regions.

### 7. Key Parameters
*   **`nframes`**: Total number of brain slice frames.
*   **`pixels_per_mm`**: Image scale factor.
*   **`polyOrder`**: Order of the polynomial curve used for fitting.
*   **`binA`/`binB`**: Radial distances defining the start/stop of sampling bins from the fitted curve.
*   **`translation`/`theta`**: Transformation parameters applied during alignment processes.
*   **`nBinsTarg`**: Number of sampling bins along the fitted curve.

---

## reading/octave/README.md

This file serves as technical documentation providing a tutorial on how to interact with experimental data files using GNU Octave.

### 1. Purpose
This file provides a quick-start guide and examples for loading and inspecting HDF5-formatted data files (`.h5`) within a GNU Octave environment, specifically for the "Stalefish" research project.

### 2. Key Functions/Classes
*   **`load()`**: The primary Octave function used to import the HDF5 workspace (`V_Id2_1.h5`).
*   **`who`**: An Octave command used to list variables currently present in the workspace.

### 3. Data Flow
*   **Input**: The system reads `.h5` (HDF5) files containing multi-frame scientific data.
*   **Processing**: Data is loaded into the Octave workspace as a series of structs (`Frame000` through `Frame046`), representing hierarchical frame-based information.
*   **Inspection**: The user accesses internal struct fields (e.g., `class`, `box*`, `means`) and specific sub-properties (e.g., `pixels_per_mm`) to verify data integrity.

### 4. Dependencies
*   **GNU Octave**: Required for executing the provided commands.
*   **HDF5 Library**: Octave must have HDF5 support enabled to read the `.h5` files.
*   **Data File**: `V_Id2_1.h5` (expected to be located in the `Stalefish/ucr` directory).

### 5. Analysis Methods
*   **Data Structure Exploration**: The workflow demonstrates navigating complex, nested metadata structures typical of imaging or sensor-array research.
*   **Normalization/Scaling**: The presence of `means_autoscaled` and `pixels_per_mm` indicates pre-processing steps involving spatial calibration and intensity normalization.

### 6. Figures/Outputs
*   **Console Output**: The primary output is the console reflection of variable types, struct definitions, and raw numeric values (e.g., coordinate matrices like `PP000`).

### 7. Key Parameters
*   **`nBinsTarg`**: Set to `100` (represents target bin counts).
*   **`pixels_per_mm`**: Set to `233` (calibration factor for spatial measurements).
*   **`polyOrder`**: Variable influencing polynomial-based fitting or processing.
*   **`nframes`**: Indicates the temporal depth of the dataset (e.g., 47 frames).

---

## reading/python/Fig_depth.py

This file, `Fig_depth.py`, is a diagnostic and visualization script for the "Stalefish" research framework, designed to extract and plot spatial/signal data stored in HDF5 format.

### 1. Purpose
The script reads processed HDF5 experimental data to generate depth-profile plots and heatmaps for a specific data frame. It produces visualizations of signal strength versus depth for individual spatial "boxes," helping researchers analyze intensity distributions across a sample.

### 2. Key Functions/Classes
This script is written as a procedural flat script rather than using classes. It relies on standard library imports and the `matplotlib.pyplot` state-machine interface. No custom functions or classes are defined in this file.

### 3. Data Flow
*   **Input**: Reads an `.h5` file (e.g., `example_data/Fig_depth.h5`).
*   **Processing**:
    *   Extracts frame metadata (`nframes`, `nboxes`).
    *   Calculates linear distance (`Y`) based on 3D box centers.
    *   Performs binning/histogramming of signal intensities relative to depth.
*   **Output**: Writes SVG plots to a `./svg/` directory.

### 4. Dependencies
*   **Data/Math**: `h5py` (HDF5 handling), `numpy` (numerical arrays), `scipy.ndimage` (interpolation).
*   **Visualization**: `matplotlib` (plotting, including `axes3d`, `cm` colormaps, and patches).
*   **System**: `os` (directory handling).

### 5. Analysis Methods
*   **Linear Distance Mapping**: Calculates the cumulative Euclidean distance between box centers to map 3D spatial points to a 1D linear coordinate.
*   **Weighted Binning**: Uses `np.histogram` to aggregate `box_signal` values across `box_depth` bins.
*   **Signal Averaging**: Computes `mean_signal` per bin by dividing the weighted sum (hist) by the count per bin (hcounts).
*   **Heatmap Generation**: Uses `np.meshgrid` and `imshow` to create a 2D surface projection (`msigs.T`) of signal intensity as a function of depth and linear distance.

### 6. Figures/Outputs
*   **Depth Plots**: Individual SVG files for each box (`FrameXXX_boxYYY.svg`) displaying signal vs. depth with a trend line.
*   **Surface Heatmap**: A single summary SVG (`FrameXXX_surf.svg`) showing the aggregated "flatmap" of intensity across depth and linear distance.

### 7. Key Parameters
*   `filename`: Path to the input HDF5 data file.
*   `selected_frame`: Index of the frame to analyze (default: 1).
*   `bins=100`: The resolution of the depth histogram.
*   `mpl.rcParams`: Configuration settings for font aesthetics (Arial) and SVG output handling.
*   `axs.set_xlim` / `axs.set_ylim`: Hardcoded plot axes constraints (e.g., depth 0–0.6 mm, signal 0.2–0.8).

---

## reading/python/README.md

This file serves as a documentation guide for researchers to interactively explore scientific data stored in HDF5 format within the `Stalefish/ucr` project directory.

### 1. Purpose
This file provides a tutorial/example script for using Python to inspect the hierarchical structure and contents of HDF5 data files. It demonstrates how to navigate frame-based experimental data, such as geometric measurements and metadata.

### 2. Key Functions/Classes
*   **`h5py.File`**: The primary class used to open and interface with the HDF5 data container.
*   **`list()`**: Used in the interactive shell to explore the keys (groups/datasets) stored within the HDF5 structure.

### 3. Data Flow
*   **Input**: Reads an HDF5 file (`.h5`), specifically `V_Id2_1.h5`.
*   **Processing**: Accesses hierarchical groups labeled by frame (`FrameXXX`). Within each frame, it accesses nested datasets containing processed scientific results (e.g., `means`, `class`).
*   **Output**: Displays raw numerical datasets (arrays) and metadata associated with specific experimental frames (e.g., thickness, frame identifiers) to the console.

### 4. Dependencies
*   **`h5py`**: The standard Python library for interacting with HDF5 files.
*   **`ipython`**: Used as the interactive environment for the demonstration.

### 5. Analysis Methods
*   **Hierarchical Data Inspection**: Demonstrates the traversal of tree-structured experimental data.
*   **Data Extraction**: Shows how to extract specific scalar values (e.g., `thickness`) and vector/array data (e.g., `means` distribution) from the data containers.

### 6. Figures/Outputs
*   **Console Output**: The file provides expected terminal outputs showing the nesting structure of the data and the values within specific datasets, acting as a reference for users to verify their own data access.

### 7. Key Parameters
*   **Frame Indices**: The data is partitioned by time or spatial frames (`Frame000` through `Frame046`).
*   **Metadata Attributes**: Accesses experimental parameters like `pixels_per_mm`, `polyOrder`, and `thickness`, which appear to be crucial for defining the physical scale or model constraints of the data.

---

## reading/python/depth_plots.py

Here is the structured analysis of the provided code file:

### 1. Purpose
This script extracts data from "Stalefish" HDF5 files to generate diagnostic plots showing the relationship between depth and signal intensity for specific imaging frames. It is designed to visualize experimental data, such as ISH (In Situ Hybridization) expression, across varying depths.

### 2. Key Functions/Classes
The script is written as a procedural flat script rather than using classes or modular functions. It utilizes:
* **`h5py` methods**: Used to traverse the HDF5 hierarchical data structure and access specific scalar and array objects.
* **`matplotlib.pyplot` methods**: Used for rendering, formatting, and saving the visualization plots.

### 3. Data Flow
* **Input**: Reads an `.h5` data file (configured via `filename`).
* **Processing**: 
    1. Extracts total frame count metadata.
    2. Navigates to a specific frame (`selected_frame`) and retrieves the number of boxes defined within that frame.
    3. Iterates through each box to collect `box_depth` and `box_signal` data arrays.
* **Output**: Writes individual SVG plot files to a local directory `./plots/`.

### 4. Dependencies
* **Standard Library**: `os`
* **Scientific/Data Libraries**: `h5py` (HDF5 interface), `numpy` (numerical handling), `scipy` (specifically `scipy.ndimage.interpolation.shift`, though unused in this specific snippet), `matplotlib` (plotting).

### 5. Analysis Methods
* **Data Extraction**: Parses hierarchical HDF5 keys constructed via string formatting (e.g., `Frame{x}/lmalign/box_depth/box{y}`).
* **Visualization**: Performs scatter plotting of signal intensity versus depth, enforcing specific axis limits and labels relevant to the underlying biological or physical experiment.

### 6. Figures/Outputs
* **Output Format**: Saves plots as `.svg` files with vector graphics support (optimized for editing in Inkscape).
* **Content**: Scatter plots showing `Depth (mm)` on the x-axis and `ISH expression` (signal intensity) on the y-axis for individual detected boxes.

### 7. Key Parameters
* `filename`: The path to the source HDF5 data file.
* `selected_frame`: The specific numerical index of the frame to be analyzed.
* **Plotting Defaults**: Custom font configurations (Arial, size 18) and SVG rendering settings (`svg.fonttype = 'none'`) to ensure compatibility with vector editing software.

---

## reading/python/plot_one.py

This analysis provides a structured summary of the `reading/python/plot_one.py` script.

### 1. Purpose
This script processes 2D spatial maps exported in HDF5 format by the `sfview` tool. It visualizes these maps by applying a threshold-based mask to the data, generating a visual representation of the resampled coordinates, and saving the output as an image file.

### 2. Key Functions/Classes
*   **`getZ(fname)`**: Opens an HDF5 file, extracts resampled coordinate and expression data, and reshapes the 1D arrays into 2D grids based on the metadata dimensions.
*   **`getMask(Z, T)`**: Generates a boolean mask based on a threshold value `T`, flagging values below the threshold for exclusion.
*   **`combi(fnames, thresh)`**: Iterates through a list of file paths to aggregate multiple 2D maps and their corresponding masks into 3D NumPy arrays (stacking the depth dimension).

### 3. Data Flow
*   **Input**: HDF5 files containing `output_map` hierarchy (specifically `coordinates_resampled`, `expression_resampled`, and `widthheight_resampled`).
*   **Processing**: Extracts spatial and intensity data $\rightarrow$ reshapes data into grid dimensions $\rightarrow$ generates exclusion masks $\rightarrow$ stacks data arrays.
*   **Output**: Renders an `imshow` plot with overlaid crosshairs and saves a flattened grayscale representation as a PNG image.

### 4. Dependencies
*   **`numpy`**: Used for array manipulation and numerical operations.
*   **`pylab` (`matplotlib`)**: Used for rendering the final plots.
*   **`h5py`**: Used for reading HDF5 formatted scientific data.
*   **`PIL` (Pillow)**: Used for exporting processed image data to the file system.

### 5. Analysis Methods
*   **Resampling Reconstruction**: Uses `np.reshape` to transform linearized (1D) HDF5 data into 2D arrays based on provided width/height parameters.
*   **Threshold Masking**: Applies a simple binary thresholding technique (`Z < T`) to filter signal intensities, setting excluded values to `np.nan` for visualization purposes.
*   **Stacking**: Uses `np.dstack` to concatenate multiple maps into a 3D volume for comparative analysis or multi-layer overlay.

### 6. Figures/Outputs
*   **Interactive Plot**: Displays the 2D map via `pylab`, including crosshairs indicating the center of the image.
*   **Static Image**: Exports `plot_one.png`, a grayscale PNG representation of the first map processed in the stack, normalized to a byte range (0-255).

### 7. Key Parameters
*   **`T` / `thresh`**: The threshold value (default: `0.2`) used to define the signal-to-noise cutoff in `getMask`.
*   **`cmap`**: The colormap used for visualization (set to `'gray'`).
*   **`F.figsize`**: Configured as `(6,6)` to define the output figure dimensions.

---

## reading/python/plot_triplechannel.py

This file, `plot_triplechannel.py`, is a utility script designed for visualizing 3-channel (RGB-like) spatial data extracted from HDF5 map files produced by the `sfview` software.

### 1. Purpose
The script reads resampled 2D maps containing 3-channel color information from an HDF5 file and generates a visual representation of this data. It includes coordinate axes markers (crosshairs) and saves both a standard image file and a plot figure.

### 2. Key Functions/Classes
*   `getZColour(fname)`: Opens an HDF5 file, extracts the `boxcolours_resampled` array and its dimensions, and reshapes the flat array into a 3D (height, width, 3) NumPy array.

### 3. Data Flow
*   **Input**: Reads an HDF5 file (example: `example_data/602630314_annot.TF.602630314_annot.h5`) containing hierarchical datasets (`output_map/twod/boxcolours_resampled` and `output_map/twod/widthheight_resampled`).
*   **Processing**: Reshapes the 1D data into a 3D image buffer; converts float data to 8-bit integers (scaling by 255) for image saving.
*   **Output**: Produces a PNG image file (`triplechannel.png`) and a Matplotlib figure file (`triplechannel_fig.png`).

### 4. Dependencies
*   `numpy`: Array manipulation and reshaping.
*   `pylab` (Matplotlib): Plotting and figure rendering.
*   `h5py`: Reading HDF5 data format.
*   `PIL` (Pillow): Converting NumPy arrays to image files.

### 5. Analysis Methods
*   **Dimensional Reshaping**: Converts flattened HDF5 spatial data into a 2D grid with three color channels.
*   **Data Normalization/Scaling**: The script includes a commented-out line for normalizing data (`Z/np.max(Z)`) and performs a manual conversion to `uint8` for image export.
*   **Spatial Annotation**: Overlays crosshair lines at the geometric center of the image to mark coordinates.

### 6. Figures/Outputs
*   `triplechannel.png`: A raw RGB image export of the processed data.
*   `triplechannel_fig.png`: A styled Matplotlib figure with an image display, centering crosshairs, and tight layout formatting.
*   **Console Output**: Prints image dimensions and the maximum values for each of the three color channels.

### 7. Key Parameters
*   **`fname`**: The file path to the target HDF5 annotation file.
*   **Figure Size**: Hardcoded as `(8, 18)` in `pl.figure(figsize=(8,18))`.
*   **Crosshair Lines**: Centered automatically based on the dimensions extracted from the HDF5 file.

---

## reading/python/read_example.py

### Code Analysis Summary: `reading/python/read_example.py`

#### 1. Purpose
This script processes scientific data stored in HDF5 format (`.h5`), specifically iterating through multiple temporal frames to extract signal means, spatial coordinates, and slice thicknesses. It uses these extracted values to generate a flattened heat map visualization represented by rectangular polygons.

#### 2. Key Functions/Classes
*   **`h5py.File`**: Used for hierarchical access to the HDF5 data structure.
*   **`matplotlib.patches.Polygon`**: Used to construct individual rectangular graphical elements for the heatmap.
*   **`scipy.ndimage.interpolation.shift`**: Used to calculate the midpoint between data points for defining the vertical boundaries of the polygons.

#### 3. Data Flow
*   **Input**: Reads data from `../../ucr/V_Id2_1.h5`.
*   **Extraction**: Accesses hierarchical paths inside the HDF5 file formatted as `FrameXXX/signal/postproc/boxes/means`, `FrameXXX/class/layer_x`, `FrameXXX/autoalign/flattened/sbox_linear_distance`, and `FrameXXX/class/thickness`.
*   **Processing**: Aggregates per-frame data into lists, calculates rectangle vertices based on positional offsets, and maps signal means to a color scale.
*   **Output**: Renders a graphical plot using `matplotlib`.

#### 4. Dependencies
*   **`h5py`**: Required for reading HDF5 format files.
*   **`numpy`**: Used for array operations and coordinate arithmetic.
*   **`matplotlib`**: Used for plotting and colormaps (`mpl.cm.jet`).
*   **`scipy`**: Used for data shifting during geometry calculation.

#### 5. Analysis Methods
*   **Flattened Visualization**: Transforms 3D-like signal data into a 2D spatial representation.
*   **Geometric Calculation**: Defines polygon boundaries by calculating half-distances between consecutive spatial points in the `y` dimension and adding thicknesses in the `x` dimension.
*   **Normalization/Colormapping**: Maps signal magnitude (`means`) to a color space (Jet colormap) to visualize intensity.

#### 6. Figures/Outputs
*   **Console Output**: Prints file keys and the total number of frames (`nf`).
*   **Graphical Output**: A single matplotlib figure ("Flattened heat plot") displaying the signal data as an array of colored rectangles (polygons).

#### 7. Key Parameters
*   **`filename`**: The path to the source HDF5 file.
*   **`nf`**: Total number of frames extracted from the file metadata.
*   **`frame` naming convention**: The script expects an HDF5 internal structure following the string pattern `Frame{0:03}`.

---

## reading/python/showmap.py

### Analysis Summary: `reading/python/showmap.py`

#### 1. Purpose
This script generates a "flattened heat plot" visualization of scientific data stored in HDF5 format. It specifically maps sampled signal data (means) onto a coordinate system by constructing rectangular polygons representing individual spatial bins across multiple frames.

#### 2. Key Functions/Classes
*   **`matplotlib.patches.Polygon`**: Used to construct the geometric representation of data bins.
*   **`scipy.ndimage.interpolation.shift`**: Employed to calculate the boundaries (top/bottom edges) of the polygons by shifting the array of Y-coordinates to determine mid-points between adjacent bins.

#### 3. Data Flow
*   **Read**: Reads HDF5 files containing experimental data organized by frame (`FrameXXX`).
*   **Processing**:
    *   Extracts signal means and autoscaled means.
    *   Retrieves spatial metadata: `layer_x` (X-coordinate), `sbox_linear_distance` (Y-coordinate), and `thickness` (X-dimension width).
    *   Calculates vertex coordinates for each data bin to construct a continuous grid-like plot.
*   **Output**: Displays a `matplotlib` figure containing either one or two heat maps (un-autoscaled vs. autoscaled).

#### 4. Dependencies
*   **`h5py`**: For HDF5 file handling.
*   **`numpy`**: For array manipulation and coordinate math.
*   **`matplotlib`**: For plotting and polygon rendering.
*   **`scipy`**: Specifically `scipy.ndimage.interpolation` for boundary shifting calculations.

#### 5. Analysis Methods
*   **Geometric Mapping**: Instead of standard scatter plots, the script uses a polygon-based approach to represent bins, effectively creating a heat map by adjusting rectangle vertices based on local Y-coordinate spacing and X-axis thickness.
*   **Visualization Logic**: Implements a bin-centering algorithm where the Y-borders of polygons are defined as the halfway points between adjacent Y-coordinate values.

#### 6. Figures/Outputs
*   **Flattened Heat Plot**: A grey-scale heatmap showing signal intensity spatially.
*   **Modes**:
    *   **Un-autoscaled (`n=1`)**: Shows raw signal intensity.
    *   **Autoscaled (`n=2`)**: Shows normalized/autoscaled signal intensity.
    *   **Combined (`n=3`)**: Shows both plots in a stacked subplot configuration.

#### 7. Key Parameters
*   **`filename`**: Command-line argument providing the path to the `.h5` source file.
*   **`n`**: Optional command-line argument (1, 2, or 3) that determines the visualization mode (which signals to plot and their arrangement).
*   **`scalemult`**: A constant (default 1) used to scale the intensity of the non-autoscaled signal colors.

---

## reading/python/showmap_contours.py

This file is a visualization utility designed to extract, process, and display processed experimental data stored in HDF5 format, specifically focusing on "flattened" signal maps.

### 1. Purpose
The script reads signal intensity data from an HDF5 experiment file and generates heat maps using polygonal representations of sampled boxes across multiple experimental frames. It allows for the comparison between raw signal intensities and autoscaled signal intensities.

### 2. Key Functions/Classes
*   **`matplotlib.patches.Polygon`**: Used to construct individual rectangular regions representing sampled data bins.
*   **`plt.tricontour`**: Used to overlay contour lines on the heat map to identify specific intensity thresholds.
*   **`scipy.ndimage.interpolation.shift`**: Used to calculate the midpoint between vertical data points (`y` coordinates) to define the boundaries of the rectangular patches.

### 3. Data Flow
*   **Read**: Accesses HDF5 files containing hierarchical data structured by frame (e.g., `Frame000/signal/...`). It extracts:
    *   `/nframes`: Total frame count.
    *   `/signal/postproc/boxes/means`: Raw signal means.
    *   `/signal/postproc/boxes/means_autoscaled`: Normalized/autoscaled means.
    *   `/class/layer_x`: Spatial x-coordinates.
    *   `/lmalign/flattened/sbox_linear_distance`: Spatial y-coordinates.
    *   `/class/thickness`: Width of the data bins in the x-dimension.
*   **Process**: Converts nested list structures into flattened NumPy arrays and calculates vertex coordinates for polygons based on spatial gaps between consecutive `y` data points.
*   **Write**: Generates and displays visual plots.

### 4. Dependencies
*   **`h5py`**: For HDF5 data manipulation.
*   **`numpy`**: For array handling and coordinate calculations.
*   **`matplotlib`**: For plotting, patch rendering, and color mapping.
*   **`scipy`**: Specifically `scipy.ndimage.interpolation.shift` for calculating bin height boundaries.

### 5. Analysis Methods
*   **Spatial Heat Mapping**: Rather than using a scatter plot, the script maps the experimental data into a grid of polygons defined by `x` (layer position) and `y` (linear distance) with widths derived from `thickness`.
*   **Boundary Interpolation**: Uses numerical shifting to determine the vertical center-points between data samples to define rectangular patch edges.
*   **Contour Analysis**: Employs triangular contouring (`tricontour`) to trace specific signal intensity levels (e.g., levels 0.5 and 0.8) across the flattened map.

### 6. Figures/Outputs
*   **Flattened heat plot**: A visual grid representing the experimental signal across all frames.
*   **Option 1 (n=1)**: Plot of the un-autoscaled signal.
*   **Option 2 (n=2)**: Plot of the autoscaled signal.
*   **Option 3 (n=3)**: A dual-pane plot showing both raw and autoscaled signals.

### 7. Key Parameters
*   **`filename`**: The path to the HDF5 file passed as a command-line argument.
*   **`n`**: An integer (1, 2, or 3) representing the desired plotting mode (defaults to 3 if not provided).
*   **`levels`**: Inside `plt.tricontour`, set to `[0.5]` or `[0.8]` to determine which signal intensity boundaries are drawn as black lines.

---

## snap/snapcraft.yaml

This file is a `snapcraft.yaml` configuration file used to package the **Stalefish** neuroscience software as a Snap application for Linux distributions.

### 1. Purpose
This file defines the build environment, system dependencies, and application entry points required to compile and distribute Stalefish. It ensures that the neuroscience tool, which performs 3D gene expression surface reconstruction and 2D mapping, is consistently built and isolated within a Snap container.

### 2. Key Functions/Classes (Application Entry Points)
*   **`stalefish`**: The primary executable for analyzing gene expression data.
*   **`sfresave`**: Likely a utility for re-saving or processing saved experimental data.
*   **`sfgetjson` / `sfmakejson`**: Utilities for handling the JSON configuration/data formats used by the software.
*   **`sfview`**: A visualization tool used to view processed brain slice data (includes an example data flag `-e`).

### 3. Data Flow
*   **Input**: The application ingests brain slice images.
*   **Processing**: The software builds 3D expression surfaces from the images.
*   **Output**: The 3D surfaces are converted into 2D expression maps and potentially saved/exported via the defined utilities.

### 4. Dependencies
*   **Build-time**: `cmake`, `build-essential`, and a wide suite of development libraries including OpenCV, Armadillo, HDF5, GLFW, and FreeGLUT.
*   **Run-time (Stage Packages)**: Includes essential shared libraries for graphics (OpenGL, Mesa), scientific computation (LAPACK, OpenBLAS, Armadillo), and data handling (JSONCPP, HDF5).
*   **Platform**: Built for `core20` (Ubuntu 20.04 base) supporting `amd64` and `arm64` architectures.

### 5. Analysis Methods
While the file acts as a build configuration, it references the scientific methodology established in the linked PNAS paper: *"[A]nalyse gene expression... build 3D expression surfaces and then convert these into 2D expression maps."* The inclusion of `liblapack` and `libarmadillo` indicates that the software relies on linear algebra and numerical optimization for surface generation.

### 6. Figures/Outputs
*   **3D Expression Surfaces**: Reconstructed volumetric models of gene expression.
*   **2D Expression Maps**: Flattened or projected representations of the 3D data.
*   **Visualizations**: Rendered views of brain slices (handled by `sfview` via OpenGL).

### 7. Key Parameters
*   **Environment**: The `LD_LIBRARY_PATH` is explicitly set to point to BLAS and LAPACK directories to ensure the numerical backends are correctly linked at runtime.
*   **Plugs**: The app utilizes `home` (to access user files), `x11` (for windowing), and `opengl` (for 3D hardware acceleration) to interface with the host system.
*   **Command Flags**: `sfview` utilizes the `-e` flag to demonstrate functionality using example data.

---

## src/CMakeLists.txt

This file is a CMake configuration script responsible for building and linking the executable tools for the `morphologica` library, a project likely focused on computational modeling, image processing, and visualization.

### 1. Purpose
This `CMakeLists.txt` file defines the build configuration, dependency management, and compilation instructions for several utility executables (`stalefish`, `sfresave`, `sfgetjson`, `sfmakejson`, `sfview`, and `sfview_unwrap_fig`). It ensures that all necessary scientific and visualization libraries are linked correctly across different operating systems, specifically handling macOS packaging requirements.

### 2. Key Functions/Executables
*   **`stalefish`**: Core executable for the project (likely the primary simulation or processing engine).
*   **`sfresave`**: Utility for re-saving or converting data formats.
*   **`sfgetjson` / `sfmakejson`**: Utilities for parsing or generating JSON configuration/data files.
*   **`sfview` / `sfview_unwrap_fig`**: Visualization tools for rendering and unwrapping 3D/graphical data.

### 3. Data Flow
*   **Input**: Reads C++ source files (`.cpp`) and external library headers/binaries.
*   **Processing**: Compiles and links the source code against core scientific libraries (Armadillo, HDF5, OpenCV).
*   **Output**: Generates binary executables placed in the `${CMAKE_INSTALL_PREFIX}/bin` directory.

### 4. Dependencies
*   **Scientific Computing**: Armadillo (linear algebra), HDF5 (data storage), LAPACK.
*   **Visualization/GUI**: OpenCV, OpenGL, GLFW, Freetype.
*   **Utility/System**: JSONCPP (JSON processing), `popt` (command-line argument parsing), OpenMP (parallel processing).

### 5. Analysis Methods
While this file defines the build environment rather than the algorithms themselves, the reliance on **Armadillo** and **LAPACK** indicates the use of high-performance linear algebra and matrix decomposition methods standard in scientific research. The inclusion of **OpenMP** suggests the executables employ multi-threaded parallel computation.

### 6. Figures/Outputs
*   The primary output is the suite of **executable binaries**.
*   The visualization tools (`sfview`) imply that the project produces graphical output or rendered representations of morphological data.

### 7. Key Parameters
*   **`MAC_HEADERPAD`**: A conditional parameter (`-headerpad_max_install_names`) used on macOS to allow for post-build path reconfiguration during packaging (a common requirement for relocatable scientific software).
*   **`CMAKE_INSTALL_PREFIX`**: Configures the target installation path for the resulting binaries.
*   **`-L/usr/local/lib`**: A hardcoded directory path for finding the `popt` library, indicating a potential build environment dependency on local library paths.

---

