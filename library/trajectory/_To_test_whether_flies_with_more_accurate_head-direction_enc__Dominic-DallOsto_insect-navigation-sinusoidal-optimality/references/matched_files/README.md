# Source: README.md
# Summary: See repo_context.md

# Insect Navigation Sinusoidal Optimality

A sinusoidal activity profile in a circulant ring network doing path or heading integration has some nice properties - it is noise resistant and self-stabilising with a Hebbian learning rule.

This code performs the analysis and figure generation for the paper ["Theoretical principles explain the structure of the insect head direction circuit"](https://doi.org/10.7554/eLife.91533) or see preprint [here](https://doi.org/10.1101/2023.07.05.547838)

If building on this analysis or these ideas, please cite our work:

```bibtex
@article {10.7554/eLife.53985,
    article_type = {journal},
    title = {Theoretical principles explain the structure of the insect head direction circuit},
    author = {Vilimelis Aceituno, Pau and Dall'Osto, Dominic and Pisokas, Ioannis},
    volume = 13,
    year = 2024,
    pages = {e91533},
    citation = {eLife2024;13:e91533},
    doi = {10.7554/eLife.91533},
    url = {https://doi.org/10.7554/eLife.91533},
    journal = {eLife},
    publisher = {eLife Sciences Publications, Ltd},
}
```

The code is available under the [BSD-3-Clause License](./LICENSE).

## Noise Resilience

* [Noise resilience of using fewer Fourier modes](sinusoidal%20noise%20rejection%20negative%20activity.ipynb) - Figure 2

### Multiple harmonic encodings

* [What does it look like to encode with multiple harmonics at once](encoding%20with%20multiple%20harmonics.ipynb) - Figure 1
* [How is an encoding with multiple harmonics affected by noise](noise%20affected%20multiple%20harmonics%20encoding.ipynb)

## Comparison to experimental data

* [Comparing the 4 population networks from Ioannis's paper to the abstract network we predict](insect%20network%20graph%20analysis.ipynb) - Figures 3, 4, M1, and M6
* [Deriving the 4 population connectivity network from Janelia's connectome data](fruit_fly_data_analysis.ipynb) - Figures M2-S5

## Oja's rule can develop the network weights

* [Updating both the activity and weights simultaneously](sinusoidal%20updating%20activity%20and%20weights.ipynb) - Figures 5 and M7
