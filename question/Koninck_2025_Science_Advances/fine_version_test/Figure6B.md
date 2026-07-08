To characterize the similarities of structural connectivity (SC) and functional connectivity (FC) gradients, I need to find the first several SC gradients, whose eigenvalues (i.e., their relative importance) quickly decayed.
Visualization Specifications:
- Dataset Identification & loading: Load the SC eigenvalues from PROCESS_DATA_DIR/Figure6_SC_eigenvalues.npy.
- Chart Type: Line plot.
- Data Mapping:
  - X-axis: The index of the eigenvalue (1 to N).
  - Y-axis: The value of the SC eigenvalues (eigvals_SC).
- Styling & Layout:
  - Line Style: Plot the line in black (color='black') with a line width of 1 and marker size of 1.
  - Axes Limits: Set the X-axis limits to [-1, 51] .
  - Ticks: Set X-axis ticks at [1, 50] .
  - Spines: Remove the top and right spines (make them invisible).