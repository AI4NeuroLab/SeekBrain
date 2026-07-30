# Implementation notes

## Analysis sequence

1. Segment aligned bump-phase and scene-orientation traces by animal and condition.
2. Wrap angular offsets into $[-\pi, \pi]$.
3. Fit a von Mises distribution and retain observed $\kappa$.
4. Circularly shift the complete bump trace 1,000 times, refitting $\kappa$ after every shift.
5. Summarize the null by its median and 95th percentile and plot observed values against it.

Use circular shifts rather than arbitrary sample permutations to preserve autocorrelation. Fix or record the random seed, exclude zero-lag shifts, and report sample counts per animal and epoch. The bundled `scripts/run_analysis.py` and `scripts/utils.py` provide the executable analysis; no external model inventory is required.
