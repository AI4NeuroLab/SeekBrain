# Zebrafish Functional Neuron Type Calcium Activity Visualization

## Description
This skill produces a publication-quality figure displaying the calcium dynamics of functionally classified neuronal populations in a zebrafish larva. Neurons are sorted into four groups—Motor+ (positively correlated with swimming), Motor- (negatively correlated with swimming), Dark-responsive, and Light-responsive—using pre-computed correlation coefficient arrays. For each group, the top 50 most correlated neurons are selected via argsort, and their individual ΔF/F traces are overlaid with a population mean. Behavioral context (binary swim events and stimulus sequence) is shown in compact panels above the neural traces, enabling direct visual assessment of stimulus-locked and motor-locked activity patterns.

## Tags
- zebrafish
- calcium imaging
- ΔF/F
- functional neuron types
- motor correlation
- sensory correlation
- whole-brain imaging
- population activity
- swim events
- visual stimulus
- time series visualization
- neuroscience

## Input
- **dff.npy**: 2D NumPy array of shape `(n_neurons, n_timepoints)` containing ΔF/F calcium time series for all identified neurons.
- **swim_events.npy**: 1D NumPy array of swimming trace recorded at 399.75 Hz temporal resolution.
- **correlations_motor.npy**: 1D NumPy array of shape `(n_neurons,)` with correlation coefficients between each neuron's activity and motor events.
- **correlations_dark.npy**: 1D NumPy array of shape `(n_neurons,)` with correlation coefficients between each neuron's activity and dark stimulus periods.
- **correlations_light.npy**: 1D NumPy array of shape `(n_neurons,)` with correlation coefficients between each neuron's activity and light stimulus periods.
- **sequence_stimuli.npy**: 1D NumPy array representing the visual stimulus protocol (dark/light sequence).
- **Subject folder structure**: A `Subjects/` directory containing alphabetically sortable fish folders (e.g., `fish001`, `fish002`, …). The 8th folder (0-indexed as 7) is selected.

## Output
- A single PNG figure (`figure_refine.png`) at 300 DPI with:
  - **Top context panels (20% height)**: Binary motor trace and stimulus sequence.
  - **Bottom calcium panels (80% height)**: Four equal-height panels showing Motor+, Motor-, Dark, and Light neuron populations with individual traces and mean overlays.
- All spines, ticks, and axis labels are removed for a clean presentation style.

## Algorithm / Processing Steps
1. **Folder Selection**: Scan the `Subjects/` directory, sort folders alphabetically, and select the 8th folder.
2. **Data Loading**: Load `dff.npy`, `swim_events.npy`, `correlations_motor.npy`, `correlations_dark.npy`, `correlations_light.npy` from the selected fish folder, and `sequence_stimuli.npy` from a shared `Files/` directory.
3. **Swim Event Binarization**: Threshold the swim trace at 0.5 to produce a binary vector. Drop the first 15 elements and append 15 zeros. Pad or trim to exactly 360,000 samples. Convert sample indices to seconds using the 399.75 Hz sampling rate.
4. **Neuron Selection**:
   - **Motor+**: `np.argsort(correlations_motor)[-50:]` — 50 neurons with highest positive motor correlation.
   - **Motor-**: `np.argsort(correlations_motor)[:50]` — 50 neurons with most negative motor correlation.
   - **Dark**: `np.argsort(correlations_dark)[-50:]` — 50 neurons with highest dark stimulus correlation.
   - **Light**: `np.argsort(correlations_light)[-50:]` — 50 neurons with highest light stimulus correlation.
5. **Figure Construction**:
   - Create a `(12, 5)` figure with a 6-row GridSpec: rows 0–1 for context (height ratio 1 each), rows 2–5 for calcium traces (height ratio 2 each), yielding 20%/80% split.
   - Top row 0: `fill_between` for binary swim events, labeled "Motor" on the right.
   - Top row 1: Line plot of `sequence_stimuli`, labeled "Stim." on the right.
6. **Calcium Trace Plotting**: For each neuron group:
   - Plot all 50 individual traces with designated color, `alpha=0.1`, `linewidth=0.5`, `rasterized=True`.
   - Overlay the population mean in solid black (`[0,0,0]`), `alpha=1`, `linewidth=0.5`.
7. **Styling**: Remove all spines, ticks, and labels. Set x-axis limits to the full recording duration.
8. **Save**: Export to PNG at 300 DPI with tight bounding box.

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| Camera FPS | 399.75 Hz | Temporal resolution of swim events recording |
| Swim threshold | 0.5 | Threshold for binarizing swim trace |
| Shift offset | 15 samples | Number of elements dropped from start / appended as zeros |
| Target swim length | 360,000 | Final length of binary swim vector |
| Neurons per group | 50 | Number of top/bottom correlated neurons selected |
| Figure size | (12, 5) | Width × height in inches |
| Individual trace alpha | 0.1 | Transparency for individual neuron traces |
| Individual trace linewidth | 0.5 | Line width for individual neuron traces |
| Mean trace alpha | 1.0 | Full opacity for population mean |
| Mean trace linewidth | 0.5 | Line width for population mean |
| Motor+ color | [0, 0.8, 0.2] (Green) | Color for positively motor-correlated neurons |
| Motor- color | [1, 0, 1] (Magenta) | Color for negatively motor-correlated neurons |
| Dark color | [1, 0, 0] (Red) | Color for dark-stimulus correlated neurons |
| Light color | 'orange' | Color for light-stimulus correlated neurons |
| DPI | 300 | Output image resolution |

## Usage Example
```python
import os
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

# Set paths
ZEBRAFISH_PATH = "/path/to/dataverse_files"
subjects_dir = os.path.join(ZEBRAFISH_PATH, "Subjects")

# Select 8th fish folder
fish_folders = sorted([
    os.path.join(subjects_dir, f)
    for f in os.listdir(subjects_dir)
    if f.startswith("fish") and os.path.isdir(os.path.join(subjects_dir, f))
])
fish_folder = fish_folders[7]

# Load data
dff = np.load(os.path.join(fish_folder, "dff.npy"))
swim_events = np.load(os.path.join(fish_folder, "swim_events.npy"))
correlations_motor = np.load(os.path.join(fish_folder, "correlations_motor.npy"))
correlations_dark = np.load(os.path.join(fish_folder, "correlations_dark.npy"))
correlations_light = np.load(os.path.join(fish_folder, "correlations_light.npy"))
sequence_stimuli = np.load(os.path.join(ZEBRAFISH_PATH, "Files", "sequence_stimuli.npy"))

# Process and visualize (see full code in pipeline)
```

## Dependencies
- Python 3.x
- NumPy
- Matplotlib (pyplot, gridspec)
- `zebrafish_Ca_utils` (custom utility library at specified library path, optional depending on environment)

## Limitations
- Hardcoded to select exactly 50 neurons per group; may fail if fewer than 50 neurons exist in the dataset.
- The swim event binarization parameters (threshold=0.5, shift of 15 samples, padding to 360,000) are specific to this experimental protocol and may not generalize.
- The calcium time axis is derived by linearly interpolating between 0 and the swim recording duration, assuming synchronized start times between imaging and behavioral recording.
- No overlap handling: a neuron may appear in multiple functional groups if it has high correlations to both motor and sensory variables.
- Color and layout choices are optimized for publication figures and may need adjustment for presentations or different display contexts.
- The `rasterized=True` parameter helps with file size but may reduce quality when zooming into vector graphics formats.

## Source
Derived from whole-brain calcium imaging data of zebrafish larvae (dataverse_files dataset). The pipeline classifies neurons by pre-computed correlation coefficients and visualizes their temporal activity alongside behavioral and stimulus context.
