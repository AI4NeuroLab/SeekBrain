# Implementation notes

## Circular statistics

- Wrap offsets with `np.angle(np.exp(1j * (bump_phase - scene_orientation)))` to keep values in $[-\pi, \pi]$.
- Estimate concentration with `scipy.stats.vonmises.fit(offset, fscale=1)` and retain the fitted $\kappa$.
- Compute one value over a complete epoch unless a sliding-window analysis is explicitly required.

## Null model and validation

For each of 1,000 iterations, draw a nonzero shift, apply `np.roll` to the bump phase, recompute the wrapped offset, and refit $\kappa$. Record the median and 95th percentile of this null distribution. Reject epochs with too few finite samples; fits can be unstable for epochs shorter than 500 ms.

The bundled `scripts/run_analysis.py` and `scripts/utils.py` implement the runnable workflow. They expect aligned phase and scene arrays plus epoch boundaries; inspect their argument handling before adapting file loaders.
