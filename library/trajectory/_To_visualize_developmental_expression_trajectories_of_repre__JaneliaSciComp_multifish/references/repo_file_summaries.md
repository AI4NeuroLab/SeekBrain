# Repository File Summaries

## .github/ISSUE_TEMPLATE/bug_report.md

This file is a GitHub Issue Template designed to standardize bug reporting for a scientific software project (EASI-FISH Pipeline).

### 1. Purpose
This file provides a structured form for users to report bugs when they encounter issues with the EASI-FISH pipeline. It ensures that maintainers receive consistent, actionable technical information required for troubleshooting.

### 2. Key Functions/Classes
* **N/A**: As a Markdown template file, it contains no executable code, functions, or classes.

### 3. Data Flow
* **Reads**: User input regarding pipeline behavior, errors, and system configuration.
* **Writes**: An issue report is generated and saved as a GitHub Issue in the repository's tracker when a user submits the template.

### 4. Dependencies
* **External**: GitHub (the platform that parses and renders the Markdown template).
* **Internal**: Relies on the user having access to internal pipeline logs (specifically `.nextflow.log`) and process-specific logs.

### 5. Analysis Methods
* **N/A**: This is a documentation/template file and does not implement scientific or statistical analysis.

### 6. Figures/Outputs
* **Outputs**: The template prompts the user to attach external log files (e.g., `.nextflow.log`) and potentially screenshots or diagnostic plots related to the failure.

### 7. Key Parameters
The template requires the following technical metadata from the user to help reproduce the issue:
* **Pipeline Version**: Identifies the specific release or commit of EASI-FISH.
* **Nextflow Version**: Crucial for identifying dependency conflicts or engine-specific bugs.
* **Container Runtime**: Specifies the isolation environment (e.g., Docker, Singularity).
* **Platform**: Specifies the infrastructure provider (e.g., LSF, AWS Batch) to identify environment-specific configuration errors.
* **Operating System**: Identifies the host environment for local execution.

---

## .github/ISSUE_TEMPLATE/feature_request.md

This file is a standard GitHub issue template used to standardize the submission of feature requests within a repository.

### 1. Purpose
This file provides a structured markdown template that users must fill out when proposing new features or enhancements for the project. It ensures that developers receive consistent, actionable information (proposal, use cases, and implementation ideas) from contributors.

### 2. Key Functions/Classes
*   **N/A**: This is a static configuration file, not a source code file. It does not contain functions or classes.

### 3. Data Flow
*   **Reads/Writes**: The file is read by the GitHub platform when a user initiates a "New Issue" and selects the "Feature request" template. It provides the initial text for the issue body, which is then processed by the project maintainers and contributors.

### 4. Dependencies
*   **GitHub Issues**: This file relies on the GitHub platform's issue tracking system features.

### 5. Analysis Methods
*   **N/A**: This file does not perform scientific or statistical calculations.

### 6. Figures/Outputs
*   **Template Output**: When used, it generates a structured markdown formatted issue, prompting the user to fill in the following sections:
    *   **Proposal**: The core idea.
    *   **Usage scenario**: Real-world application of the feature.
    *   **Suggested implementation**: Technical direction for development.

### 7. Key Parameters
*   **`name`**: Set to "Feature request" (display name in the UI).
*   **`labels`**: Set to `enhancement` (automatically applies the 'enhancement' label to incoming issues).
*   **`about`**: Descriptive text used in the GitHub issue selection menu.

---

## README.md

This is a structured analysis of the `README.md` file for the **EASI-FISH Nextflow Pipeline** repository.

### 1. Purpose
This file provides the primary documentation and setup instructions for a Nextflow-based bioinformatics pipeline designed to process imagery from the EASI-FISH (Expansion-Assisted Iterative Fluorescence In Situ Hybridization) method. It serves as a central hub for users to understand the pipeline's capabilities, requirements, and deployment procedures.

### 2. Key Functions/Classes
*   **`setup.sh`**: A shell script used to initialize the environment and pull external dependencies required for pipeline execution.
*   **`main.nf`**: The primary Nextflow script that acts as the entry point and orchestrator for the image processing workflow.

### 3. Data Flow
*   **Input**: Raw imagery collected using the EASI-FISH method.
*   **Processing**: The pipeline performs distributed image processing tasks including stitching, multi-round registration, cell segmentation, and spot detection.
*   **Output**: Processed biological image data and associated analytical results (typically stored in a structured directory format managed by Nextflow).

### 4. Dependencies
*   **Workflow Engine**: Nextflow (version ≥ 21.04.1).
*   **Containerization**: Singularity (preferred for HPC) or Docker.
*   **Version Control**: Git (with recursive submodule support).
*   **Infrastructure**: Access to a workstation or HPC cluster.

### 5. Analysis Methods
The pipeline implements several scientific image analysis techniques:
*   **Image Stitching**: Combining overlapping image tiles into a cohesive large-scale image.
*   **Distributed Image Registration**: Aligning imagery across multiple experimental rounds to account for biological and technical variability.
*   **Cell Segmentation**: Computational identification and delineation of individual cell boundaries.
*   **Distributed Spot Detection**: Identifying specific fluorescent signals (spots) associated with gene transcripts or probes across large-scale imaging volumes.

### 6. Figures/Outputs
*   **Pipeline Diagram**: Included in `docs/images/pipeline_diagram.png`, providing a visual overview of the data transformation workflow.
*   **Documentation Site**: Full technical specifications are hosted at [janeliascicomp.github.io/multifish](https://janeliascicomp.github.io/multifish).

### 7. Key Parameters
While specific pipeline arguments are defined within the `main.nf` script or an external configuration file (not explicitly listed in the README), the document implies the use of:
*   **Configuration Arguments**: Command-line flags provided to `main.nf` to dictate input data paths, processing parameters, and computational resource allocation (e.g., CPU/RAM settings for cluster execution).

---

## aws-batch/serverless.yml

This file defines the infrastructure-as-code for a scientific computing pipeline using the **Serverless Framework** to deploy AWS Batch resources for a project named "Multifish."

### 1. Purpose
This file orchestrates the provisioning of AWS Batch compute environments and job queues specifically configured for CPU-intensive and GPU-accelerated scientific workloads. It ensures that the "Multifish" project has isolated, scalable environments for processing experimental or computational data.

### 2. Key Resources
*   **Compute Environments**:
    *   `SmallCPUMultifishOnDemandEnv`: Managed environment for smaller CPU tasks (max 16 vCPUs).
    *   `CPUMultifishOnDemandEnv`: Managed environment for heavy CPU tasks (max 64 vCPUs).
    *   `GPUMultifishOnDemandEnv`: Managed environment for GPU-accelerated tasks, supporting `g3` and `g4dn.12xlarge` instance types.
*   **Job Queues**: Defines three separate queues (`SmallCPU`, `CPU`, `GPU`) to route jobs to their respective compute environments.
*   **IAM Roles**: 
    *   `BatchServiceRole`: Grants AWS Batch permissions to interact with AWS services.
    *   `ECSTaskRole`: Defines the permissions for the containers running the scientific code (notably granting S3 access).

### 3. Data Flow
*   **Input**: The configuration consumes environment variables (like `USER` and `stage`) and optional CLI flags for deployment region.
*   **Storage**: The `ECSTaskRole` and `BatchServiceRole` are granted `AmazonS3FullAccess`, indicating that scientific data likely resides in or is exported to S3 buckets.

### 4. Dependencies
*   **Framework**: Serverless Framework (`serverless.yml` schema).
*   **AWS Infrastructure**: AWS Batch, EC2, and IAM.
*   **Environment**: Relies on specific pre-configured AWS resources (Subnet ID, Security Group, and AMI IDs) provided in the `custom` block.

### 5. Analysis Methods
This file does not implement scientific logic; it is an infrastructure configuration file. However, the use of `g3` and `g4dn.12xlarge` instance types suggests the pipeline is intended for **Deep Learning, Computer Vision, or high-throughput physical simulations** requiring GPU parallelism.

### 6. Figures/Outputs
*   **Infrastructure Output**: Deploys a managed AWS CloudFormation stack.
*   **Operational Output**: Provides three distinct job queues ready to receive computational tasks from the Multifish software suite.

### 7. Key Parameters
*   **`ec2MultifishCPUImageId` / `ec2MultifishGPUImageId`**: Custom AMI IDs containing the necessary scientific software stack (e.g., CUDA drivers, Python environments).
*   **`MaxvCpus`**: Scaling limits (16 for small, 64 for large) that govern the compute budget.
*   **`InstanceTypes`**: Explicitly set to `optimal` for CPUs and specific GPU-optimized instances for the GPU environment.
*   **`sshKeyPairName`**: Configured to allow SSH access to the underlying compute nodes for debugging purposes.

---

## bin/download_dataset.sh

### Code Analysis Summary: `bin/download_dataset.sh`

#### 1. Purpose
This script automates the retrieval, verification, and extraction of research datasets based on a provided manifest file or URL. It ensures data integrity through checksum verification and simplifies the preparation of compressed data archives.

#### 2. Key Functions/Classes
*   **Shell Script Logic**: The script operates as a linear procedural process rather than using modular functions. 
    *   **Initialization**: Handles directory creation and manifest identification.
    *   **Iteration**: Loops through the manifest file, parsing individual file records.
    *   **Verification/Extraction**: Conditional logic to perform MD5 checksum validation and ZIP archive extraction.

#### 3. Data Flow
*   **Input**: 
    *   `manifest_path`: A local file path or remote URL containing a list of files (Format: `filename`, `md5_hash`, `url`).
    *   `target_dir`: The destination directory for downloaded/extracted files.
*   **Process**: Downloads files via `curl`, validates them against MD5 hashes, and extracts `.zip` files.
*   **Output**: Writes files to the `target_dir` and outputs status logs (success/failure) to the terminal.

#### 4. Dependencies
*   **System Utilities**:
    *   `curl`: For remote file transfer.
    *   `md5sum`: For file integrity verification.
    *   `unzip`: For archive decompression.
*   **Bash**: Standard Unix shell environment.

#### 5. Analysis Methods
*   **Integrity Checking**: Implements a standard MD5 hash verification to ensure that data integrity is maintained during the download process, which is critical for reproducibility in scientific research.

#### 6. Figures/Outputs
*   **Outputs**: 
    *   Directory structure populated with downloaded and extracted dataset files.
    *   Log messages written to `stdout` indicating download status, checksum results, and errors.
    *   Exit code `1` if checksum verification fails.

#### 7. Key Parameters
*   `$1` (manifest_path): The source manifest file (required).
*   `$2` (target_dir): The directory where data will be stored (required).
*   `$3` (verify_md5): A boolean flag (default: `true`) to toggle checksum verification, allowing for faster downloads in environments where integrity is not the primary concern.

---

## containers/README.md

Based on the provided content, here is the structured summary of `containers/README.md`:

1. **Purpose**: This file serves as documentation for the repository's containerization strategy, explaining that each subfolder contains a Docker environment necessary for a specific pipeline step to ensure portability. It also provides instructions for rebuilding these environments.

2. **Key Functions/Classes**: 
   - No code or classes are defined in this file. It references the `maru` build tool for container orchestration.

3. **Data Flow**: 
   - N/A (This is a documentation file; it does not process data).

4. **Dependencies**: 
   - **External**: Docker, [maru](https://github.com/JaneliaSciComp/maru).
   - **Internal**: References `../docs/Development.md` for extended technical guidance.

5. **Analysis Methods**: 
   - N/A (The file describes infrastructure/environment management, not scientific analysis).

6. **Figures/Outputs**: 
   - N/A (The output of the process described is the generation of Docker container images).

7. **Key Parameters**: 
   - N/A (Configuration occurs within the individual subfolders and their respective `Dockerfile`s, not within this README).

---

## containers/downloader/maru.yaml

This file is a configuration manifest used within a containerized workflow ecosystem (likely associated with the Janelia Research Campus "Multifish" project).

### 1. Purpose
This file serves as a metadata and deployment configuration for a containerized "downloader" service. It defines the versioning and remote registry locations required to pull the container image for use in a broader scientific data processing pipeline.

### 2. Key Functions/Classes
*   **None**: This is a static configuration file (YAML), not a source code file containing executable functions or classes.

### 3. Data Flow
*   **Reads**: The configuration is consumed by a deployment tool or container orchestration system (e.g., `maru` CLI) to locate the container image.
*   **Writes**: None.
*   **Processes**: It acts as a pointer to remote container registries, facilitating the retrieval of the `downloader` image.

### 4. Dependencies
*   **External**: Depends on container registries:
    *   `multifish` (Local or environment-specific namespace)
    *   `registry.int.janelia.org` (Janelia internal infrastructure)
    *   `public.ecr.aws` (Amazon Elastic Container Registry)

### 5. Analysis Methods
*   **None**: No scientific or statistical logic is contained within this file.

### 6. Figures/Outputs
*   **Outputs**: When processed by the system, it outputs the location and versioning metadata necessary to initialize the "downloader" container instance.

### 7. Key Parameters
*   `maru_version`: Specifies the version of the `maru` framework/toolchain required to parse this configuration (0.1.1).
*   `name`: Identifies the container module (`downloader`).
*   `version`: The semantic version of the downloader service (1.1.0).
*   `remotes`: A list of URIs used as fallback locations for pulling container images, ensuring redundancy across different network environments (internal vs. public cloud).

---

## containers/registration/environment.yml

### Analysis Summary: `containers/registration/environment.yml`

This file is a configuration manifest for a Conda environment, defining the software stack required to run a specific scientific workflow (likely related to image registration or medical image processing).

---

**1. Purpose**
This file defines the environment specifications for a project, ensuring reproducible execution by pinning exact versions of the Python interpreter, system libraries, and research-specific packages. It is designed to be used with the Conda package manager to create a consistent compute container.

**2. Key Functions/Classes**
*   **N/A**: As a configuration file, it does not contain executable code, functions, or classes.

**3. Data Flow**
*   The environment is configured to process scientific data, specifically **medical imaging files** (supported by `nibabel`, `pynrrd`, and `tifffile`) and **array-based data structures** (supported by `zarr` and `numcodecs`).

**4. Dependencies**
*   **Core Runtime**: Python 3.8.5.
*   **Image Processing**: `scikit-image`, `opencv-python`, `imageio`, `pillow`, `pywavelets`.
*   **Scientific Computing**: `numpy` (1.20.3), `scipy` (1.6.0).
*   **Data Structure/I/O**: `nibabel` (Neuroimaging), `pynrrd` (NRRD files), `zarr` (chunked compressed binary data).
*   **Visualization**: `matplotlib`.
*   **Graph/Optimization**: `networkx`, `greedypy`.

**5. Analysis Methods**
While the file is a configuration, the included libraries indicate the following potential methods:
*   **Image Registration/Transformation**: Likely involves Fourier transforms (`pyfftw`), wavelet processing (`pywavelets`), and general image filtering/segmentation (`scikit-image`, `opencv`).
*   **Greedy Optimization**: Indicated by the `greedypy` package.
*   **Neuroimaging Analysis**: Indicated by the `nibabel` library.

**6. Figures/Outputs**
*   The environment includes `matplotlib`, suggesting the generation of statistical plots or visualization of processed image results.

**7. Key Parameters**
*   **Python Version**: 3.8.5 (pinned).
*   **Numerical Backend**: `numpy` 1.20.3 and `scipy` 1.6.0 define the baseline for all numerical operations.
*   **System Constraints**: Relies on `defaults` channels and specific `libgcc` and `libstdc++` versions, suggesting a Linux-based deployment environment.

---

## containers/registration/maru.yaml

This file is a configuration manifest for a containerized scientific application named "registration." Based on the provided content, here is the structured analysis:

### 1. Purpose
This YAML file serves as a build and deployment configuration for a containerized image within the "Maru" framework. It defines how to construct the registration environment by pulling specific dependencies and scripts from the `bigstream` repository.

### 2. Key Functions/Classes
*   **`maru_version` (0.1.1)**: Defines the version of the build framework/platform being used.
*   **`build_args`**: Handles versioning logic (dynamically generating a `GIT_TAG` based on the software version).
*   **`python_conda`**: Specifies the execution environment configuration for the container.

### 3. Data Flow
*   **Reads**: Fetches source code from the remote `bigstream` GitHub repository.
*   **Processes**: Builds a Python/Conda environment using the specified dependencies.
*   **Execution**: Invokes `bigstream/run_stream.sh` as the primary entry point/script for the containerized task.

### 4. Dependencies
*   **Repository**: [JaneliaSciComp/bigstream](https://github.com/JaneliaSciComp/bigstream.git)
*   **Software Libraries**: `numpy`, `z5py`, `json`, `scipy`, `scikit-image`.
*   **Platform**: Conda (Python 3.6 environment).

### 5. Analysis Methods
While the file is a configuration, it references the **`bigstream`** pipeline. Based on the included libraries (`scikit-image`, `scipy`, `numpy`), the analysis methods implemented in this container involve:
*   **Image Registration**: Alignment and transformation of multidimensional biological image data (implied by the `bigstream` utility).
*   **Scientific Computing**: Likely involves N-dimensional array processing and optimization/interpolation algorithms common in image registration.

### 6. Figures/Outputs
*   **Primary Output**: A container image deployed to the specified remotes (e.g., `registry.int.janelia.org` or `public.ecr.aws`).
*   **Runtime Output**: As the container runs `run_stream.sh`, it likely produces transformed image datasets or registration metadata (e.g., deformation fields) stored in `z5py` (Zarr) format.

### 7. Key Parameters
*   **`python_version`**: Fixed to "3.6".
*   **`dependencies`**: Lists the essential scientific stack (numpy, scipy, z5py, etc.) required for the registration algorithms.
*   **`remotes`**: Defines the container registry endpoints where the built image is stored or pulled from for deployment.
*   **`GIT_TAG`**: An interpolated parameter (`prototype-1.2.3`) used to track the specific version of the source code integrated into the container.

---

## containers/registration/waitforpaths.sh

### Code Analysis: `containers/registration/waitforpaths.sh`

#### 1. Purpose
This script serves as a synchronization utility in a containerized environment, ensuring that a series of required file system paths exist before proceeding with downstream processes. It implements a polling mechanism with a timeout to prevent indefinite hanging if expected files (e.g., data volumes or configuration mounts) fail to materialize.

#### 2. Key Functions/Classes
*   **Main execution loop**: The script is procedural and does not utilize defined functions. It iterates through a provided list of file paths and performs a blocking `while` loop for each until the file is detected or the timeout threshold is breached.

#### 3. Data Flow
*   **Input**: Receives a list of file paths via command-line arguments (`$@`).
*   **Processing**: Periodically polls the file system using the `test -e` command to verify path existence.
*   **Output**: Writes status messages to `stdout` (e.g., "Checking for...", "Waiting for...", or "Timed out...") and exits with a status code of `0` (success) or `1` (failure).

#### 4. Dependencies
*   **System Shell**: Requires a POSIX-compliant shell (Bash) available in the environment.
*   **External Commands**: Relies on standard Unix utilities: `test`, `sleep`, and `echo`.

#### 5. Analysis Methods
*   **Polling/Watchdog Mechanism**: Implements a basic "wait-for-ready" pattern common in distributed systems and container orchestration to handle dependencies between containers or processes that share a file system.

#### 6. Figures/Outputs
*   **No graphical outputs**.
*   **Console Output**: Generates textual logs to inform the user or orchestrator about the current wait state and outcome of the file existence check.

#### 7. Key Parameters
*   **`SLEEP_SECS`**: The interval (default: 1 second) between consecutive checks for file existence.
*   **`MAX_WAIT_SECS`**: The maximum duration (default: 30 seconds) allowed for a file to appear before the script triggers a failure.
*   **`filelist`**: The list of paths passed as positional arguments to the script.

---

## containers/rs_fish/maru.yaml

This file is a configuration manifest for the `maru` containerization system, specifically designed to package the **RS-FISH-Spark** project for high-performance computing environments.

### 1. Purpose
This file defines the build specifications and metadata for the `rs_fish` container. It automates the environment setup and compilation process for running RS-FISH (a localized signal detection algorithm) using Apache Spark.

### 2. Key Functions/Classes
*   **`net.preibisch.rsfish.spark.SparkRSFISH`**: The primary Java entry point (main class) for the Spark-distributed application, responsible for initiating the processing pipeline.

### 3. Data Flow
*   **Input**: Fetches source code from the `PreibischLab/RS-FISH-Spark` GitHub repository.
*   **Processing**: Uses Maven to compile the Java source code into a runnable JAR file configured for execution in a Spark environment.
*   **Output**: Produces a containerized environment (via `maru`) that includes the compiled RS-FISH application, ready for deployment on distributed compute clusters.

### 4. Dependencies
*   **Build Environment**: Requires Java Development Kit (JDK) version 8.
*   **Build Tool**: Apache Maven (`mvn package`).
*   **Remotes**: Leverages `multifish` infrastructure and container registries (Janelia internal and AWS ECR).
*   **Codebase**: Depends on the external GitHub repository: [RS-FISH-Spark](https://github.com/PreibischLab/RS-FISH-Spark.git).

### 5. Analysis Methods
*   **Distributed Signal Detection**: The core algorithm (RS-FISH) is designed for Large-Scale Fish (Fluorescence In Situ Hybridization) spot detection, utilizing Spark to parallelize the process across large volumetric imaging datasets.

### 6. Figures/Outputs
*   **Container Image**: The primary output is a container image containing the `RS-FISH` execution environment.
*   **Execution**: The application typically outputs localized coordinates of fluorescent spots from volumetric microscopy data.

### 7. Key Parameters
*   **`GIT_TAG`**: Specifies the exact version of the source code (`0.0.2`) to be pulled for the build.
*   **`jdk_version: "8"`**: Enforces a specific Java runtime environment compatibility requirement.
*   **`main_class`**: Defines the application entry point, critical for Spark job submission scripts to locate the execution class.

---

## containers/segmentation/conda-requirements.yml

This analysis covers the `containers/segmentation/conda-requirements.yml` file, which serves as a dependency configuration for a specific image segmentation environment.

### 1. Purpose
This file defines a reproducible Conda environment configuration for a containerized scientific application focused on image segmentation. It specifies the necessary Python packages and versions required to run deep learning-based segmentation models, specifically those utilizing StarDist.

### 2. Key Functions/Classes
*N/A*: As a configuration/environment file, it contains no executable code, functions, or classes.

### 3. Data Flow
While the file does not process data itself, it defines the environment in which data processing occurs:
*   **Reads**: Expected to read image data (likely large-scale volumetric data) using `z5py` (N5/Zarr file formats).
*   **Writes**: Expected to write segmentation masks or probability maps generated by TensorFlow models.
*   **Processes**: Performs GPU-accelerated image analysis and distance transformation calculations.

### 4. Dependencies
The environment relies on the following key external libraries:
*   **Conda Channels**: `anaconda`, `conda-forge`, `defaults`.
*   **Core Libraries**: `numpy` (numerical computing), `tensorflow=1.15` (deep learning framework).
*   **File I/O**: `z5py=2.0.5` (optimized for large-scale bioimage data formats like N5/Zarr).
*   **Domain-Specific**:
    *   `gputools`: For high-performance GPU-based image processing.
    *   `edt`: Euclidean Distance Transform implementation.
    *   `stardist`: A specific library for cell/object segmentation (sourced via git).

### 5. Analysis Methods
The dependencies suggest the implementation of the following methods:
*   **StarDist Segmentation**: A deep learning approach that predicts star-convex polygons for object detection.
*   **Euclidean Distance Transform (EDT)**: Often used in segmentation workflows to separate touching objects or define object centers.
*   **GPU-Accelerated Processing**: Leverages `gputools` and `tensorflow-gpu` to parallelize image filtering and inference tasks.

### 6. Figures/Outputs
*N/A*: No output generation is defined in this file. Expected outputs from the environment typically include segmented binary masks, labeled images, or object coordinate files (.json/.csv) generated by the StarDist inference pipeline.

### 7. Key Parameters
*   **`tensorflow=1.15`**: Locks the environment to an older version of TensorFlow, suggesting the codebase is legacy or requires specific compatibility with the StarDist refinement branch.
*   **`z5py=2.0.5`**: Ensures compatibility with specific high-performance data storage layouts.
*   **`git+https://github.com/mpicbg-csbd/stardist@refinement`**: Points to a specific development branch (`refinement`) of the StarDist repository, indicating that this environment depends on experimental or non-master features of the model.

---

## containers/segmentation/maru.yaml

This file, `containers/segmentation/maru.yaml`, serves as a configuration/manifest file for a containerized scientific application within the Janelia Research Campus computing ecosystem.

### 1. Purpose
This file defines the metadata, versioning, and container registry lookup paths for a "segmentation" software package named `maru`. It acts as a configuration manifest to ensure the correct environment and image source are utilized for deployment in a high-performance computing (HPC) or containerized workflow.

### 2. Key Functions/Classes
*   **None**: As a configuration file (`.yaml`), it does not contain executable code, classes, or functions. Its purpose is declarative.

### 3. Data Flow
*   **Reads**: The file is read by container orchestration tools (likely proprietary Janelia tools or standard CI/CD pipelines) to determine where to pull image layers.
*   **Writes/Processes**: It does not perform active data processing; it facilitates the initialization of a container environment where segmentation tasks (e.g., image processing) will eventually occur.

### 4. Dependencies
*   **Container Registries**: The file relies on access to three distinct remote repositories:
    *   `registry.int.janelia.org/janeliascicomp` (Internal Janelia registry)
    *   `multifish` (Internal/project-specific namespace)
    *   `public.ecr.aws/janeliascicomp/multifish` (Public-facing AWS Elastic Container Registry)

### 5. Analysis Methods
*   **N/A**: This file is a structural manifest and does not implement scientific or statistical algorithms itself. However, by naming the package `segmentation`, it implies the associated container likely uses computer vision algorithms (e.g., U-Net, Watershed, or CNN-based approaches) for biological image segmentation.

### 6. Figures/Outputs
*   **N/A**: Does not generate figures or data outputs.

### 7. Key Parameters
*   `maru_version`: (`0.1.1`) Specific version of the Maru toolset.
*   `version`: (`1.0.0`) The semantic version of the segmentation container package.
*   `remotes`: A list of URL endpoints that define the search path for image pulling, prioritizing internal high-speed registries followed by public fallbacks.

---

## containers/segmentation/scripts/python/starfinity_prediction.py

### Analysis Summary: `starfinity_prediction.py`

#### 1. Purpose
This script performs 3D instance segmentation on volumetric microscopy data using the StarDist3D deep learning model, specifically utilizing an "affinity-based" approach. It is designed to process large, chunked datasets stored in `z5` format and generate segmented label volumes.

#### 2. Key Functions/Classes
*   **`StarDist3D`**: The core class from the `stardist` library used to load the pre-trained neural network model.
*   **`model.predict_instances`**: The primary method used to run inference on the input volume, specifically configured to use affinity-based thresholding for instance segmentation.
*   **`normalize`**: A utility from `csbdeep` used to pre-process raw input data into a range suitable for the neural network.

#### 3. Data Flow
*   **Input**: Reads a 3D image volume from a `z5` format file (specified by directory path, channel, and scale).
*   **Processing**: 
    1. Normalizes the pixel intensity values (percentiles 4 and 99.8).
    2. Estimates tiling parameters based on input dimensions (to manage memory during inference).
    3. Executes the StarDist3D model to generate affinity-based labels and markers.
*   **Output**: Saves the resulting `label_starfinity` array as a compressed TIFF file.

#### 4. Dependencies
*   **`numpy`**: Numerical computing.
*   **`tifffile`**: Reading/writing TIFF images.
*   **`csbdeep`**: Deep learning utilities (specifically data normalization).
*   **`stardist`**: The core library for star-convex object detection.
*   **`z5py`**: Python interface for the Z5/N5/Zarr storage format.
*   **`argparse`**: Command-line interface management.

#### 5. Analysis Methods
*   **Instance Segmentation**: Uses a star-convex polygon representation to detect and segment objects in 3D.
*   **Affinity-based Segmentation**: Employs an affinity-based approach (`affinity=True`) to handle complex objects, with a specified threshold (`affinity_thresh=0.1`) to resolve boundaries between instances.
*   **Tiling**: Implements a memory-efficient processing strategy by splitting the 3D volume into tiles based on a 128-voxel dimension constraint.

#### 6. Figures/Outputs
*   **Label Volume (TIFF)**: A single 3D image file containing the segmented labels, exported via `imsave`.
*   **Console Logs**: Prints the progress of the prediction, including tiling estimates and prediction status.

#### 7. Key Parameters
*   **`--input` / `-i`**: Path to the root of the input dataset in `z5` format.
*   **`--model` / `-m`**: Directory containing the StarDist3D model weights and configuration.
*   **`--channel` / `-c`** & **`--scale` / `-s`**: Metadata used to locate the specific resolution/channel within the hierarchical `z5` file structure.
*   **`affinity_thresh=0.1`**: The hard-coded threshold value for determining instance membership via affinities.

---

## containers/spot_assignment/conda-requirements.yml

This file is a configuration file used by the Conda package manager to define the software environment required for the `spot_assignment` container.

### 1. Purpose
This file specifies the exact software environment and dependency versions required to run the `spot_assignment` module. It ensures reproducibility by pinning specific library versions for scientific data processing tasks.

### 2. Key Functions/Classes
*   **Not applicable**: As a YAML configuration file, it does not contain executable logic, functions, or classes. It serves as a blueprint for environment creation.

### 3. Data Flow
*   **Processing**: This environment is designed to handle large-scale image data (via `z5py`/`zarr`) and tabular data (via `pandas`).
*   **Input/Output**: The environment supports the reading/writing of N-dimensional array data and the analytical output of spot assignment results, likely involving large-scale biological or physical image datasets.

### 4. Dependencies
The environment pulls from the following channels: `anaconda`, `conda-forge`, and `defaults`. Specific packages include:
*   **`pip`**: For installing additional Python packages.
*   **`numpy=1.19.4`**: Core numerical operations.
*   **`z5py=2.0.5`**: Python interface for the Z5 file system (used for storing multi-dimensional arrays).
*   **`zarr`**: A format for chunked, compressed, binary arrays.
*   **`pandas`**: Data manipulation and analysis.
*   **`scikit-image`**: Collection of algorithms for image processing.

### 5. Analysis Methods
While the file is a configuration, the inclusion of `scikit-image` and `numpy` suggests the module performs **image segmentation, feature extraction, or coordinate-based analysis** of "spots" (discrete features within an image).

### 6. Figures/Outputs
*   **None**: This file defines the infrastructure, not the scientific output. Expected outputs of the container using this environment likely include segmented image masks, spot coordinate lists (CSVs), or processed `zarr`/`n5` data archives.

### 7. Key Parameters
*   **`numpy=1.19.4`**: Version constraint ensures compatibility with older image-processing workflows.
*   **`z5py=2.0.5`**: Version constraint suggests specific compatibility with legacy `z5`/`n5` data formats used in the repository.

---

## containers/spot_assignment/maru.yaml

This file is a configuration manifest for a containerized module within the `multifish` repository, likely used in a high-performance computing (HPC) environment at Janelia Research Campus.

### 1. Purpose
This file serves as a metadata and registry configuration for the `spot_assignment` container module. It defines the container’s identity and identifies the remote image registries required to pull the environment necessary for executing spot-assignment algorithms in scientific imaging pipelines.

### 2. Key Functions/Classes
*   **None (Configuration File):** This file is a declarative YAML manifest used by a container orchestration tool (presumably `maru`) to manage software deployment rather than executing code directly.

### 3. Data Flow
*   **Reads:** None (the file is static configuration).
*   **Writes:** None.
*   **Processing:** This file acts as a lookup table for container orchestrators. It informs the system where to fetch the `spot_assignment` image, which presumably processes microscopy image data to map detected spots to biological structures.

### 4. Dependencies
*   **Infrastructure:** Depends on the `maru` container management system (implied by `maru_version`).
*   **Remote Registries:**
    *   `registry.int.janelia.org/multifish` (Internal Janelia registry)
    *   `public.ecr.aws/janeliascicomp/multifish` (Public AWS ECR)

### 5. Analysis Methods
*   **N/A:** As a configuration file, it does not contain implementations of scientific methods. However, the container it points to is architected for **spatial transcriptomics or microscopy spot assignment**, typically involving algorithms like point-cloud registration, Bayesian modeling, or nearest-neighbor classification.

### 6. Figures/Outputs
*   **N/A:** The file does not generate visual output; it ensures the *environment* exists to generate scientific outputs (e.g., spot coordinate CSVs, registered images).

### 7. Key Parameters
*   `maru_version` (0.1.1): Ensures compatibility with the specific deployment framework version.
*   `version` (1.3.0): Defines the specific release version of the `spot_assignment` logic.
*   `remotes`: A prioritized list of URIs used to resolve and pull the container image, providing redundancy between internal and public cloud infrastructures.

---

## containers/spot_assignment/scripts/python/assign_spots.py

This file is a Python utility script used for spatially assigning localized "spots" (likely molecular markers or points of interest) to specific segmented regions (e.g., cell or tissue labels) in a 3D image volume.

### 1. Purpose
The script maps 3D coordinate data from external files onto a segmented label image (N5 format) by converting physical coordinates to voxel space. It then generates a quantification table (CSV) reporting the number of spots contained within each unique segmented region.

### 2. Key Functions/Classes
*   **`__main__` block**: The script is designed for execution as a command-line utility. It handles argument parsing, orchestrates the coordinate conversion, performs the spatial lookup against the label map, and writes the summary output.
*   **External Utility (`n5_metadata_utils`)**: Used for interfacing with N5 datasets and retrieving voxel resolution metadata.

### 3. Data Flow
*   **Reads**: 
    *   A 3D label image (`lb_dir`) as a TIFF/image stack.
    *   A set of CSV files containing spot coordinates (`spot_glob_pattern`).
    *   N5 container metadata (`n5_path`, `segmentation_subpath`) for voxel dimensions.
*   **Processes**: Coordinates are divided by voxel spacing, rounded to the nearest integer, and used to index into the 3D label array.
*   **Writes**: A `count.csv` file summarizing the spot count for each label index across all input spot files.

### 4. Dependencies
*   **Standard Libs**: `os`, `sys`, `glob`.
*   **Scientific Stacks**: `numpy`, `pandas`, `skimage.io`.
*   **Internal**: `n5_metadata_utils` (a repository-specific module for N5/Zarr metadata handling).

### 5. Analysis Methods
*   **Spatial Mapping**: Uses a coordinate transformation technique: `rounded_spot = np.round(spot[:, :3] / vox)`. 
*   **Data Aggregation**: Uses Pandas DataFrames to perform grouping and frequency counting of spots per label ID.
*   **Input Validation**: Includes basic error handling to check for `NaN` values and coordinates falling outside the voxel grid boundaries.

### 6. Figures/Outputs
*   **Output File**: `count.csv`, which contains a table where rows represent unique label IDs and columns represent the filename (or prefix) of the input spot data, with cell values representing the total spot count per label.

### 7. Key Parameters
These are passed as command-line arguments:
*   `lb_dir`: File path to the segmented 3D label volume.
*   `spot_glob_pattern`: Unix-style pattern to locate input coordinate CSV files (e.g., `data/*.csv`).
*   `out_dir`: Directory path for saving the resulting CSV.
*   `n5_path`: Path to the source N5 dataset.
*   `segmentation_subpath`: Specific group/dataset path within the N5 container used to extract voxel spacing metadata.

---

## containers/spot_assignment/scripts/python/intensity_measurements.py

This analysis covers `containers/spot_assignment/scripts/python/intensity_measurements.py`, a script designed for quantitative image analysis in microscopy workflows.

### 1. Purpose
This script extracts mean intensity measurements for specified regions of interest (ROIs) from N5-formatted image data. It includes a specific processing step to subtract bleed-through artifacts from DAPI-stained channels before calculating final intensities.

### 2. Key Functions/Classes
This script is written as a procedural CLI tool rather than using formal classes or functions. Key logical blocks include:
*   **`skimage.measure.regionprops`**: Used to compute properties (specifically `mean_intensity`) of labeled objects within the image.
*   **`zarr.open` / `zarr.N5Store`**: Used to interface with multi-scale N5 image containers.

### 3. Data Flow
*   **Input**:
    *   `label_path`: A file containing a segmentation mask (labeled image).
    *   `puncta_path`: An N5 directory containing raw microscopy image data.
*   **Processing**:
    *   Reads the label file and the raw image data at a specific scale.
    *   Performs bleed-through correction if the current channel is designated as the "bleed channel."
    *   Maps intensity values from the raw image onto the labeled mask.
*   **Output**: A CSV file containing the ROI labels and their corresponding mean intensity values.

### 4. Dependencies
*   **Scientific Stack**: `numpy`, `pandas`, `scikit-image` (`skimage.measure`, `skimage.io`).
*   **I/O**: `zarr` (for N5 data handling), `os`, `sys`, `glob`.

### 5. Analysis Methods
*   **Bleed-through Correction**: Implements a signal subtraction method where a `dapi_factor` is calculated based on the ratio of intensity between the target channel and the DAPI channel in high-signal regions (above the 99.5th percentile).
*   **Intensity Measurement**: Uses `regionprops` to calculate the average intensity per object label, excluding background values (often represented as 0).

### 6. Figures/Outputs
*   **Output File**: A CSV file saved to the defined output directory (named `{r}_{channel}_intensity.csv`).
*   **Console Logs**: Prints diagnostics including the calculated `bleed_through` factor and background statistics for DAPI and the target channel.

### 7. Key Parameters
*   **`r`**: An identifier for the specific region or experimental round.
*   **`channel` / `scale`**: Specifies which channel and resolution (multiscale level) of the N5 dataset to process.
*   **`dapi_channel` / `bleed_channel`**: Configurable identifiers for the DAPI (reference) channel and the channel suspected of bleed-through artifacts.
*   **Percentile thresholds (99.5 and 1)**: Used as hardcoded logic to determine background levels and signal peaks for the bleed-through calculation.

---

## containers/spot_assignment/scripts/python/n5_metadata_utils.py

### Code Analysis: `n5_metadata_utils.py`

#### 1. Purpose
This module provides utility functions to read and manipulate metadata stored in N5/Zarr hierarchical formats, specifically for managing voxel resolution and grid dimensions in multi-scale imaging datasets.

#### 2. Key Functions/Classes
*   **`read_voxel_spacing`**: Calculates the physical voxel size by either reading the base resolution or applying downsampling factors to the base resolution for specific scale levels (`s0`, `s1`, etc.).
*   **`read_voxel_grid`**: Extracts the spatial dimensions (shape) of the dataset from the N5 attributes.
*   **`transfer_metadata`**: Copies missing attributes from a reference N5/Zarr path to a target path, ensuring metadata consistency between equivalent scale levels.
*   **`open_n5`**: Provides an interface to open an N5 dataset using the `zarr.N5Store` API.
*   **`read_n5_voxel_spacing` / `read_n5_voxel_grid`**: Improved Zarr-based implementations that replace direct JSON parsing with Zarr’s attribute accessors for more robust data extraction.

#### 3. Data Flow
*   **Input**: Filesystem paths to N5/Zarr containers and specific sub-paths (scale levels).
*   **Process**: Reads `attributes.json` files or utilizes the Zarr library to parse metadata keys (e.g., `pixelResolution`, `downsamplingFactors`, `dimensions`).
*   **Output**: Returns NumPy arrays representing voxel spacing or grid shapes; writes updated `attributes.json` files during metadata transfer operations.

#### 4. Dependencies
*   `json`: For parsing and serializing N5 attribute files.
*   `numpy`: For handling numerical calculations of voxel sizes and data type casting.
*   `zarr`: Used for the modernized API to access N5 stores and attributes.

#### 5. Analysis Methods
*   **Resolution Scaling**: Implements a hierarchical calculation method: `vox = pixelResolution * downsamplingFactors`.
*   **Dimension Inversion**: Uses `np.flip` on array shapes when reading via Zarr, accounting for the difference in coordinate ordering between Zarr metadata and N5 structure.
*   **Metadata Synchronization**: Performs a key-based dictionary merge to propagate missing attributes between datasets.

#### 6. Figures/Outputs
*   The script does not generate visual plots or figures.
*   **Outputs**: Console logs detailing the source and result of metadata reads, and updated `attributes.json` files on the disk.

#### 7. Key Parameters
*   `n5_path`: The directory path to the N5/Zarr container.
*   `subpath`: The specific internal path (e.g., `'s0'`, `'s1'`) identifying the scale level within the dataset.
*   `correct_subpath` (boolean): A flag to toggle logic for handling the `'s0'` folder naming convention when accessing attributes.

---

## containers/spot_extraction/README.txt

This document serves as an analysis of the `containers/spot_extraction/README.txt` file from the specified scientific repository.

### 1. Purpose
This file provides instructions for building a containerized environment (Airlocalize) used for spot extraction from microscopy images. It specifically mandates the manual inclusion of a required CTF (Common Tool Framework) file before the build process can commence.

### 2. Key Functions/Classes
*   **Airlocalize Container Build:** The file acts as a configuration/setup guide rather than code. The primary "function" is the orchestration of a container build process (likely Docker or Singularity) for image processing.

### 3. Data Flow
*   **Input:** Requires an external CTF file (downloaded via DOI: 10.25378/janelia.16373370).
*   **Processing Path:** The user must manually place the input file into the `compiled_matlab/AIRLOCALIZE_N5` directory within the repository structure to enable the container compilation.

### 4. Dependencies
*   **External Repository:** Requires a specific CTF file hosted on the Janelia Research Campus data repository.
*   **Environment:** Relies on MATLAB/compiled MATLAB components (inferred from the directory naming convention `compiled_matlab`).
*   **Infrastructure:** Requires containerization software (implied, likely Docker or similar) to execute the build.

### 5. Analysis Methods
*   **Spot Extraction:** While not explicitly detailed in the text file, the repository name ("Airlocalize") indicates the implementation of automated point-source detection (spot finding) in multidimensional microscopy data.

### 6. Figures/Outputs
*   **Outputs:** The ultimate output of the process described by this README is a container image capable of performing spot extraction.

### 7. Key Parameters
*   **File Path Configuration:** `compiled_matlab/AIRLOCALIZE_N5` (This is the critical directory location that must be satisfied for the build to function).
*   **Required Artifact:** The specific CTF archive linked via the provided DOI.

---

## containers/spot_extraction/compiled_matlab/AIRLOCALIZE_N5/__init__.py

### Analysis of `containers/spot_extraction/compiled_matlab/AIRLOCALIZE_N5/__init__.py`

#### 1. Purpose
This file serves as the initialization and configuration interface for executing deployed MATLAB functions (specifically related to the `AIRLOCALIZE_N5` package) within a Python environment. It manages the runtime environment, path configurations, and bridge between Python and the MATLAB Runtime (MCR).

#### 2. Key Functions/Classes
*   **`_PathInitializer` (Class)**: The core internal class responsible for detecting the operating system, verifying interpreter versions, locating the MATLAB Runtime on the host system, and dynamically updating system/Python paths to allow successful import of MATLAB-compiled modules.
*   **`initialize()`**: A public wrapper function that initializes the deployed MATLAB package and returns a handle for executing functions.
*   **`initialize_runtime(option_list)`**: Configures startup options for the MATLAB Runtime (e.g., `-nodisplay`).
*   **`terminate_runtime()`**: Explicitly shuts down the MATLAB Runtime instance.
*   **`import_cppext()`**: Attempts to dynamically load the C++ extension module (`matlabruntimeforpython...`) and performs extensive diagnostics if the import fails (e.g., path debugging).

#### 3. Data Flow
*   **Reads**: Environment variables (e.g., `PATH`, `LD_LIBRARY_PATH`), system architecture/OS info via `platform`, and configuration files (implicitly `paths.[arch].txt`).
*   **Processes**: Determines internal paths required for MATLAB binary execution; validates Python version compatibility (`3.9`, `3.10`, `3.11`).
*   **Writes/Updates**: Dynamically modifies `os.environ` and `sys.path` at runtime to inject the locations of MATLAB shared libraries and extension modules into the Python session.

#### 4. Dependencies
*   **Standard Library**: `os`, `sys`, `platform`, `importlib`, `re`, `atexit`, `weakref`, `glob`, `io`.
*   **MATLAB Dependencies**: Requires a pre-installed MATLAB Runtime (version 23.2) and the `matlab` and `matlab_pysdk` modules provided by the MATLAB Compiler SDK.

#### 5. Analysis Methods
*   **Scientific/Statistical**: None. This file is strictly infrastructure/glue code to facilitate the execution of external compiled MATLAB binaries (likely image processing/spot detection algorithms in the context of the repository).

#### 6. Figures/Outputs
*   **Outputs**: Returns a `package_handle` object, which acts as an interface to the compiled MATLAB code.
*   **Diagnostics**: Generates diagnostic strings (written to standard out via `io.StringIO`) if the import of the MATLAB runtime extension fails, aiding in troubleshooting environment path issues.

#### 7. Key Parameters
*   **`SUPPORTED_PYTHON_VERSIONS`**: Defines strictly compatible Python versions (3.9, 3.10, 3.11).
*   **`RUNTIME_VERSION_W_DOTS` / `RUNTIME_VERSION_W_UNDERSCORES`**: Specifies the required MATLAB Runtime version (`23.2`).
*   **`option_list`**: A list of startup flags (e.g., `-nodisplay`, `-nojvm`) passed to the MATLAB runtime during initialization.

---

## containers/spot_extraction/compiled_matlab/setup.py

This file serves as a standard Python packaging script for deploying a compiled MATLAB application as a Python library.

### 1. Purpose
This file is a `setup.py` configuration script designed to install a compiled MATLAB runtime component (AIRLOCALIZE_N5) into a Python environment. It ensures that the package is correctly bundled and cleans up temporary build artifacts upon successful installation.

### 2. Key Functions/Classes
*   **`InstallAndCleanBuildArea` (Class)**: A custom subclass of `distutils` or `setuptools` `install` command. It is designed to automatically remove build directories (`./build`, `./dist`) after the installation process completes to maintain a clean environment.
*   **`setup()`**: The core function from `setuptools` or `distutils` used to define package metadata, versioning, and installation requirements.

### 3. Data Flow
*   **Input**: Takes local project directories and package data files (specifically `.ctf` files, which are MATLAB Component Runtime archives).
*   **Processing**: Handles build-time configuration, conditionally importing `setuptools` or `distutils` based on the user's environment and command execution (e.g., `bdist_wheel`).
*   **Output**: Writes a standard Python package structure; deletes temporary build and distribution directories (`./build`, `./dist`) post-installation.

### 4. Dependencies
*   **Python Standard Library**: `sys`, `warnings`, `shutil` (`rmtree`), `os.path` (`exists`).
*   **Packaging Tools**: `setuptools` or `distutils`.
*   **External**: Requires the `wheel` module if performing a wheel distribution.

### 5. Analysis Methods
*   **None**: This is an administrative/infrastructure script for software distribution and does not contain scientific or statistical algorithms.

### 6. Figures/Outputs
*   **Output**: Generates a Python package named `AIRLOCALIZE_N5-R2023b`.
*   **Artifacts**: Produces distribution packages (e.g., wheels) or installs the package into `site-packages`.

### 7. Key Parameters
*   **`name`**: `AIRLOCALIZE_N5-R2023b` (The identifier for the installed package).
*   **`version`**: `23.2` (Corresponds to the MATLAB R2023b release).
*   **`package_data`**: Configured to include `*.ctf` files, which are essential for the MATLAB Runtime to execute the compiled code.
*   **`clean_dirs`**: `['./build', './dist']` (Targets for post-installation directory removal).

---

## containers/spot_extraction/conda-requirements.yml

This file is a configuration file used to define a virtual environment for a specific component of a scientific research project.

### 1. Purpose
This file defines the environment configuration for the `spot_extraction` container. It ensures that the software environment has the necessary Python packages and versions installed to facilitate reproducible scientific analysis.

### 2. Key Functions/Classes
*   **N/A**: As a configuration file, it does not contain executable code, functions, or classes.

### 3. Data Flow
*   **Process**: This file acts as a blueprint for setting up the environment. It does not perform data processing itself, but it prepares the execution context for processes that likely involve reading, extracting, and writing image or spatial transcriptomics data (indicated by the `zarr` dependency).

### 4. Dependencies
The environment requires the following packages to function:
*   **pip**: Used for installing additional Python packages.
*   **numpy=1.25.2**: Core library for numerical computing and array manipulation.
*   **zarr=2.16.1**: Library for chunked, compressed, N-dimensional arrays; typically used for handling large-scale biological imaging data.

### 5. Analysis Methods
*   **N/A**: While the choice of `zarr` and `numpy` suggests a workflow involving large-array data processing or spatial spot extraction (common in bioinformatics/genomics), the file itself defines the *tools* rather than the *methods*.

### 6. Figures/Outputs
*   **N/A**: This file does not generate figures or outputs. It simply governs the software environment in which analysis scripts will run.

### 7. Key Parameters
*   **Channels**: `anaconda`, `conda-forge`, and `defaults` determine the repositories from which packages are fetched.
*   **Version Constraints**: 
    *   `numpy=1.25.2`: Pins the version to ensure numerical consistency across different computing environments.
    *   `zarr=2.16.1`: Pins the version to ensure compatibility with specific data storage formats used in the project.

---

## containers/spot_extraction/maru.yaml

This file is a configuration manifest for the `maru` containerization framework, used within the MultiFISH project for managing computational environments.

### 1. Purpose
This file serves as a deployment/configuration manifest for a containerized component named `spot_extraction`. It defines the metadata and registry sources required to pull and manage the container image used for extracting biological "spots" (e.g., fluorescent mRNA signals) from microscopy data.

### 2. Key Functions/Classes
*   **None**: This is a YAML configuration file, not a script or program file. It provides declarative metadata for a container environment rather than implementing logic or classes.

### 3. Data Flow
*   **Input**: Not applicable (this file acts as an interface for container orchestration).
*   **Output**: Defines the source locations (registries) from which the container runtime pulls the `spot_extraction` image.

### 4. Dependencies
*   **Container Registries**:
    *   `registry.int.janelia.org/multifish` (Internal Janelia Research Campus registry)
    *   `multifish` (Local or aliased repository)
    *   `public.ecr.aws/janeliascicomp/multifish` (Public Amazon ECR registry for Janelia Scientific Computing)

### 5. Analysis Methods
*   **N/A**: As a configuration file, it does not contain scientific or statistical code. The logic for spot extraction is presumably encapsulated within the Docker/Apptainer image referenced by this file.

### 6. Figures/Outputs
*   **None**: This file defines the environment; it does not produce experimental results or figures.

### 7. Key Parameters
*   **`maru_version` (0.1.1)**: The version of the `maru` tool required to parse this configuration.
*   **`name` (spot_extraction)**: The identifier for this specific pipeline component.
*   **`version` (1.1.0)**: The semantic versioning of the `spot_extraction` software container.
*   **`remotes`**: A list of URI endpoints used to resolve the container image, providing redundancy for deployment in different network environments (internal vs. external).

---

## containers/spot_extraction/params/air_localize_default_params.txt

This analysis pertains to the configuration file `air_localize_default_params.txt`, which serves as a parameter definition file for the **AirLocally** (or AirLocalize) software, commonly used in microscopy for single-molecule localization and particle tracking.

### 1. Purpose
This file functions as a central configuration schema to define the detection, localization, and fitting parameters for microscopic spot extraction. It specifies the mathematical constraints and file paths required to process 3D image stacks into coordinate data for individual spots.

### 2. Key Functions/Classes
As this is a configuration file rather than an executable script, it defines the state for the following logic (implied by the software):
*   **Spot Detection:** Logic using thresholding and PSF (Point Spread Function) modeling.
*   **3D Localization:** Fitting routines based on the specified `3D mask full` method.
*   **Background Subtraction:** Estimation of local noise via the `bg_mode: local plane` setting.

### 3. Data Flow
*   **Input:** Reads 3D microscopy image stacks (e.g., `air_localize.tif`) from a specified directory.
*   **Processing:** Applies a Gaussian filter and thresholding, followed by 3D Gaussian fitting to refine spot coordinates.
*   **Output:** Generates coordinate files (implied) and, if enabled, processed images; stores results in the directory defined by `save_dirname`.

### 4. Dependencies
*   **Input Data:** Requires a multi-dimensional TIFF stack (standard imaging format).
*   **System Environment:** This file is intended for the `AirLocalize` software environment, likely a MATLAB-based or Python-based tool for single-molecule analysis.

### 5. Analysis Methods
*   **Integrated Gaussian Fitting:** Uses a 3D Gaussian model to estimate the center of fluorescent spots with sub-pixel precision.
*   **Thresholding:** Employs an absolute intensity threshold (`130`) to separate signal from background noise.
*   **Local Plane Background Estimation:** Uses `bg_mode: local plane` to model and remove spatially varying background signal across the image.
*   **Filtering:** Uses Bandpass/Noise filtering (`filter.nlo`, `filter.nhi`) to sharpen features before localization.

### 6. Figures/Outputs
*   **Coordinate Data:** Primarily outputs a list of localized spot centers (X, Y, Z coordinates).
*   **Visualization:** Can generate an `output_spot_image` (if enabled) showing the mask or detected spot map.

### 7. Key Parameters
*   **Physical Properties:** `sigma_xy` (1.4662) and `sigma_z` (2.864) define the expected PSF width, crucial for the fitting accuracy.
*   **Voxel Geometry:** `dx`, `dy`, `dz` define the pixel/voxel size in nanometers.
*   **Sensitivity:** `thresh.level` (130) and `thresh.sd` (50.6274) define the strictness of the signal-to-noise detection.
*   **Processing Mode:** `mode: single file input` indicates batch-process potential vs. individual file handling.
*   **Algorithm Config:** `fit: 3D mask full` sets the complexity of the fitting algorithm applied to detected spots.

---

## containers/spot_extraction/scripts/airlocalize.sh

This file serves as a wrapper script for executing the AirLocalize spot extraction tool within a containerized environment (typically MATLAB Runtime-dependent).

### 1. Purpose
The script manages environment configuration and temporary storage for the AirLocalize spot extraction pipeline. It ensures that the MATLAB Compiler Runtime (MCR) cache is correctly handled before invoking the primary Python processing script.

### 2. Key Functions/Classes
*   **`cleanTemp`**: A trap function triggered upon script exit that manages the deletion of the `MCR_CACHE_ROOT` directory unless the `KEEP_MCR` environment variable is set.

### 3. Data Flow
*   **Input**: Takes command-line arguments (`$*`) and passes them directly to the underlying `air_localize_mcr.py` script.
*   **Process**: Creates a temporary directory for MCR cache files based on the existence of a `$SCRATCH_DIR` variable.
*   **Output**: Executes the Python script, which processes microscopy images/data files (implied by the tool's name).

### 4. Dependencies
*   **Internal**: Depends on `/app/airlocalize/scripts/air_localize_mcr.py`.
*   **External**: Requires a Linux environment with `bash`, `mktemp`, and the MATLAB Compiler Runtime (MCR) to be pre-installed within the container.

### 5. Analysis Methods
*   **Spot Extraction**: While the specific algorithm is contained within the Python/MATLAB layer, the script facilitates the execution of "AirLocalize," a known scientific method for localizing individual molecules or sub-cellular structures in microscopy data using statistical fitting (e.g., Gaussian fitting).

### 6. Figures/Outputs
*   The script itself does not generate figures; it serves as a runner. Outputs (likely detected spot coordinates, localized intensity maps, or processed image files) are produced by the underlying `air_localize_mcr.py` script.

### 7. Key Parameters
*   **`SCRATCH_DIR`**: Defines the base directory for temporary cache files; if unset, falls back to the system's default `TMPDIR`.
*   **`KEEP_MCR`**: A flag (environment variable) that, if set, prevents the script from deleting the temporary MCR cache after the process terminates (useful for debugging).
*   **`$*`**: Passes positional arguments to the AirLocalize script (typically paths to input image files, configuration files, and output destinations).

---

## containers/spot_extraction/scripts/python/air_localize_mcr.py

This analysis provides a structured summary of the `air_localize_mcr.py` script, which serves as a bridge between Python data handling and a compiled MATLAB-based spot detection algorithm.

### 1. Purpose
This script automates the extraction of spot coordinates from N5 image data by executing a compiled MATLAB version of the AIRLOCALIZE algorithm. It handles data loading, background subtraction/bleedthrough correction (optional DAPI channel), and coordinate transformation to physical micrometer space.

### 2. Key Functions/Classes
*   **`as_matlab(arr)`**: Utility to convert NumPy arrays into MATLAB-compatible data types required by the compiled runtime.
*   **`read_coords(path)`**: Parses a text file to retrieve spatial offsets and extents for sub-region processing.
*   **`AIRLOCALIZE_N5.initialize()`**: Interfaces with the MATLAB Compiler Runtime (MCR) to execute the spot detection logic without requiring a full MATLAB license.

### 3. Data Flow
1.  **Input**: Reads N5 container path, subpath, coordinate offsets, parameters, and optional DAPI channel path from CLI arguments.
2.  **Processing**: Loads voxel data, calculates physical coordinates, and optionally performs DAPI-based bleedthrough correction.
3.  **MATLAB Execution**: Passes formatted 3D array to the compiled AIRLOCALIZE library.
4.  **Output**: Writes detected spot coordinates to a text file (`air_localize_points{suffix}`) in micrometer units.

### 4. Dependencies
*   **Standard/Scientific**: `numpy`, `sys`, `matlab`.
*   **Repository-Specific**: 
    *   `AIRLOCALIZE_N5`: Compiled MATLAB runtime wrapper.
    *   `n5_metadata_utils`: Helper module for N5 file format interactions and voxel spacing retrieval.

### 5. Analysis Methods
*   **Coordinate Transformation**: Maps voxel-space indices to micrometer space using: `points_um = (points_vox * vox) + offset`.
*   **Bleedthrough Correction**: Performs statistical subtraction of signal based on a DAPI channel. It calculates the median ratio of signal intensity between the main channel and DAPI (using the 99.5th percentile of DAPI to define the mask) and subtracts background/bleedthrough values.
*   **Data Reshaping**: Uses `np.moveaxis` to reconcile potential differences between NumPy (Z, Y, X) and MATLAB array storage formats.

### 6. Figures/Outputs
*   **Log Output**: Extensive console output regarding shapes, voxel counts, and runtime status for pipeline monitoring.
*   **Coordinate File**: A text file (saved as `air_localize_points{suffix}`) containing floating-point coordinates of detected spots in the coordinate system of the original image volume.

### 7. Key Parameters
*   **`params`**: A configuration file path (passed to the MATLAB function) that likely defines sensitivity thresholds, filtering, and model constraints for spot detection.
*   **`suffix`**: String identifier for the output filename to manage multi-tile or multi-channel outputs.
*   **`dapi_subpath` (Optional)**: If provided, triggers the bleedthrough correction workflow.

---

## containers/spot_extraction/scripts/python/cut_tiles.py

### Code Analysis: `containers/spot_extraction/scripts/python/cut_tiles.py`

#### 1. Purpose
This script automates the spatial decomposition of a large imaging dataset (stored in N5 format) into a grid of smaller, potentially overlapping tiles. It generates coordinate metadata for each tile to facilitate downstream parallel processing or spot extraction workflows.

#### 2. Key Functions/Classes
*   **`write_coords_file(path, offset, extent, index)`**: A utility function that saves the spatial boundaries (`offset`, `extent`) and the grid index of a specific tile to a text file.
*   **Main Execution Block**: Orchestrates the calculation of the grid, iterates through the 3D dimensions, creates directory structures for each tile, and triggers the coordinate file generation.

#### 3. Data Flow
*   **Reads**: 
    *   N5 dataset metadata (voxel grid dimensions and physical voxel spacing) via `n5_metadata_utils`.
    *   Command-line arguments defining paths and tiling parameters.
*   **Processes**: 
    *   Converts voxel-based dimensions into micrometer (physical) space.
    *   Calculates tile offsets and extents based on provided strides and overlaps.
*   **Writes**:
    *   A directory structure representing the tile index.
    *   A `coords.txt` file within each directory containing the spatial parameters required for downstream tasks.

#### 4. Dependencies
*   **Standard Python Libraries**: `json`, `sys`, `os`, `numpy`.
*   **Custom Repository Module**: `n5_metadata_utils` (used for parsing N5-specific image metadata).

#### 5. Analysis Methods
*   **Grid Tiling Logic**: Implements a sliding window algorithm where the grid size is calculated as $\text{grid\_dim} / (\text{stride} - \text{overlap})$, with a conditional constraint ensuring that remaining partial tiles are only created if they meet a `min_tile_size` threshold.
*   **Coordinate Transformation**: Maps voxel space to physical space (micrometers) by multiplying grid dimensions and stride/overlap values by the voxel resolution.

#### 6. Figures/Outputs
*   **Directory Structure**: A flat or hierarchical tree of folders representing the spatial grid.
*   **`coords.txt`**: A metadata text file per tile containing:
    *   Offset (start coordinates).
    *   Extent (tile dimensions).
    *   Index (grid position `[x, y, z]`).

#### 7. Key Parameters
*   **`ref_img_path` / `ref_img_subpath`**: Source path to the N5 image dataset.
*   **`xy_stride` / `z_stride`**: The distance between the start of consecutive tiles.
*   **`xy_overlap` / `z_overlap`**: The amount of overlap between adjacent tiles to prevent edge artifacts.
*   **`min_tile_size` (Hardcoded as 128)**: A minimum threshold value to determine if a remainder slice of the image should be treated as a full tile.

---

## containers/spot_extraction/scripts/python/merge_points.py

This file provides a utility script for stitching and filtering localized biological spots (typically identified by `airlocalize`) across different image tiles in a large-scale N5 dataset.

### 1. Purpose
The script merges processed spot location files from multiple image tiles into a single coordinate space. It performs spatial filtering to remove redundant detections in overlap regions and converts the results into a voxel-space format compatible with BigDataViewer/RS-FISH.

### 2. Key Functions/Classes
*   **`read_coords(path)`**: Parses a `coords.txt` file to retrieve spatial metadata (offset, extent, and grid index) for a specific tile.
*   **`__main__` block**: Orchestrates the sequential loading of point files, applies margin-based overlap filtering, performs unit conversion, and writes final outputs.

### 3. Data Flow
*   **Input**: Reads multiple `.txt` point files (via glob pattern) and spatial coordinate files (`coords.txt`) per tile; reads geometry/metadata from an N5 container.
*   **Process**: Filters points out of bounds based on calculated overlap margins; transforms coordinate systems from microns to voxel space.
*   **Output**: Saves two CSV files: one containing points in micrometer units and another formatted for BigDataViewer/RS-FISH (voxel units with specific column formatting).

### 4. Dependencies
*   **Libraries**: `sys`, `numpy`, `glob`, `os.path`.
*   **Internal**: `n5_metadata_utils` (a repository-specific module used for reading N5 container geometry, voxel spacing, and grid definitions).

### 5. Analysis Methods
*   **Overlap Trimming**: Implements a margin-based logic to resolve redundancy. It checks if a tile is at a grid boundary (`index != 0` or `ends < grid`). If not at the boundary, it trims points falling within the `xy_overlap` or `z_overlap` margins.
*   **Coordinate Transformation**: Scales micrometer-based point coordinates to a target resolution defined by the `voxel_scale_subpath`.

### 6. Figures/Outputs
*   **`output_microns`**: A text file containing merged point data in micrometer coordinates.
*   **`output_voxels`**: A CSV file formatted as `x,y,z,t,c,intensity`, designed for direct visualization in BigDataViewer via the RS-FISH plugin.

### 7. Key Parameters
*   **`tile_glob_pattern`**: Pattern to locate individual tile result files.
*   **`xy_overlap` / `z_overlap`**: Overlap width used to discard duplicate detections at tile boundaries.
*   **`n5_path`**: Path to the N5 container for retrieving spatial geometry.
*   **`extraction_subpath` / `voxel_scale_subpath`**: Paths within the N5 structure used to read voxel spacing and grid dimensions for coordinate mapping.

---

## containers/spot_extraction/scripts/python/n5_metadata_utils.py

### Analysis of `n5_metadata_utils.py`

#### 1. Purpose
This utility script provides tools for reading and managing metadata from N5/Zarr scientific data containers. It simplifies the retrieval of voxel spacing and grid dimensions, as well as the transfer of metadata attributes between datasets.

#### 2. Key Functions/Classes
*   **`read_voxel_spacing` / `read_n5_voxel_spacing`**: Calculates the physical size of a voxel by multiplying resolution and downsampling factors. The newer `n5` version uses the `zarr` API.
*   **`read_voxel_grid` / `read_n5_voxel_grid`**: Extracts the spatial dimensions (shape) of the dataset; the modern implementation utilizes `np.flip` to account for N5-to-Zarr coordinate ordering.
*   **`transfer_metadata`**: A helper function to copy missing attributes from a reference dataset to a target dataset, provided they are at the same scale level.
*   **`open_n5`**: A factory function that opens an N5 container using `zarr.N5Store`.

#### 3. Data Flow
*   **Input**: Reads `attributes.json` files located within N5 directory structures or directly accesses metadata via the `zarr` API.
*   **Process**: Performs arithmetic on resolution/downsampling arrays and handles path string manipulation.
*   **Output**: Returns NumPy arrays containing voxel spacing (floats) or grid dimensions (uint16); optionally writes updated metadata back to an `attributes.json` file.

#### 4. Dependencies
*   `json`: Standard library for parsing attribute metadata files.
*   `numpy`: Used for array operations and data type casting.
*   `zarr`: Used for high-level interaction with N5 storage formats.

#### 5. Analysis Methods
*   **Coordinate Transformation**: Implements standard logic for multi-scale N5 data where voxel resolution is hierarchical, requiring the multiplication of base resolution by downsampling factors for sub-scales.
*   **Metadata Synchronization**: Implements a simple key-value merging process to ensure consistency between different N5 container structures.

#### 6. Figures/Outputs
*   **Console Logs**: The module provides diagnostic output indicating which metadata keys are being accessed and calculated.
*   **Filesystem Changes**: The `transfer_metadata` function modifies `attributes.json` files on disk.

#### 7. Key Parameters
*   `n5_path`: The file system path to the N5 root directory.
*   `subpath`: The specific internal path (dataset node) within the N5 container.
*   `pixelResolution`: A key in `attributes.json` defining the base dimensions of a voxel.
*   `downsamplingFactors`: A key in `attributes.json` representing the scale ratio relative to the base resolution.

***

**Analyst Note:** The code contains a mixture of legacy file-IO based approaches (using `open()`) and modern `zarr` library approaches. The script contains an explicit `TODO` indicating a migration path toward replacing the manual file-reading methods with the cleaner `zarr`-based utility functions.

---

## containers/spot_extraction/scripts/python/post_rsfish.py

This file, `post_rsfish.py`, is a utility script designed to convert coordinate data generated by the RS-FISH (Real-time Super-resolution Fluorescence In Situ Hybridization) tool from voxel units to physical (micron) units.

### 1. Purpose
The script performs coordinate transformation on spot-detection output files, scaling spatial coordinates from voxel space to real-world micron dimensions using metadata derived from an N5 container. It prepares RS-FISH data for downstream biological analysis by normalizing the output units and removing redundant temporal/channel metadata.

### 2. Key Functions/Classes
*   **Main Execution Block (`if __name__ == '__main__':`)**: Acts as the primary driver for the script, handling command-line argument parsing, N5 metadata retrieval, coordinate conversion, and file saving.

### 3. Data Flow
1.  **Read**: Takes an N5 path/subpath to retrieve spatial scaling (voxel size).
2.  **Read**: Loads RS-FISH spot detections (CSV format, voxel coordinates).
3.  **Process**: Scales X, Y, Z coordinates by the voxel spacing; removes time (t) and channel (c) columns from the dataset.
4.  **Write**: Outputs the cleaned, scaled coordinates as a new CSV file in micron space.

### 4. Dependencies
*   **`numpy`**: Used for array manipulation and numerical computation.
*   **`n5_metadata_utils` (Local/Repo File)**: A custom internal library used to interface with the N5 storage format (specifically for `open_n5`, `read_n5_voxel_spacing`, and `read_n5_voxel_grid`).

### 5. Analysis Methods
*   **Spatial Transformation**: Performs a linear scaling operation: $Coordinate_{micron} = Coordinate_{voxel} \times Spacing_{voxel}$.
*   **Data Cleaning/Filtering**: Uses array slicing and deletion to prune non-spatial dimensions (Time and Channel index 3 and 4) from the input matrix.

### 6. Figures/Outputs
*   **Output File**: A comma-delimited CSV file containing the converted coordinates in micron space, representing the physical locations of detected FISH spots.

### 7. Key Parameters
*   `input_voxels`: Path to the raw CSV output from RS-FISH.
*   `output_microns`: Destination path for the transformed CSV.
*   `n5_path`: The root file path of the N5 container.
*   `extraction_subpath`: The specific dataset path within the N5 container to extract resolution/metadata from.

---

## containers/stitching/maru.yaml

This file is a configuration manifest for the **Maru** build system, used to define the containerization and build process for the `stitching` project. It automates the packaging of a Java-based image processing tool.

### 1. Purpose
This file serves as a build configuration manifest for a containerized stitching application. It defines the source repository, build environment, and deployment parameters required to compile and containerize the `stitching-spark` Java application.

### 2. Key Functions/Classes
*   **`main_class` (org.myapp.MyClass)**: Defines the entry point for the Java application execution within the container.
*   **`mvn package`**: The primary build command executed to compile the source code and create the deployment artifact (JAR file).

### 3. Data Flow
*   **Reads**: Fetches source code from the remote Git repository (`https://github.com/saalfeldlab/stitching-spark.git`).
*   **Processes**: Uses the Java Maven build process to compile source code into an executable package.
*   **Writes**: Produces a container image (managed via the specified registry remotes) containing the compiled Java application.

### 4. Dependencies
*   **`stitching-spark`**: The core application logic hosted on GitHub.
*   **JDK 8**: The required runtime environment for the Java application.
*   **Maven**: The build automation tool required for dependency management and packaging.
*   **External Registries**: References `multifish` and AWS ECR registries for container distribution.

### 5. Analysis Methods
*   **Stitching**: While the specific implementation is abstracted, the project name (`stitching-spark`) implies the use of Apache Spark for distributed image stitching (likely alignment/registration of microscopy datasets).

### 6. Figures/Outputs
*   **Container Image**: The primary output is a containerized application ready for deployment in a high-performance computing (HPC) or cloud environment.

### 7. Key Parameters
*   **`STITCHING_SPARK_GIT_TAG`**: Determines the specific version/branch of the source code to be built (`master` is currently set).
*   **`jdk_version: "8"`**: Specifies the Java runtime environment version, critical for compatibility with the project's dependencies.
*   **`remotes`**: Specifies the container registries used for pushing and pulling the build artifacts.

---

## data-sets/demo_medium.txt

### File Analysis: `data-sets/demo_medium.txt`

#### 1. Purpose
This file acts as a **manifest or registry** for external dataset dependencies. It provides the necessary metadata, including file names, MD5 checksums, and remote download URLs, to facilitate the automated retrieval of specific experimental data and pre-trained models required for the project.

#### 2. Key Functions/Classes
*   **None**: This is a static text file containing data records. It is likely consumed by a download script or a data-loader utility (e.g., using `requests` or `urllib` in Python) to verify file integrity post-download.

#### 3. Data Flow
*   **Input**: The file serves as a reference source for a data acquisition script.
*   **Process**: A script reads this file, iterates through the rows, downloads the files from the provided Janelia Figshare URLs, and compares the downloaded file's MD5 hash against the provided checksum to ensure data integrity.
*   **Output**: Local files (`.mvl`, `.czi`, `.zip`) saved into the local repository environment.

#### 4. Dependencies
*   **External**: Requires network connectivity to access `janelia.figshare.com`.
*   **Internal**: Requires an external utility script (typically found in the repo's `scripts/` or `utils/` directory) capable of parsing tab-separated text and verifying file checksums.

#### 5. Analysis Methods
*   **Checksum Verification**: Uses MD5 hashing to validate that the downloaded research data matches the version intended by the researchers.

#### 6. Figures/Outputs
*   **No direct figures**: The file facilitates the acquisition of raw microscopy data (`.czi` - Zeiss imaging format), associated metadata (`.mvl`), and a model weight file (`model.zip`) which likely support subsequent image processing or machine learning pipelines.

#### 7. Key Parameters
*   **File Identifier**: The filename (e.g., `LHA3_R3_medium.czi`).
*   **MD5 Checksum**: The cryptographic hash used for integrity verification.
*   **Download URL**: The unique URL pointing to the research data hosted on Figshare.

---

## data-sets/demo_small.txt

This file is a manifest or pointer file used in a scientific research repository to manage the retrieval of large external datasets and model files.

### 1. Purpose
This file serves as a lookup table or manifest to facilitate the automated download and verification of specific small-scale demonstration datasets and a pre-trained model file from the Janelia Research Campus Figshare repository.

### 2. Key Functions/Classes
*   **N/A**: This is a static data file (a manifest), not an executable script. It is designed to be parsed by a shell script, Python downloader, or data ingestion utility (e.g., `wget`, `curl`, or a custom `data_loader.py` script).

### 3. Data Flow
*   **Reads**: N/A (The file itself is a static input for a download manager).
*   **Processes**: It lists URI-based resources that are likely downloaded to a local `/data` directory during repository setup.
*   **Writes**: It provides the metadata necessary for a local script to write files (e.g., `.mvl`, `.czi`, `.zip`) to the disk.

### 4. Dependencies
*   **External**: The files are hosted on [figshare.com](https://janelia.figshare.com).
*   **Internal**: The file is dependent on a corresponding repository script (typically found in a `/scripts` or `/utils` folder) that performs the checksum validation using the provided MD5 hashes.

### 5. Analysis Methods
*   **Integrity Verification**: The second column provides MD5 checksums, which are used to ensure that the downloaded files are not corrupted and match the exact versions intended for the scientific analysis.

### 6. Figures/Outputs
*   **Primary Outputs**:
    *   `*.mvl` files: Likely proprietary microscopy or imaging metadata files.
    *   `*.czi` files: Zeiss microscopy image files (common in bio-imaging research).
    *   `model.zip`: A compressed archive containing pre-trained model weights or configurations.

### 7. Key Parameters
*   **File URI**: The URL provides the specific endpoint for the resource.
*   **MD5 Checksum**: The hash acts as a unique identifier and security parameter to ensure data reproducibility and provenance.

---

## data-sets/demo_small3.txt

This file acts as a **manifest or configuration file** used for managing dataset dependencies in a scientific research repository. It provides a structured list of remote data assets required for a specific experiment or demonstration.

---

### 1. Purpose
The file serves as a lookup table for downloading and verifying specific research datasets and model files from the Janelia Figshare repository. It ensures that the project can retrieve the necessary raw data (CZI/MVL formats) and pre-trained models required to execute pipeline scripts.

### 2. Key Functions/Classes
*   **N/A**: This is a static data-reference file. It likely contains no executable logic itself but is intended to be parsed by a loader script (e.g., a Python script using `requests` or `urllib`) to facilitate automated data fetching.

### 3. Data Flow
*   **Reads**: The file is read as an input by an automated data-downloading utility or shell script.
*   **Processes**: It maps human-readable filenames to MD5 checksums and persistent URL endpoints.
*   **Writes**: It facilitates the writing of files to the local disk, which are subsequently validated against the provided checksums to ensure data integrity before further scientific analysis.

### 4. Dependencies
*   **External**: Depends on the [Janelia Figshare](https://janelia.figshare.com/) infrastructure.
*   **Internal**: Likely consumed by an internal `data_loader.py` or `setup.sh` script within the repository that handles the mapping and validation logic.

### 5. Analysis Methods
*   **Integrity Verification**: Employs **MD5 hashing** to verify the integrity of the downloaded scientific data, ensuring that the local files match the source files exactly.

### 6. Figures/Outputs
*   **Outputs**: When processed by the repository's tools, this file results in the local installation of:
    *   **Microscopy Data**: `.czi` files (likely ZEISS microscopy images) and `.mvl` files (associated metadata or visualization files).
    *   **Pre-trained Models**: A `model.zip` file containing weights or parameters for a machine learning model.

### 7. Key Parameters
The file structure defines three critical parameters per row:
*   **Filename**: Identifier for the resource.
*   **MD5 Checksum**: The cryptographic hash used for file integrity validation.
*   **Source URL**: The specific download endpoint for the asset on Figshare.

---

## data-sets/demo_tiny.txt

### Code Analysis: `data-sets/demo_tiny.txt`

#### 1. Purpose
This file serves as a manifest or registry for downloading sample/demo datasets hosted on Figshare. It provides the necessary metadata, including file names, integrity checksums (MD5), and direct download URLs to ensure reproducible access to research data.

#### 2. Key Functions/Classes
*   **None.** This is a static text file, not an executable script or module. It functions as a data lookup table.

#### 3. Data Flow
*   **Read**: The file is intended to be read by a download script (likely a Python or shell script within the repository) to automate the retrieval of remote datasets.
*   **Process**: No internal processing occurs. The file acts as a reference for verifying the integrity of downloaded files (using the provided MD5 hashes).

#### 4. Dependencies
*   **External**: Requires `curl`, `wget`, or a similar network utility to process the URLs.
*   **Integrity Verification**: Relies on system utilities (e.g., `md5sum` on Linux or `md5` on macOS) to validate the downloaded blobs against the provided hashes.

#### 5. Analysis Methods
*   **N/A**: This file does not contain analytical logic. It simply provides the raw input files (`.mvl` and `.czi` microscopy/imaging formats) and a `model.zip` file which likely contains the machine learning weights or configuration needed for the research pipeline.

#### 6. Figures/Outputs
*   **None**: The file is a pointer to inputs. The outputs would be generated by subsequent analysis pipelines that process the downloaded files.

#### 7. Key Parameters
*   **File Identifier**: Filename (e.g., `LHA3_R3_tiny.mvl`).
*   **Checksum**: MD5 hash string for verifying file integrity and preventing corruption.
*   **URL**: The remote endpoint for fetching the dataset from the Janelia Research Campus Figshare repository.

---
**Analyst Note:** This file structure is typical for scientific repositories that utilize "data-as-code" versioning, where large binary files (microscopy data, model weights) are hosted externally to keep the Git repository size manageable.

---

## data-sets/segmentation.txt

### Analysis of `data-sets/segmentation.txt`

The provided file functions as a **pointer/manifest file** rather than a script or executable code. It is designed to facilitate the downloading of a pre-trained machine learning model used for image segmentation tasks.

---

#### 1. Purpose
This file acts as a manifest for a remote binary asset, providing the necessary metadata to securely download a zipped machine learning model from a Figshare repository for use within the research pipeline.

#### 2. Key Functions/Classes
*   **None**: This is a configuration/data file. It contains no executable code, functions, or classes.

#### 3. Data Flow
*   **Reads**: N/A (The file itself is a static reference).
*   **Writes**: N/A.
*   **Processes**: This file is intended to be parsed by a download script or a data-loading utility to fetch the `model.zip` file, verify its integrity using the provided MD5 hash, and extract it for the segmentation pipeline.

#### 4. Dependencies
*   **External**: The file depends on the [Janelia Figshare infrastructure](https://janelia.figshare.com/) for hosting the actual binary payload.
*   **Internal**: Likely depends on a file-management utility (e.g., a Python script using `requests` or `wget`) within the repository to parse the URL and verify the MD5 checksum.

#### 5. Analysis Methods
*   **Integrity Verification**: The inclusion of an MD5 hash (`7c4b6de492abba160cfa9d7c2bbb4592`) indicates that the system uses checksum validation to ensure the model file has not been corrupted or altered during download.

#### 6. Figures/Outputs
*   **Outputs**: Upon processing, the system outputs the `model.zip` archive, which presumably contains model weights (e.g., `.h5`, `.pth`, or `.onnx` files) and configuration metadata required for segmentation inference.

#### 7. Key Parameters
*   **Filename**: `model.zip` (The local destination name).
*   **Checksum**: `7c4b6de492abba160cfa9d7c2bbb4592` (MD5 signature for security/validation).
*   **URL**: `https://janelia.figshare.com/ndownloader/files/26271079` (The remote source location).

---

## docs/About.md

This file serves as the documentation landing page for a computational pipeline associated with the Janelia Research Campus. Below is the structured analysis:

### 1. Purpose
This file provides contextual information about the computational pipeline, including its project origins, licensing, and associated academic/data citations. It serves as an informative metadata file for users navigating the repository.

### 2. Key Functions/Classes
*   **None**: This is a static documentation file (Markdown) and does not contain executable code, classes, or functions.

### 3. Data Flow
*   **None**: The file does not process, read, or write data. It provides links to external datasets, specifically regarding the EASI-FISH project and related experiments (e.g., LHA3_R3, LHA3_R5).

### 4. Dependencies
*   **External Repositories**: The document references the [EASI-FISH repository](https://github.com/multiFISH/EASI-FISH) as the primary upstream project.
*   **Janelia Licensing**: References the Janelia Open Source Software policy.

### 5. Analysis Methods
*   **None**: The file describes the project but does not implement the underlying scientific methodologies. However, it references established methods, including a "Segmentation model" cited via a DOI.

### 6. Figures/Outputs
*   **None**: The file does not generate figures or software outputs. It acts solely as a reference document.

### 7. Key Parameters
*   **None**: No configurable parameters are defined in this file.

---

## docs/Home.md

This document serves as the landing page and technical overview for the EASI-FISH spatial transcriptomics analysis pipeline.

### 1. Purpose
This file provides a high-level overview of the EASI-FISH analysis pipeline, which automates the processing of spatial transcriptomics data, including image stitching, registration, segmentation, and spot quantification.

### 2. Key Functions/Modules
The pipeline is modularized into the following functional units:
*   **stitching**: Uses distributed computing (Spark) to assemble image tiles.
*   **spot_extraction**: Detects transcript spots using specialized tools (Airlocalize or RS-FISH).
*   **segmentation**: Identifies cell boundaries using the Starfinity algorithm.
*   **registration**: Aligns multiple imaging rounds using the Bigstream distributed pipeline.
*   **warp_spots**: Transforms coordinates of detected spots to match registration results.
*   **measure_intensities**: Extracts intensity values from processed images.
*   **assign_spots**: Integrates spot counts with segmented cell data.

### 3. Data Flow
The pipeline processes raw fluorescence microscopy imagery through a sequential workflow. It supports flexible execution where modules can be run independently or skipped via parameters, provided that the intermediate outputs are correctly placed in the designated directory structure for downstream tasks.

### 4. Dependencies
*   **Workflow Engine**: Nextflow (implied by references to `main-*.nf` scripts).
*   **Computational Framework**: Apache Spark (for distributed stitching).
*   **External Software**: Airlocalize, RS-FISH, Starfinity, and Bigstream.
*   **Data Type**: EASI-FISH (Expansion-Assisted Iterative Fluorescence *In Situ* Hybridization) imagery.

### 5. Analysis Methods
*   **Distributed Computing**: Utilizes Spark for parallelized processing of large imaging datasets.
*   **Registration**: Multi-round spatial alignment.
*   **Segmentation**: Cell-based feature extraction.
*   **Spatial Mapping**: Coordinate transformation (warping) and spatial spot-to-cell assignment.

### 6. Figures/Outputs
*   **Pipeline Diagram**: An architectural visualization of the data processing steps (`images/pipeline_diagram.png`).
*   **Outputs**: The pipeline generates localized spot counts, cell segmentation masks, and intensity measurements, culminating in integrated spatial transcriptomics data.

### 7. Key Parameters
*   `--skip`: Allows users to bypass specific pipeline modules, provided the required intermediate data is pre-populated in the project structure.
*   `main-*.nf`: Alternate entry points for executing individual pipeline modules in isolation.

---

## docs/Parameters.md

This file is a technical documentation page for a bioinformatics/imaging analysis pipeline, detailing the configuration parameters required to run the pipeline using Nextflow.

### 1. Purpose
This document serves as the primary reference for users to configure environment variables and pipeline parameters for a high-performance imaging analysis workflow. It covers data management, stitching, registration, cell segmentation, and spot extraction steps.

### 2. Key Functions/Modules
The pipeline is structured into distinct modular stages:
*   **Data Handling**: Manages input manifests, MD5 verification, and directory organization.
*   **Stitching**: Uses Spark for merging image tiles (CZI/MVL files).
*   **Registration**: Uses the *Bigstream* algorithm for affine and deformable image alignment.
*   **Cell Segmentation**: Uses *Starfinity* for machine learning-based cell segmentation.
*   **Spot Extraction**: Supports two algorithms: *AirLocalize* and *RS-FISH* (for sub-cellular spot detection).

### 3. Data Flow
*   **Inputs**: Reads raw CZI/MVL acquisition files and model files via `data_manifest`.
*   **Process**: Data is staged in shared working directories (e.g., FSx/Lustre), processed via Spark/Singularity containers, and converted to N5 formats.
*   **Outputs**: Final results (registered images, segmented cells, and spot coordinates) are written to an output directory, with an option to publish to external storage like S3.

### 4. Dependencies
*   **Nextflow**: The workflow orchestration engine.
*   **Singularity/Docker**: Used for containerized execution.
*   **Apache Spark**: Used for distributed processing (specifically in stitching and RS-FISH).
*   **External Modules**: Bigstream (registration), Starfinity (segmentation), and AirLocalize/RS-FISH (spot extraction).

### 5. Analysis Methods
*   **Imaging Physics**: Flatfield correction, coordinate axis mapping, and voxel resolution management.
*   **Registration**: Affine and deformable alignments (Bigstream), RANSAC for robust spot matching.
*   **Segmentation**: Deep learning-based inference (Starfinity).
*   **Spot Detection**: Difference-of-Gaussian (DoG) filtering, background subtraction, and intensity calculation (RS-FISH/AirLocalize).

### 6. Figures/Outputs
*   **Outputs**: Directory-structured results including registered imagery, segmentation masks, and localized spot CSV/coordinate files.
*   **Logs**: Spark worker logs and pipeline diagnostic files stored in the designated `spark_work_dir` and output directories.

### 7. Key Parameters
*   **Infrastructure**: `shared_work_dir`, `workers`, `worker_cores`, `gb_per_core` (Spark/Resource scaling).
*   **Imaging**: `channels`, `dapi_channel`, `resolution`, `axis`.
*   **Registration**: `aff_scale`, `def_scale`, `ransac_dist_threshold`.
*   **Segmentation**: `segmentation_scale`.
*   **Spot Extraction**: `use_rsfish` (toggle), `rsfish_sigma`, `rsfish_threshold`, `rsfish_background`.

---

## docs/QuickStart.md

This file is a documentation guide for setting up and initiating the EASI-FISH analysis pipeline.

### 1. Purpose
This file provides instructions for users to set up and run the EASI-FISH processing pipeline either via the Nextflow Tower GUI or a command-line interface. It serves as a central onboarding resource for deploying the repository on local workstations or high-performance computing (HPC) clusters.

### 2. Key Functions/Classes
*   **`setup.sh`**: Initializes the environment by pulling external dependencies required for the pipeline.
*   **`main.nf`**: The core Nextflow execution script that triggers the pipeline workflow.
*   **`examples/` scripts (`demo_tiny.sh`, `demo_small.sh`, `demo_medium.sh`)**: Helper scripts that automate data downloading and pipeline execution for validation purposes.

### 3. Data Flow
*   **Input**: Downloads demo datasets (from Janelia Figshare) based on the size specified in the demo script.
*   **Process**: Orchestrates scientific processing via the `main.nf` script using provided data directories.
*   **Output**: Writes processed analysis results into a user-defined directory, typically subdivided into `inputs`, `outputs`, and `spark` directories.

### 4. Dependencies
*   **Nextflow**: Version 20.10.0+ (Workflow orchestration).
*   **Singularity**: Version 3.5+ (Containerization).
*   **Git**: Used for repository cloning with recursive submodules.
*   **Conda** (optional): For managing the Nextflow installation.

### 5. Analysis Methods
While the file does not implement methods itself, it directs the user to the EASI-FISH pipeline. The pipeline is designed for high-throughput spatial transcriptomics data processing, utilizing Apache Spark (indicated by the `spark` directory) for distributed data computation.

### 6. Figures/Outputs
*   **Primary Outputs**: Standardized data output folders (`inputs`, `outputs`, and `spark` logs).
*   **Performance Metrics**: Resource usage patterns (e.g., the `demo_tiny` set requires ~40 cores and 128 GB RAM for a 30-minute run).

### 7. Key Parameters
*   **`data dir`**: The root directory for storing source data and resultant outputs.
*   **Arguments**: Command-line flags passed to `main.nf` to control step skipping, resource allocation, and workflow monitoring (e.g., Nextflow Tower integration).

---

## docs/Running.md

This file, `docs/Running.md`, serves as the primary user manual for executing the scientific image processing pipeline, detailing how to organize data, configure parameters, and interpret the resulting outputs.

### 1. Purpose
This document provides instructions for users on how to run a CZI/MVL-based image processing pipeline, covering input management, command-line execution via Nextflow, and the interpretation of downstream analysis results.

### 2. Key Functions/Processes
*   **Data Provisioning**: Explains how to set up the `shared_work_dir` and utilize either a data manifest (automated download) or manual file placement.
*   **Pipeline Execution**: Documents how to trigger the pipeline using the Command Line Interface (CLI) or Nextflow Tower.
*   **Data Transformation**: Orchestrates sequential processing steps, including stitching, segmentation, registration, spot extraction, intensity measurement, and cell assignment.

### 3. Data Flow
*   **Input**: Reads `.czi` (imagery) and `.mvl` (metadata) files from the `shared_work_dir/inputs/` directory.
*   **Intermediate Processing**: Stores operational metadata, retiled images, and transformation matrices within subdirectories corresponding to specific pipeline steps.
*   **Output**: Writes structured results (TIFF, N5, and CSV files) to the `shared_work_dir/outputs/` directory.

### 4. Dependencies
*   **Nextflow**: Used as the workflow orchestration engine.
*   **Singularity**: Required for containerized job execution.
*   **External Repositories**: Links to `saalfeldlab/stitching-spark` for stitching logic and mentions `RS-FISH` for spot detection.

### 5. Analysis Methods
*   **Stitching**: Uses multi-view metadata to convert imagery to N5 format with flatfield correction.
*   **Segmentation**: Produces cell segmentation masks (TIFF).
*   **Registration**: Performs RANSAC-based affine alignment between fixed and moving acquisitions.
*   **Spot Detection**: Supports both AirLocalize and RS-FISH algorithms to extract coordinates in microns or voxels.
*   **Quantification**: Measures spot intensities per segmented cell (ROI) and performs cell assignment.

### 6. Figures/Outputs
*   **Metadata**: `tiles.json`, `c<channel>-n5.json`.
*   **Imagery**: `export.n5` (stitched), warped imagery for registration, and segmentation TIFFs.
*   **Analysis Data**: CSV files containing intensity measurements (`intensities`), spot coordinates (`spots_CH.txt`), and cell-level assignments (`assignments`).

### 7. Key Parameters
*   `shared_work_dir`: Defines the root directory for all pipeline I/O.
*   `data_manifest`: Path to a file defining input dependencies and MD5 checksums.
*   `acq_names`: Comma-separated list of acquisitions to process.
*   `ref_acq`: Specifies which acquisition serves as the registration reference.
*   `channels` / `dapi_channel`: Defines which image channels to process and identify for nuclei staining.
*   `runtime_opts`: Used for mounting host directories into the execution container.

---

## docs/Troubleshooting.md

This file is a troubleshooting guide for users of a Nextflow-based scientific pipeline. It provides instructions on log management, resolving common execution errors, and managing temporary storage requirements.

### 1. Purpose
This document serves as a technical manual to help users debug pipeline failures related to Nextflow execution, resource allocation (memory/CPU), and storage limitations during containerized processing.

### 2. Key Functions/Classes
*   **Log Management (`nextflow log`)**: Utilities to query execution history using Run IDs and regex filtering.
*   **Error Diagnostic Procedures**: Guidelines for interpreting exit codes (130/137) and locating process-specific logs.
*   **Storage Configuration**: Instructions for redirecting cache and temporary file directories to avoid "no space left on device" errors.

### 3. Data Flow
*   **Read**: Reads pipeline logs (`.nextflow.log`, `.command.log`) and environmental system paths.
*   **Write**: Modifies external environment variables (e.g., `SINGULARITY_TMPDIR`) and pipeline parameter files to re-route cache and temporary storage.

### 4. Dependencies
*   **Nextflow**: The workflow orchestration engine.
*   **Singularity/Apptainer**: Used for container runtime and image conversion.
*   **Docker**: Used as the source for container images.
*   **MATLAB**: Specifically referenced regarding its extraction cache requirements.
*   **Compute Environments**: Refers to infrastructure like AWS, IBM Platform LSF, and Janelia-specific cluster architectures.

### 5. Analysis Methods
*   **Process-level Debugging**: Uses regex pattern matching (`-F` flag) to isolate logs for specific sub-tasks (e.g., "registration," "coarse_spots").
*   **Resource Scaling**: Provides heuristics for adjusting memory and CPU allocation based on specific exit codes and cluster-specific policies (e.g., Janelia’s CPU-to-memory mapping).

### 6. Figures/Outputs
*   **Logs**: Terminal outputs from Nextflow and process-specific `.command.log` files.
*   **Error Messages**: Documented system/FATAL errors that signal specific failure modes (e.g., storage exhaustion or memory limits).

### 7. Key Parameters
*   `registration_stitch_memory`: Controls memory limits for registration processes.
*   `SINGULARITY_TMPDIR`: Specifies the directory for container extraction.
*   `--singularity_cache_dir`: Sets the global cache location for SIF-format images.
*   `--local_scratch_dir`: Overrides the default location for MATLAB extraction tasks.

---

## docs/Visualization.md

This document serves as a guide for visualizing EASI-FISH spatial transcriptomics data, detailing workflows for inspecting stitched images, registration results, segmentation masks, and spot extraction outputs using common bio-imaging software.

### 1. Purpose
This file provides instructions and workflows for inspecting and validating large-scale EASI-FISH imaging data using Fiji (n5-viewer, TrakEM2, RS-FISH) and Napari. It outlines how to perform quality control across different stages of the data processing pipeline, including registration, segmentation, and spot detection.

### 2. Key Functions/Classes
*   **n5-viewer**: Used for 3D visualization of stitched volumes and multichannel overlays.
*   **RS-FISH (Fiji Plugin)**: Used for overlaying detected FISH spots onto raw image data.
*   **Napari**: Used for flexible, scriptable visualization of segmentation masks and large-scale volumetric data.
*   **TrakEM2**: Recommended specifically for manual inspection and correction of complex cell segmentation masks.

### 3. Data Flow
*   **Inputs**: Stitched n5 image volumes, segmentation masks (typically labels), and spot detection files (`.txt` or `.csv`).
*   **Processing**: Users map coordinate systems (physical to pixel) and load subsets or downsampled scales (e.g., `s2`, `s3`) to manage memory.
*   **Outputs**: Interactive visual inspection, overlaid overlays (registration/spots/masks), and programmatic cell-level metadata visualization.

### 4. Dependencies
*   **Software**: [Fiji](https://imagej.net/software/fiji/downloads), [Napari](https://napari.org/), [n5-viewer](https://github.com/saalfeldlab/n5-viewer), [RS-FISH](https://github.com/PreibischLab/RS-FISH).
*   **Code Modules**: Referenced Jupyter notebooks for image visualization (`1_Image_visualization.ipynb`) and cell ID-based queries (`2_Visualization_by_cell_ID.ipynb`).

### 5. Analysis Methods
*   **Multichannel Merging**: Overlaying registered and fixed volumes using Fiji for alignment verification.
*   **Coordinate Transformation**: Applying specific scaling factors to map physical spot coordinates to image pixel coordinates.
*   **Downsampling (Multi-scale inspection)**: Loading lower-resolution pyramidal scales (`s2`, `s3`) to visualize large data volumes within standard workstation RAM limits.
*   **Cell-Querying**: Spatially filtering large volumes based on metadata derived from segmentation outputs.

### 6. Figures/Outputs
*   **Visual Documentation**: The file includes numerous placeholders for screenshots demonstrating:
    *   n5-viewer interface for volume navigation.
    *   TrakEM2 and Napari for mask inspection.
    *   RS-FISH overlay of detected spots.
*   **Video Tutorials**: Link to a YouTube guide for Napari visualization.

### 7. Key Parameters
*   **`--pointScaling`**: A vector (e.g., `4.34, 4.34, 2.38`) required for translating physical coordinates of spots to image pixel coordinates.
*   **`--d` (Channel)**: Specifies the imaging channel (e.g., `c0`) for spot detection overlays.
*   **Image Scale**: Selection of `sN` levels to balance visualization detail with hardware memory constraints.

---

## docs/_config.yml

### Analysis of `docs/_config.yml`

This file is a configuration manifest for a Jekyll-based documentation site. It acts as the central control for the metadata, theme, and deployment settings for the project's web documentation.

---

#### 1. Purpose
This file configures the Jekyll static site generator to host documentation for the **EASI-FISH Nextflow Pipeline**. It establishes the site's identity, design theme, and navigational structure for the project’s documentation portal.

#### 2. Key Functions/Classes
*   **Jekyll Site Configuration**: Serves as the primary configuration object for the Jekyll engine, defining site-wide variables accessible through Liquid templating (`{{ site.variable }}`).

#### 3. Data Flow
*   **Reads**: This file is read by the Jekyll build process to generate HTML files for the documentation site.
*   **Writes**: Does not perform active data processing; instead, it dictates how documentation source files (likely Markdown) are rendered and served to the user.

#### 4. Dependencies
*   **`pmarsceill/just-the-docs`**: An external Jekyll theme used to provide the structural layout and styling of the documentation site.
*   **Jekyll Environment**: Requires the Jekyll Ruby gem ecosystem to parse this file and build the site.

#### 5. Analysis Methods
*   **N/A**: This file contains configuration metadata rather than scientific algorithms or statistical models.

#### 6. Figures/Outputs
*   **Documentation Portal**: The primary output is a hosted website (located at `https://janeliascicomp.github.io/multifish/`) that renders scientific documentation for the pipeline.
*   **Google Analytics**: Integrates tracking to monitor user traffic to the documentation pages.

#### 7. Key Parameters
*   **`title` / `description`**: Defines the project identity (EASI-FISH Nextflow Pipeline).
*   **`url` / `baseurl`**: Configures the site's deployment path and domain.
*   **`aux_links`**: Defines the navigation link pointing to the main GitHub repository (`JaneliaSciComp/multifish`).
*   **`ga_tracking`**: Contains the Google Analytics ID (`G-DG75YS4HX3`) for web traffic monitoring.

---

## docs/development/AWSBatch.md

This file provides technical documentation and manual configuration steps for deploying a custom AWS Batch environment to run scientific Nextflow pipelines, primarily intended for users who are not utilizing Nextflow Tower.

### 1. Purpose
The document serves as a "how-to" guide for manually setting up EC2-based compute environments (CPU and GPU) on AWS, including storage mounting (EFS/S3) and infrastructure deployment via the Serverless Framework.

### 2. Key Functions/Operations
*   **Infrastructure Provisioning**: Steps to configure EFS volumes and specific ECS-optimized AMI instances.
*   **Environment Configuration**: Shell scripts to install dependencies (`aws-cli`, `miniconda`, `nfs-utils`), mount network drives, and configure Docker runtimes (specifically `nvidia` for GPU instances).
*   **Deployment**: Instructions for using `npm` and the Serverless Framework (`serverless.yml`) to deploy the AWS Batch environment.
*   **Pipeline Execution**: Documentation on the `nextflow run` command to trigger the pipeline on the configured AWS infrastructure.

### 3. Data Flow
*   **Reads**: Raw experimental data stored in **AWS S3** buckets.
*   **Writes**: Temporary files, spark working directories, and final analysis results are stored on the **EFS (Elastic File System)** volume.
*   **Processing**: Data is fetched from S3 to compute nodes, processed via CPU/GPU instances, and results are persisted to EFS.

### 4. Dependencies
*   **Infrastructure**: AWS Batch, AWS EFS, AWS S3, ECS-optimized AMIs.
*   **Software/Packages**: `npm` (for Serverless), `miniconda`, `s3fs-fuse`, `nfs-utils`, and Docker (with NVIDIA runtime support for GPU nodes).
*   **Repository Files**: `serverless.yml` (main infrastructure definition file), `main.nf` (the Nextflow pipeline script).

### 5. Analysis Methods
While the file is a setup guide, the pipeline execution example references specific scientific computational steps:
*   **Image Segmentation**: Utilizing `starfinity` models.
*   **Data Processing**: Image stitching and localization (e.g., `airlocalize` parameters).
*   **Distributed Computing**: Use of Spark for large-scale data processing (`--spark_work_dir`).

### 6. Figures/Outputs
*   **Outputs**: Final processed segmentation data and analysis results stored in the defined `/efs-multifish/results/` directory.

### 7. Key Parameters
*   **Compute Resources**: `--worker_cores`, `--gb_per_core`, `--segmentation_cpus`, and `--airlocalize_memory`.
*   **Environment Paths**: EFS mount points (`/efs-multifish`) and S3 mount points (`/s3-multifish`).
*   **Pipeline Specifics**: `--channels`, `--stitching_ref`, `--dapi_channel`, `--acq_names`, and `--segmentation_model_dir`.
*   **Timeout settings**: `--wait_for_spark_timeout_seconds`.

---

## docs/development/Development.md

This file, `docs/development/Development.md`, serves as a developer guide for maintaining and contributing to the repository. Below is the structured analysis:

### 1. Purpose
This file provides instructional documentation for contributors regarding environment setup, submodule management, schema modification, and container lifecycle management for the scientific pipeline. It ensures consistency in how external dependencies, documentation, and Docker/AWS infrastructure are updated.

### 2. Key Functions/Classes
*   **Submodule Management**: CLI workflows for initializing, updating, and modifying external repository pointers.
*   **Schema Maintenance**: Guidance on using the `nf-core` schema builder to manage the `nextflow_schema.json` configuration.
*   **Documentation Automation**: CLI commands to extract parameter documentation from JSON schema files.
*   **Container Operations**: Instructions for building, managing, and pushing Docker/ECR images via the `maru` build tool.

### 3. Data Flow
*   **Reads**: `nextflow_schema.json` (as input for the nf-core schema builder).
*   **Writes**: Updates to local git pointers for submodules; `temp.md` (intermediate documentation file); Docker images to Docker Hub/AWS ECR.

### 4. Dependencies
*   **Git**: Required for submodule orchestration.
*   **nf-core tools**: Used for schema management and documentation generation.
*   **maru**: A container build tool developed by Janelia SciComp.
*   **Docker & AWS CLI**: Required for container registry authentication and deployment.

### 5. Analysis Methods
*   *Note: This is a documentation file, not an implementation file.* It outlines methods for pipeline configuration rather than statistical or scientific analysis.

### 6. Figures/Outputs
*   **Output File**: `docs/Parameters.md` (updated via documentation generation workflow).
*   **Artifacts**: Container images (pushed to Docker Hub or AWS ECR).

### 7. Key Parameters
*   **`nextflow_schema.json`**: The core configuration file that defines pipeline inputs, types, and descriptions.
*   **Submodule paths** (e.g., `external-modules/spark`): Specific directory paths that require manual pointer management.

---

## docs/modules/Modules.md

Based on the provided content, here is the structured summary for the file `docs/modules/Modules.md`:

### 1. Purpose
This file serves as a structural documentation index for the "Modules" section of the repository's technical documentation. It acts as a parent page (hub) to organize and link sub-modules within the project.

### 2. Key Functions/Classes
*   **Not Applicable**: As a Markdown documentation file, it contains no executable code, functions, or classes.

### 3. Data Flow
*   **None**: The file is purely descriptive and does not process, read, or write scientific data.

### 4. Dependencies
*   **Jekyll/GitHub Pages**: It uses YAML front matter (`layout`, `has_children`, `nav_order`) which indicates it is processed by a static site generator (likely Jekyll) to build the repository's documentation website.

### 5. Analysis Methods
*   **Not Applicable**: Does not implement any scientific or statistical methods.

### 6. Figures/Outputs
*   **Navigation Structure**: The primary output is a rendered web page that facilitates hierarchical navigation for the user, linking to child documentation pages.

### 7. Key Parameters
*   **`has_children: true`**: Configures the site generator to look for sub-pages or sub-directories under this path to populate the navigation menu.
*   **`nav_order: 15`**: Sets the display priority of this section in the documentation sidebar.

---

## docs/modules/RS-FISH.md

This file serves as the documentation module for the **RS-FISH** (Radial Symmetry-FISH) integration within a broader scientific image analysis pipeline.

### 1. Purpose
This documentation explains how to integrate and configure the RS-FISH spot detection method into the project's processing pipeline. It provides instructions for both automated pipeline execution and interactive parameter optimization using Fiji.

### 2. Key Functions/Classes
*   **RS-FISH (Fiji Plugin):** The primary tool used for interactive spot detection and parameter tuning.
*   **Pipeline Wrapper:** The underlying module that executes RS-FISH programmatically when the `--use_rsfish` flag is triggered.
*   **Tools (RS-FISH):** Contains sub-utilities for calculating anisotropy and visualizing detections in the BigDataViewer.

### 3. Data Flow
*   **Input:** Microscopy image data (typically N5 or TIFF formats).
*   **Processing:** Users select a representative image crop to iteratively find parameters. The pipeline then applies these parameters to full-scale datasets, potentially leveraging Spark clusters for distributed processing.
*   **Output:** Generates coordinate files/detection results that can be reviewed using BigDataViewer.

### 4. Dependencies
*   **RS-FISH Fiji Plugin:** Requires the "Radial Symmetry" update site in Fiji/ImageJ.
*   **N5:** Data storage format for large-scale image datasets.
*   **BigDataViewer:** Used for visualizing the resulting spot detections.
*   **Spark:** Mentioned as a backend for handling distributed computation of large datasets.

### 5. Analysis Methods
*   **Radial Symmetry:** An optimized mathematical approach for localized spot detection in microscopy images.
*   **RANSAC (Random Sample Consensus):** Used for robust fitting of models to spot data to improve detection accuracy.
*   **Anisotropy Correction:** Implements geometric compensation for pixel size differences in Z-stacks versus X-Y planes.

### 6. Figures/Outputs
*   **Visualizations:** Spot detection overlays viewable in the BigDataViewer.
*   **Macro Scripts:** Fiji-generated macro code containing specific parameter settings for reproducibility.
*   **Result Files:** Programmatic outputs containing the localized coordinates of detected spots.

### 7. Key Parameters
*   `--rsfish_sigma`: Controls the sensitivity of the spot detection.
*   `--rsfish_anisotropy`: Corrects for Z-axis distortion common in microscopy.
*   `--rsfish_min/max`: Defines the intensity range for the spot distribution.
*   `robust_fitting`: Specifies the use of the RANSAC algorithm.
*   `spot_intensity_threshold`: Sets the signal-to-noise cutoff for individual spot identification.

---

## docs/platforms/AWS.md

Based on the provided content of `docs/platforms/AWS.md`, here is the structured summary:

1. **Purpose**: This file serves as documentation for users who want to deploy or execute the research software on Amazon Web Services (AWS) infrastructure. It specifically directs users to utilize the Nextflow Tower interface as the primary deployment method.

2. **Key Functions/Classes**: N/A (The file is purely documentation and contains no executable code, functions, or classes).

3. **Data Flow**: The file does not process data; it acts as a navigational pointer for users to connect their AWS infrastructure with the Nextflow Tower platform.

4. **Dependencies**: 
   - **External**: AWS (Amazon Web Services), Nextflow Tower.
   - **Internal**: References `docs/NextflowTower.html` within the repository structure.

5. **Analysis Methods**: None.

6. **Figures/Outputs**: None.

7. **Key Parameters**: None specified in this document.

---

## docs/platforms/LSF.md

This document is a technical configuration guide for running a scientific computational pipeline on an IBM Platform LSF (Load Sharing Facility) cluster.

### 1. Purpose
This file provides instructions for executing the project pipeline on HPC (High Performance Computing) environments managed by LSF. It specifically guides users on how to configure the Nextflow pipeline to interface with the cluster scheduler using Singularity containers.

### 2. Key Functions/Classes
*   **Nextflow `-profile lsf`**: The primary command-line argument used to switch the execution environment from local/default to the LSF cluster scheduler.
*   **`lsf_opts`**: A parameter utilized to pass specific cluster-level submission flags (e.g., project accounting codes) directly to the `bsub` command.

### 3. Data Flow
*   **Reads**: It references the global `nextflow.config` file to determine cluster-specific execution logic.
*   **Processes**: It orchestrates the submission of pipeline tasks to compute nodes.
*   **Writes**: Does not process data directly; rather, it manages the containerized execution environment where data processing tasks occur.

### 4. Dependencies
*   **Singularity**: Required on all cluster nodes for containerization.
*   **IBM Platform LSF**: The underlying workload manager/scheduler software.
*   **Nextflow**: The workflow orchestration framework.
*   **External Reference**: `nextflow.config` (located in the repository root).

### 5. Analysis Methods
*   **Containerized Execution**: Uses Singularity to ensure environment reproducibility across distributed cluster nodes.
*   **Task Scheduling**: Utilizes the `bsub` mechanism to manage resource allocation and job queuing on the cluster.

### 6. Figures/Outputs
*   The file does not generate visual outputs; it serves as documentation for managing the compute environment. Pipeline outputs are generated by the processes configured within the underlying `nextflow.config` and the workflow scripts.

### 7. Key Parameters
*   **`-profile lsf`**: Triggers the LSF-specific configuration block.
*   **`--lsf_opts`**: Allows users to inject arbitrary `bsub` options (e.g., memory limits, wall time, project billing codes) without modifying the central configuration file.

---

## docs/platforms/Local.md

This document is a configuration and usage guide for running a scientific computational pipeline on a local Linux-based machine.

### 1. Purpose
This file provides documentation on how to execute a bioinformatics/computational pipeline on a local workstation using containerization technologies (Singularity or Docker).

### 2. Key Functions/Classes
This is a documentation file (Markdown), not a source code file. It defines the execution modes for the pipeline:
*   **Default/Standard Profile:** Executes the pipeline using pre-configured local settings.
*   **`localsingularity` Profile:** Explicitly configures the pipeline to use Singularity containers for process isolation.
*   **`localdocker` Profile:** Configures the pipeline to use Docker containers for process isolation.

### 3. Data Flow
*   **Reads:** Pipeline arguments provided via the command line (`[arguments]`) and necessary container images.
*   **Processes:** The main Nextflow script (`main.nf`) orchestrates the execution of scientific processes within the specified containerized environment.
*   **Writes:** The specific output data is determined by the pipeline processes defined in `main.nf`.

### 4. Dependencies
*   **Nextflow:** The workflow management system used to run `main.nf`.
*   **Container Engines:** Requires either **Singularity** or **Docker** to be pre-installed on the host Linux system.
*   **External Documentation:** Depends on `../QuickStart.html` for prerequisite installation instructions.

### 5. Analysis Methods
This file acts as a wrapper document; the underlying scientific/statistical methods are implemented within the pipeline scripts (`main.nf`) and associated containerized software, rather than this document itself.

### 6. Figures/Outputs
None. This file contains text-based instructions and does not generate scientific outputs.

### 7. Key Parameters
*   **`-profile`**: A mandatory flag to specify the execution environment (e.g., `localsingularity`, `localdocker`).
*   **`[arguments]`**: The user-defined input parameters (typically data paths, reference files, or workflow options) required by the pipeline.

---

## docs/platforms/Platforms.md

This file serves as documentation for the platform compatibility and portability of the research pipeline.

### 1. Purpose
This file provides documentation regarding the execution environments supported by the pipeline. It informs users that the pipeline is containerized and compatible with various infrastructure providers via Nextflow.

### 2. Key Functions/Classes
*   **Not applicable**: As this is a Markdown documentation file (`.md`), it contains no executable functions, classes, or logic.

### 3. Data Flow
*   **Not applicable**: The file does not perform data processing. It acts as a reference for infrastructure requirements.

### 4. Dependencies
*   **Nextflow**: The file explicitly states the pipeline's reliance on Nextflow for portability and execution management.

### 5. Analysis Methods
*   **None**: The file describes infrastructure compatibility rather than scientific or statistical methodology.

### 6. Figures/Outputs
*   **None**: No figures or computational outputs are generated by this file.

### 7. Key Parameters
*   **Not applicable**: There are no configurable parameters within this documentation file.

---

## docs/tower/NextflowTower.md

### Analysis of `docs/tower/NextflowTower.md`

This file serves as a documentation page within a scientific repository, providing guidance on how to integrate the Nextflow Tower (now known as Seqera Platform) GUI for pipeline execution and monitoring.

---

### 1. Purpose
This file provides user instructions for utilizing Nextflow Tower to orchestrate and monitor scientific pipelines. It acts as a configuration guide for choosing between local (Janelia) and cloud-based execution environments.

### 2. Key Functions/Classes
*   **Nextflow Tower (Integration)**: Not a code class, but a reference to the external SaaS/on-premise GUI platform used to trigger and track workflow execution.

### 3. Data Flow
*   **Reads**: Pipeline configurations and metadata defined within the repository.
*   **Writes**: Status updates and logs to the Nextflow Tower dashboard; pipeline execution logs are typically streamed to the selected compute backend (on-prem or cloud).

### 4. Dependencies
*   **External**: [Nextflow Tower (Seqera)](https://tower.nf/) account and infrastructure.
*   **Network**: Requires Janelia VPN or internal campus network access (if running on internal infrastructure).

### 5. Analysis Methods
*   **Workflow Orchestration**: Implements managed pipeline execution, allowing users to abstract the complexities of compute cluster submission (e.g., SLURM) or cloud instance provisioning (e.g., AWS Batch).

### 6. Figures/Outputs
*   **Web Dashboard**: Generates real-time execution graphs, resource usage metrics, and job-level logs within the Tower GUI.

### 7. Key Parameters
*   **Execution Environment**: Choice between "Janelia" (on-premises) or "Cloud."
*   **Network Access**: Explicit requirement for VPN access for internal infrastructure.

---

## docs/tower/NextflowTowerAWS.md

This document serves as a user guide for running a specific scientific pipeline on the AWS cloud platform using the Nextflow Tower (now Seqera Platform) interface.

### 1. Purpose
This file provides instructional documentation for configuring and launching a research pipeline on AWS using the Nextflow Tower service. It details the steps required to set up a compute environment, register a pipeline, and manage data input for execution.

### 2. Key Functions/Classes
*Note: As a documentation file, it describes workflows rather than code classes.*
*   **Compute Environment Setup**: Instructions for using "Tower Forge" to provision AWS Batch resources.
*   **Pipeline Launchpad**: GUI-based configuration for pipeline parameters and execution.
*   **Data Ingestion**: Procedures for mapping remote (HTTP/S3) data sources to the pipeline.

### 3. Data Flow
*   **Input**: Pipeline parameters are provided via JSON files (e.g., `demo_tiny.json`). Data is ingested either via HTTP download (using a data manifest) or directly from an AWS S3 bucket.
*   **Processing**: Execution is handled by the AWS Batch environment, using an `fsx` mount as the `shared_work_dir`.
*   **Output**: Processed results are written to an S3 bucket defined by the `publish_dir` parameter.

### 4. Dependencies
*   **Nextflow Tower (tower.nf)**: The orchestration platform.
*   **AWS Services**: Specifically AWS Batch for compute and Amazon S3 for storage.
*   **FSx**: Used for high-performance shared file storage during execution.

### 5. Analysis Methods
This document does not define specific scientific or statistical methods; it acts as a wrapper for executing a computational pipeline whose specific analysis logic is contained elsewhere in the repository.

### 6. Figures/Outputs
*   **Visual Documentation**: Includes placeholders for screenshots showing:
    *   AWS compute environment configuration.
    *   Pipeline registration in the Tower Launchpad.
*   **Pipeline Outputs**: The document assumes successful execution results in organized data files stored in the designated `publish_dir` (S3 bucket).

### 7. Key Parameters
*   `shared_work_dir`: Path to the FSx mount for intermediate pipeline files.
*   `publish_dir`: The destination path (mounted S3 bucket) for final results.
*   `data_dir`: The directory containing raw input data.
*   `Allowed S3 buckets`: A security/configuration setting within the compute environment required for data access.

---

## docs/tower/NextflowTowerJanelia.md

This file is a documentation page providing instructions for setting up and running the EASI-FISH computational pipeline on the Janelia Research Campus's internal LSF (Load Sharing Facility) cluster using Nextflow Tower.

### 1. Purpose
This document provides a step-by-step guide for Janelia researchers to configure their local environment and the Nextflow Tower interface to execute scientific pipelines on the internal high-performance computing cluster.

### 2. Key Functions/Classes
*   **SSH Key Management:** Procedures for generating and authorizing RSA keys for password-less authentication.
*   **Nextflow Installation:** CLI commands for installing the Nextflow runtime and adding it to the user's system path.
*   **Tower Compute Environment Configuration:** Instructions for mapping the LSF cluster settings into the Nextflow Tower GUI.

### 3. Data Flow
*   **Input:** Users provide a JSON parameters file (e.g., `demo_tiny.json`) and a data manifest to the pipeline.
*   **Processing:** The pipeline reads raw input data, performs computation on the Janelia LSF cluster, and stores intermediate/final outputs in a user-defined shared work directory (recommended on NRS storage).

### 4. Dependencies
*   **Infrastructure:** Access to the Janelia internal network and the Janelia Compute Cluster.
*   **Software:** Nextflow, OpenID Connect (for authentication), and Java (specifically Zulu 17, as per the config).
*   **External Repositories:** The pipeline definition hosted at `https://github.com/JaneliaSciComp/multifish`.

### 5. Analysis Methods
*   **Distributed Computing:** Leverages IBM LSF workload management to parallelize the EASI-FISH processing workflow.
*   **Pipeline Orchestration:** Uses Nextflow to manage job dependencies, resource allocation, and data flow across the compute nodes.

### 6. Figures/Outputs
*   **Visual Documentation:** Contains two instructional screenshots:
    *   `compute_env_lsf.png`: Configuration layout for the LSF compute environment.
    *   `new_pipeline_lsf.png`: Launchpad configuration settings for the pipeline.
*   **System Output:** Generates processed image data and pipeline execution logs within the user-specified `shared_work_dir`.

### 7. Key Parameters
*   **`NXF_JAVA_HOME`:** Set to `/misc/sc/jdks/zulu17` to ensure compatibility.
*   **`shared_work_dir`:** Path to high-speed storage for intermediate/final analysis outputs.
*   **`Config profiles`:** Set to `lsf` to align with cluster-specific configuration files.
*   **`Queue name`:** Fixed to `local`.
*   **`Per job mem limit`:** Enabled to manage cluster memory constraints.

---

## examples/demo_medium.sh

This analysis covers the `examples/demo_medium.sh` script, which serves as an entry point for testing the EASI-FISH analysis pipeline.

### 1. Purpose
This script automates the end-to-end execution of the EASI-FISH analysis pipeline for a medium-sized dataset. It handles environment configuration (temporary directories) and launches the primary Nextflow pipeline using predefined parameters.

### 2. Key Functions/Classes
*   **Shell Scripting Logic**: Uses standard bash utilities (`mkdir`, `realpath`) to prepare the execution environment.
*   **Pipeline Invocation**: Executes `main.nf` (the central Nextflow controller) with specific configurations for the demo dataset.

### 3. Data Flow
*   **Input**: Takes a user-specified directory as an argument where input data is downloaded based on an internal manifest.
*   **Intermediate Processing**: Utilizes a configurable `$TMPDIR` and Singularity cache/tmp directories to manage large container images and temporary data processing.
*   **Output**: Writes processed analysis results back to the specified `<data dir>`.

### 4. Dependencies
*   **Nextflow**: The workflow orchestrator used to run the pipeline (`main.nf`).
*   **Singularity (Apptainer)**: Used for containerization (evident by `SINGULARITY_TMPDIR` and `SINGULARITY_CACHEDIR` environment variables).
*   **Docker**: Implied requirement for images handled by Singularity.
*   **Local Files**: Depends on `examples/demo_medium.json` for task-specific parameterization.

### 5. Analysis Methods
While the script itself is an orchestrator, it triggers the **EASI-FISH pipeline**. This pipeline typically involves:
*   **Registration**: Aligning acquisition images.
*   **Spark-based processing**: Distributed compute tasks (inferred from the memory/worker configuration comments).

### 6. Figures/Outputs
*   **Processed Data**: The script stores the results of the end-to-end pipeline in the directory provided by the user.
*   **Logs**: Execution logs generated by Nextflow.

### 7. Key Parameters
*   **Memory/Resource Management**: 
    *   `workers`, `worker_cores`, `gb_per_core`: Configured for a 40-core machine with 128 GB of RAM.
    *   `TMPDIR`: Critical for ensuring sufficient disk space (requires ~10 GB) for container images.
*   **Configuration File**: `-params-file "./examples/demo_medium.json"` defines the pipeline parameters specific to this demonstration.
*   **Runtime Options**: `--runtime_opts "-B $datadir -B $TMPDIR"` handles bind-mounting directories into the containerized environment.

---

## examples/demo_small.sh

### Structured Summary: `examples/demo_small.sh`

#### 1. Purpose
This shell script serves as an entry point to execute an end-to-end demonstration of the EASI-FISH analysis pipeline using a small, representative dataset. It automates the environment setup, data downloading, and execution of the Nextflow pipeline.

#### 2. Key Functions/Classes
*   **Initialization block**: Manages environment variables for Singularity (container engine), ensuring sufficient storage space is allocated in `TMPDIR` (10 GB+).
*   **Execution block (`./main.nf`)**: Invokes the core Nextflow pipeline script, passing the configuration file and directory constraints to handle the end-to-end processing.

#### 3. Data Flow
*   **Input**: The user provides a `<data dir>` as a command-line argument. The script downloads a "small cutout" of the LHA3 dataset into this directory.
*   **Processing**: The data is processed via the `main.nf` pipeline, which utilizes the specified directory for both temporary work files and final outputs.
*   **Output**: Results are generated and stored within the user-provided data directory.

#### 4. Dependencies
*   **Nextflow**: The workflow orchestration engine (`./main.nf`).
*   **Singularity**: Used for containerized execution of analysis tools.
*   **Configuration File**: `./examples/demo_small.json`, which contains the specific pipeline parameters for the demo.
*   **Environment**: Requires a Linux-based environment (Bash) with sufficient hardware resources (tested on 40-core/128GB RAM).

#### 5. Analysis Methods
*   **EASI-FISH Pipeline**: While the script itself is a wrapper, it implements a pipeline designed for EASI-FISH (Expansion-Assisted Iterative Fluorescence In-Situ Hybridization) data, specifically focusing on acquisition registration and large-scale spatial image processing.

#### 6. Figures/Outputs
*   The script produces a processed dataset in the designated `datadir`. Specific outputs include registered images/data derived from the LHA3 cutout.

#### 7. Key Parameters
*   **`TMPDIR`**: Configurable via environment; crucial for providing 10GB+ of space for Docker/Singularity image caching.
*   **`--runtime_opts`**: Configures container bind mounts (`-B`) to ensure the pipeline has read/write access to host directories.
*   **Memory Parameters**: The script comments reference the tuning of `workers`, `worker_cores`, and `gb_per_core`, which determine the total Spark memory allocated for image registration tasks.
*   **`$@`**: Passes additional command-line arguments directly to the Nextflow pipeline.

---

## examples/demo_small3.sh

This analysis covers the `examples/demo_small3.sh` shell script, which serves as a wrapper for executing the EASI-FISH analysis pipeline on a subset of data.

### 1. Purpose
This script automates the end-to-end execution of the EASI-FISH analysis pipeline on a small demonstration dataset. It handles the environment configuration, directory setup, and invokes the Nextflow-based pipeline to process raw data.

### 2. Key Functions/Classes
*   **Shell Environment Setup**: Configures directory paths and temporary storage variables (`TMPDIR`, `SINGULARITY_TMPDIR`, `SINGULARITY_CACHEDIR`) to ensure the pipeline has sufficient scratch space (minimum 10 GB) for Docker/Singularity operations.
*   **Pipeline Invocation**: Executes `main.nf` with predefined parameters and user-provided arguments.

### 3. Data Flow
*   **Input**: Takes a user-specified `<data dir>` as an argument. It downloads demo datasets based on a manifest (referenced internally by the pipeline).
*   **Processing**: The pipeline performs registration and analysis on the data cutout.
*   **Output**: Writes processed data, intermediate files, and logs into the user-specified directory.

### 4. Dependencies
*   **Nextflow**: The workflow engine (`main.nf`) used to orchestrate the pipeline.
*   **Containerization**: Relies on Singularity (implied by environment variables) or Docker for environment isolation.
*   **Configuration Files**: Depends on `./examples/demo_small3.json` for specific runtime parameters.

### 5. Analysis Methods
*   **EASI-FISH Pipeline**: Implements high-throughput spatial transcriptomics analysis.
*   **Parallel Computing**: Uses Apache Spark (implied by the "workers/cores" memory configuration notes) to manage computational load across multiple processor cores.

### 6. Figures/Outputs
*   **Intermediate Pipeline Artifacts**: Generates large-scale intermediate processing files (registration outputs).
*   **Final Data Output**: Produces processed spatial transcriptomic results in the directory defined by the user.

### 7. Key Parameters
*   **`datadir`**: The root directory for data downloads and pipeline output.
*   **`runtime_opts`**: Configures mount points for containerized execution (linking `$datadir` and `$TMPDIR`).
*   **Memory/Resource Configs**: While not explicitly defined as flags, the script assumes a high-performance environment (40 cores, 128 GB RAM); users are advised to adjust these within `demo_small3.json` if hardware specs differ.
*   **`--shared_work_dir`**: Specifies the location where the pipeline stores shared work files.

---

## examples/demo_tiny.sh

### Structured Summary: `examples/demo_tiny.sh`

#### 1. Purpose
This shell script acts as an entry point for testing the EASI-FISH analysis pipeline by downloading demo data and executing a full end-to-end processing workflow. It is designed to provide a small-scale validation of the pipeline on a subset of the LHA3 dataset.

#### 2. Key Functions/Classes
*   **Shell Environment Setup**: Configures directory paths and environment variables (specifically `TMPDIR`, `SINGULARITY_TMPDIR`, and `SINGULARITY_CACHEDIR`) to ensure sufficient disk space for large container images.
*   **Argument Handling**: Validates user input to ensure a directory is provided for data storage.
*   **Pipeline Execution (`main.nf`)**: Invokes the primary Nextflow pipeline script to orchestrate the computational tasks.

#### 3. Data Flow
*   **Input**: Takes a user-provided directory path where data should be stored. It uses a manifest (defined in the `demo_tiny.json` parameters file) to download required raw input data to this directory.
*   **Processing**: The data is processed via the `main.nf` pipeline, utilizing temporary directories for intermediate files and container caching.
*   **Output**: The final analysis results are written to the user-specified data directory.

#### 4. Dependencies
*   **Nextflow**: The primary orchestration framework (`main.nf`).
*   **Singularity/Apptainer**: Used to manage software containers for pipeline reproducibility.
*   **Local Repository Files**: Relies on `main.nf` (the pipeline definition) and `examples/demo_tiny.json` (the configuration parameters for the demo run).

#### 5. Analysis Methods
*   **EASI-FISH Analysis Pipeline**: The script implements the full pipeline for EASI-FISH (Equivalent to an In situ Sequencing-FISH) image processing, specifically focusing on acquisition registration and subsequent data analysis. 
*   **Distributed Computing**: Utilizes Spark for parallelized processing of image registrations.

#### 6. Figures/Outputs
*   While this script does not generate figures directly, it produces the standard output artifacts of the EASI-FISH pipeline within the user-specified `<data dir>`, which typically includes processed image registrations and data matrices.

#### 7. Key Parameters
*   **`datadir`**: Positional argument specifying the workspace for inputs and outputs.
*   **`TMPDIR`**: Configurable via environment variable; requires at least 10 GB of space for Docker/Singularity image storage.
*   **Memory Settings (via `main.nf` / `demo_tiny.json`)**: 
    *   `workers`, `worker_cores`, `gb_per_core`: Configurable parameters that control the memory footprint of Spark-based registration tasks. The script notes that these must be tuned based on available RAM (optimized here for 128 GB).

---

## examples/run-on-aws.sh

This analysis provides a structured overview of the `examples/run-on-aws.sh` script, which serves as a configuration and execution wrapper for a Nextflow-based scientific workflow.

### 1. Purpose
This script executes a data processing pipeline for a "MultiFish" imaging project on AWS Batch using Nextflow. It serves as an entry point for running high-throughput biological image analysis tasks on cloud infrastructure.

### 2. Key Functions/Classes
*   **Nextflow Executor**: The script acts as a bash wrapper for the `nextflow` command-line tool, providing all necessary runtime configurations for an AWS environment.

### 3. Data Flow
*   **Input**: Reads raw imaging data from an S3 bucket (`s3://...`) and local mount points (`/s3-multifish/small`). 
*   **Processing**: Processes biological images (likely FISH - Fluorescence In Situ Hybridization) through steps involving stitching, DAPI channel segmentation, and AirLocalize spot detection.
*   **Output**: Writes processed results, intermediate spark logs, and work directories to specified EFS mounts (`/efs-multifish/results/small`) and S3 buckets.

### 4. Dependencies
*   **Nextflow**: The primary workflow orchestrator required to run the `main.nf` file.
*   **AWS Infrastructure**: Requires an AWS Batch environment, S3 buckets for storage, and EFS (Elastic File System) for shared working directories.
*   **Internal Pipeline**: Depends on `../main.nf` (the workflow definition) and external machine learning/segmentation models (e.g., `starfinity-model`).

### 5. Analysis Methods
*   **Image Segmentation**: Employs a pre-trained model (Starfinity) for cell/object segmentation.
*   **Spot Localization**: Uses "AirLocalize" for detecting fluorescent signals within the images.
*   **Image Stitching**: Performs spatial registration of image tiles to reconstruct larger biological samples.
*   **Parallel Computing**: Utilizes Apache Spark (via directory configuration) for distributed data processing.

### 6. Figures/Outputs
*   **Processed Results**: The script directs results to `/efs-multifish/results/small`.
*   **Workflow Logs**: Nextflow produces execution traces and logs within the specified S3 work directory (`s3://janelia-nextflow-demo/multifish/work`).

### 7. Key Parameters
*   **Compute Resources**: `worker_cores` (16), `gb_per_core` (4), `airlocalize_memory` (8G).
*   **Scientific Configuration**: 
    *   `--channels`: Specifies the imaging channels to process (`c0, c1`).
    *   `--dapi_channel`: Identifies the channel used for nucleus identification.
    *   `--airlocalize_stride`: XY and Z parameters (512, 256) for localized image processing.
*   **Data Paths**: Crucial mappings between S3 buckets and local EFS mount points for large-scale data access.
*   **Task Management**: `wait_for_spark_timeout_seconds` (3600) for managing distributed compute failures.

---

## examples/run_assign_spots.sh

### Analysis Report: `examples/run_assign_spots.sh`

#### 1. Purpose
This shell script acts as a wrapper to execute a Nextflow pipeline (`main-assign-spots.nf`) designed to assign detected biological spots to specific segmentation labels. It is intended for batch processing of multi-channel/multi-round imaging data within a research environment.

#### 2. Key Functions/Classes
*   **Nextflow Executor**: The script invokes `main-assign-spots.nf`, a workflow script (likely written in Groovy/Nextflow DSL2) that orchestrates the spot-assignment pipeline.
*   **Tower Integration**: Connects to the Seqera (Nextflow) Tower API for workflow monitoring and management.

#### 3. Data Flow
*   **Reads**: 
    *   Segmentation labels: A TIFF file representing cell/nucleus boundaries (`--labels`).
    *   Warped spots: A directory containing coordinate/metadata files for spots that have already been spatially transformed/registered to a common coordinate space (`--warped_spots`).
*   **Writes**: 
    *   Processed results are exported to the directory specified in `--outdir`.

#### 4. Dependencies
*   **Nextflow**: The primary workflow engine required to run `.nf` files.
*   **Internal Repo File**: Depends on `../main-assign-spots.nf` located in the parent directory.
*   **Environment**: Relies on specific filesystem mount paths (`/nrs/scicompsoft/goinac/multifish`) consistent with Janelia Research Campus's computing infrastructure (NRS).

#### 5. Analysis Methods
*   **Spatial Assignment**: The script implies a computational method that maps discrete point-source data (spots) to regional masks (labels). This is typically achieved using spatial join operations or geometric inclusion tests (checking if a spot coordinate falls within a labeled segmentation mask).
*   **Registration/Warping**: The input paths indicate that the spots have previously undergone a warping process, suggesting the pipeline operates on pre-registered coordinate data.

#### 6. Figures/Outputs
*   **Assignment Results**: While not explicitly defined by file extension in the script, the output directory typically contains CSV or Parquet files detailing which spot belongs to which label/cell, and potentially diagnostic summary images or QC plots.

#### 7. Key Parameters
*   `--labels`: Path to the segmented image (reference map).
*   `--warped_spots`: Path to the input spot data.
*   `--outdir`: The destination for the processed analysis results.
*   `--runtime_opts`: Container/environment configuration (specifically `-B` for directory binding in Singularity/Docker).
*   `-with-tower`: Enables integration with the Nextflow Tower service for orchestration.

---

## examples/run_intensities.sh

### Code Analysis Report: `examples/run_intensities.sh`

#### 1. Purpose
This script serves as an execution wrapper for a Nextflow pipeline designed to extract and quantify spot intensities from registered multi-fish imaging data. It facilitates the processing of warped image and spot data by directing the computational workflow to a specific project directory and monitoring server.

#### 2. Key Functions/Classes
*   **Nextflow Executor (`main-spots-intensities.nf`)**: The primary workflow engine executed by the script. It orchestrates the quantification process, likely involving distributed parallel processing of imaging spots.

#### 3. Data Flow
*   **Inputs**:
    *   `--labels`: A segmentation mask (TIFF format) used as the spatial reference for spot identification.
    *   `--warped_image`: The directory containing warped image data (transformed to a common reference space).
    *   `--warped_spots`: The directory containing coordinates or metadata for spots detected in the registered images.
*   **Outputs**:
    *   `--outdir`: The destination folder where quantification results (likely intensity tables or structured data files) are saved.

#### 4. Dependencies
*   **Nextflow**: The workflow management system used to run the analysis.
*   **Tower**: A Nextflow monitoring and management platform (configured via `-with-tower` URL).
*   **Local Repository Files**: Relies on `../main-spots-intensities.nf`, indicating this is a sub-module or example script within a larger bioinformatics/imaging analysis repository.
*   **System Resources**: The `--runtime_opts` flag suggests a dependency on Singularity/Apptainer for containerized execution (specifically binding a Network Resource Storage path: `/nrs/scicompsoft/goinac/multifish`).

#### 5. Analysis Methods
*   **Image Registration/Warping**: The script operates on "warped" data, implying a pre-processing step where imaging volumes have been registered to a reference coordinate system (LHA3_R3).
*   **Intensity Quantification**: Implicitly performs spatial aggregation or signal measurement of "spots" against a "labels" (segmentation) mask.

#### 6. Figures/Outputs
*   **Quantitative Data**: While the script does not explicitly generate plots, it generates processed output files in the specified `--outdir`, which likely contain CSV or HDF5 files representing the intensity profiles of spots within labeled regions.

#### 7. Key Parameters
*   `--labels`: Path to the reference segmentation.
*   `--warped_image` / `--warped_spots`: Paths to the aligned biological data.
*   `--runtime_opts`: Configuration for the execution environment, specifically handling file system mounts for high-performance computing (HPC) access.
*   `"$@"`: Passes any additional command-line arguments to the Nextflow pipeline, allowing users to override defaults or add pipeline-specific flags at runtime.

---

## examples/run_pipeline.sh

This file is a shell script designed to execute a Nextflow-based scientific image processing pipeline, specifically tailored for the "Multifish" project.

### 1. Purpose
This script serves as an entry-point wrapper to launch a Nextflow pipeline (`main.nf`) for processing imaging data. It pre-configures environment-specific settings, resource allocation, and directory paths required for cluster execution.

### 2. Key Functions/Classes
*   **Nextflow Executor**: Invokes `main.nf`, the primary orchestration script for the pipeline.
*   **Infrastructure Configuration**: Utilizes `tower` for workflow monitoring and `lsf` for job scheduling on an HPC cluster.

### 3. Data Flow
*   **Input**: Reads raw imaging data (acquisitions) from a specified `--data_dir` and utilizes a pre-trained machine learning model from `--segmentation_model_dir`.
*   **Processing**: Processes data across a distributed cluster environment using specified workers and cores.
*   **Output**: Writes processed results and intermediate files to the directory defined by `--output_dir`.

### 4. Dependencies
*   **Nextflow**: The workflow management system.
*   **Main Pipeline File**: `../main.nf` (the primary logic script located in the parent directory).
*   **Compute Cluster**: Relies on LSF (Load Sharing Facility) for job management.
*   **Container/HPC Paths**: Relies on specific network-attached storage (`/nrs/scicompsoft/` and `/nrs/multifish/`) for data, models, and container bindings.

### 5. Analysis Methods
*   **Image Segmentation**: The inclusion of a `segmentation_model_dir` (specifically referencing `starfinity-model`) indicates the use of deep learning-based image segmentation.
*   **Distributed Computing**: Uses Apache Spark (implied by `--spark_work_dir`) to distribute computational tasks across multiple workers.

### 6. Figures/Outputs
*   **Pipeline Logs**: Generates Nextflow execution logs and channel dumps.
*   **Processed Data**: Output files in the designated directory (e.g., segmented images or extracted features).

### 7. Key Parameters
*   **`--data_dir`**: The root directory containing the source acquisition folders.
*   **`--acq_names`**: A comma-separated list of specific acquisition datasets to process.
*   **`--ref_acq`**: The acquisition used as a reference point for alignment or normalization.
*   **`--segmentation_model_dir`**: The path to the specific deep learning model weights/architecture.
*   **`--workers` / `--worker_cores`**: Resource allocation parameters for the distributed computing environment.
*   **`--runtime_opts`**: Singularity/Apptainer flags (`--nv`) and bind-mount paths for hardware acceleration (e.g., GPUs).

---

## examples/run_registration.sh

This file is a shell script wrapper used to execute a Nextflow pipeline for an image registration workflow.

### 1. Purpose
This script serves as an entry point for running a specific image registration pipeline (`main-registration.nf`). It automates the orchestration of computational resources and sets the necessary file paths for registering two 3D image volumes.

### 2. Key Functions/Classes
*   **Nextflow Executor**: The script invokes `main-registration.nf` using the Nextflow engine.
*   **Shell Script Logic**: Uses standard Bash commands (`dirname`, `pwd`) to resolve the execution path relative to the script location, ensuring the pipeline can be run from any directory.

### 3. Data Flow
*   **Input**: Reads two N5-formatted image datasets (`--fixed` and `--moving`), which appear to be subsets of multi-fish imaging data.
*   **Processing**: The data is processed by the external Nextflow pipeline, likely involving coordinate transformation and alignment.
*   **Output**: Writes processed registration results to the specified `--outdir` located in a `/nrs/scicompsoft/` (Janelia Research Campus) filesystem.

### 4. Dependencies
*   **Nextflow**: The primary workflow management system.
*   **Nextflow Tower**: Uses the internal Janelia instance (`http://nextflow.int.janelia.org/api`) for monitoring and execution management.
*   **Main Pipeline**: Depends on `../main-registration.nf` (the primary Nextflow workflow script).
*   **System Bindings**: Depends on specific paths mounted via Singularity/Apptainer (`-B` runtime options) to access the `/nrs/scicompsoft/` storage volumes.

### 5. Analysis Methods
*   **Image Registration**: While the specific algorithm is contained within `main-registration.nf`, the script parameters indicate a typical image alignment task (Fixed vs. Moving image), common in biological imaging (e.g., stitching or brain atlas registration).

### 6. Figures/Outputs
*   **Output Directory**: Results are written to `/nrs/scicompsoft/rokicki/multifish/LHA_R5_TO_R3_subset2`. These likely include transformed N5 datasets, transformation matrices, or log files generated by the registration pipeline.

### 7. Key Parameters
*   `--fixed`: Path to the reference image volume.
*   `--moving`: Path to the image volume to be transformed/aligned.
*   `--outdir`: The destination path for registration results.
*   `--runtime_opts`: Provides system-specific path bindings to ensure the computational environment has read/write access to the required data storage volumes.
*   `"$@"`: Allows for passing additional command-line arguments to the Nextflow pipeline during execution.

---

## examples/run_spot_extraction.sh

This file is a shell wrapper script designed to execute a Nextflow-based workflow for scientific image analysis.

### 1. Purpose
This script serves as an execution entry point for the `main-spots-extraction.nf` pipeline. It automates the process of extracting biological spots (likely fluorescence signals) from stitched image data stored in an N5 container.

### 2. Key Functions/Classes
*   **Nextflow Executor**: While not a class in the script itself, the script invokes the `main-spots-extraction.nf` Nextflow pipeline, which functions as the primary workflow engine.

### 3. Data Flow
*   **Input**: Reads stitched image data from an N5 directory (`/nrs/scicompsoft/goinac/multifish/ex1/LHA3_R3_subset/stitching/export.n5`).
*   **Processing**: The data is processed through the spot extraction pipeline (defined in the main workflow file).
*   **Output**: Writes processed spot information to the directory specified in `--outdir` (`/nrs/scicompsoft/goinac/multifish/ex1/LHA3_R3_subset/extracted-spots`).

### 4. Dependencies
*   **Nextflow**: The underlying workflow management system.
*   **main-spots-extraction.nf**: The main pipeline logic file located in the parent directory (`../`).
*   **Janelia Tower**: Uses an internal Nextflow Tower API (`http://nextflow.int.janelia.org/api`) for monitoring and orchestration.
*   **Singularity/Docker (implied)**: The `--runtime_opts` suggest the use of containerization (Singularity/Docker) to bind specific network-attached storage (NRS) paths.

### 5. Analysis Methods
*   **Spot Extraction**: The pipeline likely implements image processing algorithms (e.g., Laplacian of Gaussian filtering, local maxima detection, or intensity thresholding) to identify discrete spots within 3D/4D image volumes.

### 6. Figures/Outputs
*   **Spot Tables**: Likely generates CSV or parquet files containing coordinates $(x, y, z)$ and intensity values for detected spots.
*   **Workflow Logs**: Through integration with Janelia Tower, it produces execution monitoring reports.

### 7. Key Parameters
*   `--stitchdir`: The path to the input stitched image volume (N5 format).
*   `--outdir`: The destination path for the resulting spot extraction data.
*   `--runtime_opts`: Configuration for the container environment (bind-mounting specific paths for compute nodes).
*   `"$@"`: Allows for command-line arguments to be passed through to the underlying Nextflow script, enabling flexible configuration at runtime.

---

## notebooks/correct_darkfield_flatfield.py

### Structured Summary: `notebooks/correct_darkfield_flatfield.py`

#### 1. Purpose
This script performs flat-field and dark-field correction on large-scale microscopy imaging data stored in N5 format. It specifically rescales calibration images to match input data dimensions and applies the correction transformation to improve image quality for downstream processing (e.g., BigStitcher fusion).

#### 2. Key Functions/Classes
*   `transform(images, f, d)`: Applies the pixel-wise correction formula: $I_{corrected} = (I_{raw} - D) / F$, where $D$ is the darkfield and $F$ is the flatfield.
*   `transform_pipe(images_raw, dx, ff, upscale)`: A wrapper that resizes the flat/dark field maps using spline interpolation to match the dimensions of the input images and converts data types to optimize memory usage (`float16`).

#### 3. Data Flow
*   **Reads**: 
    *   Darkfield (`.tiff`) and Flatfield (`.tiff`) reference images.
    *   Raw microscopy data from an N5 container (via `zarr.N5Store`).
*   **Processes**: Rescales reference fields to match input resolution; performs arithmetic correction; converts processed data to `uint16`.
*   **Writes**: Saves corrected imagery back to a new N5 container, preserving the original BigStitcher/BDV-compliant directory structure and metadata.

#### 4. Dependencies
*   **Core**: `numpy`, `scipy.ndimage` (for zooming/interpolation), `zarr`.
*   **I/O**: `tifffile` (for reading reference images), `os`.
*   **Logging/Utils**: `logging`.
*   **Visualization** (unused imports): `matplotlib.pyplot`, `seaborn`.

#### 5. Analysis Methods
*   **Flat-field Correction**: Standard additive/multiplicative correction to remove illumination non-uniformity and sensor bias (dark current).
*   **Spatial Resampling**: Uses `scipy.ndimage.zoom` to align calibration maps (flat/dark fields) with the multiscale resolution levels of the microscopy tiles.

#### 6. Figures/Outputs
*   **No visualizations generated**: Despite importing `matplotlib` and `seaborn`, the script does not produce plots.
*   **Output Data**: Corrected N5 dataset stored at the specified `outpath`, structured as `setupX/timepoint0/scale`.

#### 7. Key Parameters
*   `upscale`: The scaling factor used to map the calibration fields to the specific image scale (e.g., `s1`).
*   `i_s`: An array of setup indices (e.g., `np.arange(47, 100, 1)`) defining which image tiles to process.
*   `scale`: Specifies the resolution level of the N5 data to be corrected (e.g., `s1`).
*   `path`/`outpath`: Paths to the source and destination N5 data storage containers.

---

## notebooks/infer_darkfield_flatfield.ipynb

This analysis summarizes the provided Jupyter notebook, which focuses on computational microscopy image correction.

### 1. Purpose
This notebook performs flat-field and dark-field estimation for scientific image data (stored in N5/Zarr format) using the `BaSiC` algorithm. It processes large image sets to generate correction matrices that normalize illumination artifacts.

### 2. Key Functions/Classes
*   `transform(images, f, d)`: A helper function to apply the calculated flat-field (`f`) and dark-field (`d`) corrections to raw image data.
*   `BaSiC`: A class from the `basicpy` library used to fit and extract illumination models (flat-field and dark-field) from image stacks.

### 3. Data Flow
*   **Input**: Reads multi-channel/multi-setup image data from an N5 container (`dataset.n5`) located in a scratch directory.
*   **Processing**: Stacks selected sub-images, calculates a dark-field estimation based on low-percentile intensity values, and fits a `BaSiC` model using a subset of randomly selected frames.
*   **Output**: Saves the resulting dark-field and flat-field correction matrices as `.tiff` files in a specified project directory.

### 4. Dependencies
*   **Scientific Computing**: `numpy`, `scipy.ndimage`.
*   **Bio-Imaging/Storage**: `basicpy`, `zarr`, `numcodecs`, `tifffile`.
*   **Visualization**: `matplotlib.pyplot`, `seaborn`.

### 5. Analysis Methods
*   **Percentile-based Estimation**: Uses various percentiles (1%–99.9%) to inspect pixel-wise intensity distributions across the stack.
*   **Dark-field Subtraction**: Estimates the dark-field (`dx`) by taking the 1st percentile of the image stack, which is used to subtract background noise before flat-field estimation.
*   **BaSiC Flat-field Fitting**: Uses the `BaSiC` algorithm to decompose images into a flat-field component, with a configurable "smoothness" constraint.
*   **Subsampling**: Implements performance testing by fitting the `BaSiC` model on varying stack sizes ($N = 100$ to full dataset) to optimize computational efficiency.

### 6. Figures/Outputs
*   **Percentile Analysis Maps**: A grid of images visualizing the spatial distribution of intensities at different percentile levels.
*   **Difference Maps**: A grid visualizing the difference between specific percentiles and the 1st percentile.
*   **Correction Visualizations**: Side-by-side heatmaps comparing the final calculated dark-field and flat-field matrices.
*   **Console Output**: Logs of processing time for different sample sizes during the iterative `BaSiC` fitting process.

### 7. Key Parameters
*   **Percentiles (`pctls`)**: List ranging from 1 to 99.9, used to assess signal distribution.
*   **BaSiC Fitting**:
    *   `smoothness_flatfield=1`: Controls the spatial variation constraint of the flat-field.
    *   `sort_intensity=True`: Reorders images by intensity during the BaSiC fit to improve convergence.
*   **Image Clipping**: `np.clip(..., 0, 1000)`: Used to bound pixel intensities to a valid range before floating-point conversion and normalization.

---

## setup.sh

This file is a shell script designed to automate the initial configuration and dependency management for a research pipeline utilizing Nextflow and Apache Spark.

### 1. Purpose
This script automates the retrieval and local deployment of the `nextflow-spark` module. It ensures that the required software infrastructure is present within the project's directory structure before the main research pipeline is executed.

### 2. Key Functions/Classes
*   **Shell Script Commands**: The script uses standard shell commands (`mkdir`, `curl`, `tar`) to perform file system operations and network requests. No formal functions or classes are defined.

### 3. Data Flow
*   **Input**: Fetches a compressed archive (`.tar.gz`) from a remote GitHub repository via HTTPS.
*   **Processing**: Extracts the archive contents and strips the top-level directory structure.
*   **Output**: Writes the extracted source files into a local directory (`external-modules/spark/`).

### 4. Dependencies
*   **Network**: Requires internet access to reach `github.com`.
*   **Software**: Requires `curl`, `tar`, and a POSIX-compliant shell (`bash`) to execute.
*   **External Repository**: Depends on the `JaneliaSciComp/nextflow-spark` GitHub repository.

### 5. Analysis Methods
*   **None**: This is an infrastructure/deployment script and does not contain scientific or statistical algorithms.

### 6. Figures/Outputs
*   **Output Directory**: Populates the `${BASEDIR}/external-modules/spark` directory with versioned library files.
*   **Console Output**: Prints "Setup complete" upon successful execution.

### 7. Key Parameters
*   **`NEXTFLOW_SPARK_GITURL`**: Defines the source repository for the Spark integration module.
*   **`NEXTFLOW_SPARK_VERSION`**: Specifies the exact version (`1.4.0`) of the module to be downloaded, ensuring reproducibility of the environment.
*   **`BASEDIR`**: Dynamically determined variable used to ensure all file operations are relative to the script's location, ensuring portability.

---

