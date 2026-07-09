# Repository Overview

This analysis provides a structured overview of the EASI-FISH Nextflow Pipeline repository.

---

### 1. Repository Purpose
The repository hosts a **Nextflow-based bioinformatics pipeline** designed for the processing of large-scale 3D microscopy imagery generated via the **EASI-FISH** (Expansion-Assisted Iterative Fluorescence In Situ Hybridization) method. The pipeline automates the high-throughput processing of volumetric imaging, specifically focusing on stitching, multi-round registration, cell segmentation, and gene transcript/spot detection.

### 2. Data Pipeline
The pipeline operates as a distributed workflow, characterized by:
*   **Data Ingestion**: Raw microscopy imagery is downloaded via manifest files (`bin/download_dataset.sh`).
*   **Preprocessing/Orchestration**: The pipeline utilizes containerized environments (Docker/Singularity managed by `maru`) to execute modular steps.
*   **Core Transformations**:
    1.  **Registration**: Aligning images across experimental rounds.
    2.  **Segmentation**: Delineating cell boundaries using deep learning (StarDist/Starfinity).
    3.  **Spot Assignment**: Localizing fluorescent signals and quantifying intensity within segmented regions.
*   **Infrastructure**: Deployed on AWS Batch or local HPC clusters, using Zarr/N5 formats for memory-efficient handling of massive multi-dimensional volumetric data.

### 3. Key Scripts & Their Roles
*   **`bin/download_dataset.sh`**: Handles data ingestion, integrity validation (MD5), and extraction.
*   **`containers/segmentation/scripts/python/starfinity_prediction.py`**: Executes StarDist3D deep learning models for instance segmentation.
*   **`containers/spot_assignment/scripts/python/assign_spots.py`**: Maps 3D transcript coordinates to segmented cell labels.
*   **`containers/spot_assignment/scripts/python/intensity_measurements.py`**: Quantifies signal intensities and performs bleed-through correction.
*   **`containers/spot_assignment/scripts/python/n5_metadata_utils.py`**: Provides infrastructure for reading/transferring spatial metadata for N5/Zarr datasets.
*   **`containers/registration/waitforpaths.sh`**: A utility for synchronizing container processes waiting for file availability.

### 4. Analysis Methods Implemented
*   **Instance Segmentation**: Utilizes the StarDist (star-convex polygon) approach, specifically a "starfinity" affinity-based variant to resolve object boundaries.
*   **Signal Quantification**: Implements mean intensity measurements for ROIs with integrated DAPI-based background subtraction.
*   **Spatial Analysis**: Uses coordinate transformation (voxel space mapping) to relate arbitrary spot locations to physical segmented regions.
*   **High-Throughput Optimization**: Employs tiling strategies (memory-managed image processing) and parallelized distributed computing via Spark/Nextflow.

### 5. Outputs & Figures
*   **Quantification Tables**: CSV outputs containing spot counts (`count.csv`) and intensity metrics (`{r}_{channel}_intensity.csv`).
*   **Segmentation Masks**: TIFF/Zarr-based 3D label volumes representing delineated cells/objects.
*   **Diagnostic Logs**: Nextflow logs, error reports, and status outputs from the containerized steps.
*   **Pipeline Documentation**: Flow diagrams and parameter guides hosted in `docs/`.

### 6. Dependencies & Environment
*   **Orchestration**: Nextflow, AWS Batch, Serverless Framework.
*   **Containerization**: `maru` (build tool), Docker/Singularity.
*   **Scientific Stack**:
    *   **Deep Learning**: TensorFlow 1.15, StarDist.
    *   **Image/Data I/O**: `z5py`, `zarr`, `tifffile`, `nibabel`.
    *   **General Computing**: `numpy`, `scipy`, `pandas`, `scikit-image`.
*   **Hardware Requirements**: CPU/GPU-optimized compute environments (e.g., AWS `g3`/`g4dn` instances for deep learning).

### 7. File Dependency Graph
*   **Configuration Logic**: `maru.yaml` files reference container remotes $\rightarrow$ Conda environments (`environment.yml`/`requirements.yml`) $\rightarrow$ Python scripts.
*   **Modular Utility**: `n5_metadata_utils.py` serves as a core dependency for both `assign_spots.py` and `intensity_measurements.py`.
*   **Deployment Lifecycle**:
    1.  `setup.sh` initializes repository.
    2.  `bin/download_dataset.sh` fetches raw data.
    3.  `aws-batch/serverless.yml` provisions compute nodes.
    4.  Nextflow orchestrates containers defined in `containers/` to process data from `data-sets/`.
    5.  Results are validated via `docs/Troubleshooting.md` or `bug_report.md`.

Repository Structure:
  .github/ISSUE_TEMPLATE/bug_report.md (722 chars)
  .github/ISSUE_TEMPLATE/feature_request.md (474 chars)
  README.md (2204 chars)
  aws-batch/serverless.yml (4948 chars)
  bin/download_dataset.sh (820 chars)
  containers/README.md (465 chars)
  containers/downloader/maru.yaml (152 chars)
  containers/registration/environment.yml (1206 chars)
  containers/registration/maru.yaml (441 chars)
  containers/registration/waitforpaths.sh (667 chars)
  containers/rs_fish/maru.yaml (402 chars)
  containers/segmentation/conda-requirements.yml (239 chars)
  containers/segmentation/maru.yaml (159 chars)
  containers/segmentation/scripts/python/starfinity_prediction.py (1776 chars)
  containers/spot_assignment/conda-requirements.yml (144 chars)
  containers/spot_assignment/maru.yaml (157 chars)
  containers/spot_assignment/scripts/python/assign_spots.py (2174 chars)
  containers/spot_assignment/scripts/python/intensity_measurements.py (2034 chars)
  containers/spot_assignment/scripts/python/n5_metadata_utils.py (2766 chars)
  containers/spot_extraction/README.txt (227 chars)
  containers/spot_extraction/compiled_matlab/AIRLOCALIZE_N5/__init__.py (15898 chars)
  containers/spot_extraction/compiled_matlab/setup.py (2653 chars)
  containers/spot_extraction/conda-requirements.yml (108 chars)
  containers/spot_extraction/maru.yaml (157 chars)
  containers/spot_extraction/params/air_localize_default_params.txt (675 chars)
  containers/spot_extraction/scripts/airlocalize.sh (713 chars)
  containers/spot_extraction/scripts/python/air_localize_mcr.py (3710 chars)
  containers/spot_extraction/scripts/python/cut_tiles.py (2431 chars)
  containers/spot_extraction/scripts/python/merge_points.py (3028 chars)
  containers/spot_extraction/scripts/python/n5_metadata_utils.py (2766 chars)
  containers/spot_extraction/scripts/python/post_rsfish.py (885 chars)
  containers/stitching/maru.yaml (401 chars)
  data-sets/demo_medium.txt (560 chars)
  data-sets/demo_small.txt (560 chars)
  data-sets/demo_small3.txt (784 chars)
  data-sets/demo_tiny.txt (802 chars)
  data-sets/segmentation.txt (112 chars)
  docs/About.md (780 chars)
  docs/Home.md (1264 chars)
  docs/Parameters.md (20077 chars)
  docs/QuickStart.md (2725 chars)
  docs/Running.md (7152 chars)
  docs/Troubleshooting.md (3452 chars)
  docs/Visualization.md (4187 chars)
  docs/_config.yml (2157 chars)
  docs/development/AWSBatch.md (5131 chars)
  docs/development/Development.md (2040 chars)
  docs/modules/Modules.md (82 chars)
  docs/modules/RS-FISH.md (2182 chars)
  docs/platforms/AWS.md (150 chars)
  docs/platforms/LSF.md (1013 chars)
  docs/platforms/Local.md (701 chars)
  docs/platforms/Platforms.md (419 chars)
  docs/tower/NextflowTower.md (407 chars)
  docs/tower/NextflowTowerAWS.md (2753 chars)
  docs/tower/NextflowTowerJanelia.md (5081 chars)
  examples/demo_medium.sh (1923 chars)
  examples/demo_small.sh (1920 chars)
  examples/demo_small3.sh (1921 chars)
  examples/demo_tiny.sh (1877 chars)
  examples/run-on-aws.sh (857 chars)
  examples/run_assign_spots.sh (495 chars)
  examples/run_intensities.sh (630 chars)
  examples/run_pipeline.sh (668 chars)
  examples/run_registration.sh (475 chars)
  examples/run_spot_extraction.sh (378 chars)
  notebooks/correct_darkfield_flatfield.py (3283 chars)
  notebooks/infer_darkfield_flatfield.ipynb (3765 chars)
  setup.sh (408 chars)