# Source: README.md
# Summary: See repo_context.md

# Structural and genetic determinants of zebrafish functional brain networks

Code associated with the "Structural and genetic determinants of zebrafish functional brain networks" paper, currently available on [Science Advances, 11(28), eadv7576](https://doi.org/10.1126/sciadv.adv7576). 


## Repository overview

All data analyses from the paper are conducted in multiple Jupyter notebooks that are mostly split into 2 categories: Some that compute results for specific figures of the paper (`FigureX-Analysis` notebooks), and some that take these results to generate figures (`FigureX-Layout` notebooks) for subsequent modifications using Inkscape. Notebooks import functions in adjacent `.py` files and perform analyses on a processed calcium imaging dataset that can be downloaded [here](https://doi.org/10.5683/SP3/IIVGOB) (roughly 20 GB of data). If notebooks are executed in the correct order, all figures can be reproduced, with the exception of a few panels that require raw data (over a terabyte, available upon reasonable request). Supplementary analyses are done in `Supp-` notebooks.

## Notebooks list

- `Figure1-Analysis` : This notebook briefly inspects the calcium imaging dataset, counts neurons in every brain region, excludes regions with few cells, detrends fluorescence time series, computes functional networks, and performs the inter-individual similarity/fingerprinting analysis; statistical validations of fingerprinting are conducted in a separate notebook.
- `Figure1-Layout` : Loads previously calculated results and generates **Figure 1**.
- `Figure2-Analysis` : Uses SC and FC matrices to evaluate the structure-function relationship of zebrafish brain networks.
- `Figure2-Layout` : Loads previously calculated results and generates **Figure 2**.
- `Figure3-Layout` : Calculates SC and FC communities, then evaluates their modularity, overlap, and spatial extent, relative to multiple null models.
- `Figure3-Layout` : Loads previously calculated results and generates **Figure 3**.
- `Figure4-Analysis` : Identifies high-amplitude brain activity patterns and evaluates their modularity; also projects raw calcium volumes into the brain atlas.
- `Figure4-Detrending` : Loops over the raw calcium data to compute a pixel-wise linear regression and generate detrended calcium videos.
- `Figure4-Layout` : Loads previously calculated results and generates **Figure 4**.
- `Figure5-Analysis` : Identifies motor and visual neurons using regression analysis, then visualizes these neurons in the brain atlas.
- `Figure5-Layout` : Loads previously calculated results and generates **Figure 5**.
- `Figure6-Analysis` : Computes SC and FC gradients, compares them, evaluates their statistical significance, then computes the sensorimotor index and correlates it with the main FC gradient.
- `Figure6-Layout` : Loads previously calculated results and generates **Figure 6**.
- `Figure7-Analysis` : Computes regional gene expression levels, generates surrogates, conducts the simulated annealing optimization, then generates projections of the identified genes.
- `Figure7-Layout` : Loads previously calculated results and generates **Figure 7**.
- `Supp-Figures` : Generates **Supplementary Figures S1, S2, S5, S8, S13, S14, S15, S16, S17, S19, S20, S21, S22, S23, S25**.
- `Supp-Averaging` : Evaluates the effect of averaging signals to compute FC, related to **Supplementary Figure S3**.
- `Supp-DatasetsComparison` : Computes FC matrices from different calcium imaging datasets and compares them, related to **Supplementary Figure S4**.
- `Supp-Fingerprinting` : Compares different methods to fingerprint the identity of larvae from calcium imaging data, then generates **Supplementary Figure S6**.
- `Supp-FC-vs-Signal` : Evaluates the correlation between FC and signal intensity levels, related to **Supplementary Figure S7**.
- `Supp-ComputingSC` : Uses single-neuron reconstructions to compute SC matrices, related to **Supplementary Figure S9**.
- `Supp-SC-Validations` : Validation of the boundary expansion procedure for SC calculation, related to **Supplementary Figure S9**.
- `Supp-SCCM` : Defines the connectivity null model, generates null connectivity matrices from SC matrices generated beforehand, and generates **Supplementary Figures S10, S11, & S12**.
- `Supp-SparseSC` : Replication of key results using the sparse SC matrix, related to **Supplementary Figure S18**.
- `Supp-Gradients` : Computes FC gradients in various FC definitions, then generates **Supplementary Figure S24**.

## Installation

Download this repository, then run the notebooks in a Python environment equipped with the appropriate packages, which can all be `pip` installed easily. Some notebooks will output files in a `Results/` folder, which should be manually created and placed adjacent to the notebooks.

## Citation
If you use this repository for your own work, please cite the paper:

> Légaré, A., Lemieux, M., Boily, V., Poulin, S., Légaré, A., Desrosiers, P., & De Koninck, P. (2025). Structural and genetic determinants of zebrafish functional brain networks. Science Advances, 11(28), eadv7576. [https://doi.org/10.1126/sciadv.adv7576](https://doi.org/10.1126/sciadv.adv7576)

BibTeX:

```bibtex
@article{legare2025structural,
  title = {Structural and genetic determinants of zebrafish functional brain networks},
  author = {L{\'e}gar{\'e}, Antoine and Lemieux, Mado and Boily, Vincent and Poulin, Sandrine and L{\'e}gar{\'e}, Arthur and Desrosiers, Patrick and De Koninck, Paul},
  journal = {Science Advances},
  volume = {11},
  number = {28},
  pages = {eadv7576},
  year = {2025},
  doi = {10.1126/sciadv.adv7576},
  url = {https://doi.org/10.1126/sciadv.adv7576}
}
```

## Authors

- Antoine Légaré (antoine.legare.1@ulaval.ca)
- Patrick Desrosiers (patrick.desrosiers@phy.ulaval.ca)

For any questions regarding the repository, please contact us!

