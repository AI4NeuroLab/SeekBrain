I aim to visualize the calcium activities of those identified individual neurons that were correlated with swimming and visual responses in a given fish larva.
Visualization Specifications (Trace Plot):
1. Data Loading: Scan the top-level directory for subject folders and Sort the list of folders alphabetically and select the 9th folder (index 8) to define the specific larva used for this visualization. From the selected folder, load the following numpy arrays:
  - timeseries: Calcium activity data from dff.npy.
  - swim_events:  from swim_events.npy.
  - motor_corrs: Correlation coefficients with motor events from correlations_motor.npy.
  - dark_corrs: Correlation coefficients with dark stimuli from correlations_dark.npy.
  - light_corrs: Correlation coefficients with light stimuli from correlations_light.npy.
2. Layout: Vertical arrangement of six aligned time-series panels.
  - Context Panels (Top): Two narrow panels (approx. half-height) displaying behavioral context (Swim Events) and Stimulus sequence (Dark/Light).
  - Trace Panels (Bottom): Four standard-height panels displaying calcium activities, ordered top-to-bottom: Motor+, Motor-, Dark, Light.
3. Data selection:
  - Motor+: The 100 neurons with the highest positive correlation to motor events (argsort indices [-100:]).
  - Motor-: The 100 neurons with the most negative correlation to motor events (argsort indices [:100]).
  - Dark: The 100 neurons with the highest correlation to dark stimuli (argsort indices [-100:]).
  - Light: The 100 neurons with the highest correlation to light stimuli (argsort indices [-100:]).
4. Trace Style: 
  - Individual Traces: Overlay the 100 raw traces for each population using the designated color with low opacity (alpha=0.1), thin lines (linewidth=0.5), and rasterized=True (to optimize rendering of dense lines).
  - Mean Trace: Superimpose the population mean trace in solid black ([0, 0, 0]) with full opacity (alpha=1) and linewidth=0.5.
5. Colors: Motor+, Green ([0, 0.8, 0.2]); Motor-, Magenta ([1, 0, 1]); Dark, Red ([1, 0, 0]); Light, Orange ('orange').
6. Axes: 
  - Remove all spines, ticks, and labels (ax.axis('off')).
  - Set x-axis limits to match the full duration of the recorded time series ([0, ts.shape[1]]).