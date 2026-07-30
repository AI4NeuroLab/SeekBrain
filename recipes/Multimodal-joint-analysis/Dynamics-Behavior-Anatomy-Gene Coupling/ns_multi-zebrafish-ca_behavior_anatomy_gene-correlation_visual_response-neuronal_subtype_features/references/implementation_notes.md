# Implementation notes

## Data integration

- Normalize identifiers and verify one-to-one joins before combining calcium, behavior, gene, and coordinate tables.
- Align calcium frames to stimulus and swim timestamps before computing response amplitudes or correlations.
- Apply the same response windows, baseline definition, and quality filters to every molecular group.
- Transform coordinates into a common atlas space before pooling animals or drawing density maps.

## Validation

Report matched and unmatched neuron counts, per-animal sample sizes, coordinate ranges, and missing-value rates. Compare subtypes with animal-aware summaries or models. Use the bundled `scripts/run_analysis.py` for the main workflow and `scripts/utils.py` for helper operations. The retained implementation notes describe assumptions that must be checked when adapting schemas.
