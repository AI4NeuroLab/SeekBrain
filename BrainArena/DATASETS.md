# Dataset preparation

Prepare the datasets listed below, then provide the agent with a query and
a local data-root path. The agent is responsible for identifying the relevant
data. Rubrics are used for evaluation and are not part of the agent's input.

[BrainArena overview](README.md) · [Queries and rubrics](README.md#queries-and-rubrics) · [Paper metadata](papers.json)

## Overview

Paper ID links open the corresponding queries. The two IBL papers share one data guide.

| Dataset | Paper ID | Required download scope |
| --- | --- | --- |
| [IBL Brain-Wide Map and Widefield Data](#ibl-brain-wide-map-and-widefield-data) | [findling_2025](queries/findling_2025/) · [ibl_2025](queries/ibl_2025/) | Shared BWM processed data; widefield processed data; region table and atlas |
| [Zebrafish Compass-Neuron Data](#zebrafish-compass-neuron-data) | [tanaka_2026](queries/tanaka_2026/) | All 10 ZIP files in Zenodo record 17233579 |
| [C. elegans Brain-Wide Activity and Behavior](#c-elegans-brain-wide-activity-and-behavior) | [atanas_2023](queries/atanas_2023/) | 6 compressed JLD2 files and 1 weights archive |
| [Zebrafish Activity–Gene Expression Co-mapping](#zebrafish-activity-gene-expression-co-mapping) | [marquez_legorreta_2026](queries/marquez_legorreta_2026/) | Dataset 1: all preprocessed files for the main three fish |
| [Drosophila Head-Direction Data](#drosophila-head-direction-data) | [basnak_2025](queries/basnak_2025/) | Complete DANDI Dandiset 000289 |
| [Developing Mouse Visual Cortex — DevVIS](#developing-mouse-visual-cortex-devvis) | [gao_2025](queries/gao_2025/) | All 3 processed H5AD files |
| [Premotor Cortex Decision-Making Data](#premotor-cortex-decision-making-data) | [genkin_2025](queries/genkin_2025/) | 2 data ZIP files and their description |
| [Cholinergic Sensory-Modulation Data](#cholinergic-sensory-modulation-data) | [yu_2025](queries/yu_2025/) | 5 result ZIP files; exclude code_flow.zip |
| [Zebrafish Functional Brain-Network Data](#zebrafish-functional-brain-network-data) | [legare_2025](queries/legare_2025/) | Complete Borealis record: Subjects, Atlas, Files and README |

## IBL Brain-Wide Map and Widefield Data

Paper ID: `findling_2025` · [Queries](queries/findling_2025/) · [Rubrics](rubrics/findling_2025/)

- Findling et al., Nature, 2025: [Brain-wide representations of prior information in mouse decision-making](https://doi.org/10.1038/s41586-025-09226-1).

Paper ID: `ibl_2025` · [Queries](queries/ibl_2025/) · [Rubrics](rubrics/ibl_2025/)

- International Brain Laboratory et al., Nature, 2025: [A brain-wide map of neural activity during complex behaviour](https://doi.org/10.1038/s41586-025-09235-0).

### Required downloads

| Resource | Download scope | Source |
| --- | --- | --- |
| BWM processed electrophysiology and behaviour | All `alf*` collections, including probe subcollections, for sessions indexed by `Brainwidemap`; paper release: 459 sessions, 699 probe insertions | [BWM release](https://int-brain-lab.github.io/iblenv/notebooks_external/2025_data_release_brainwidemap.html) · [ONE guide](https://int-brain-lab.github.io/iblenv/notebooks_external/data_download.html) |
| Processed widefield imaging and behaviour | All `alf*` collections for public widefield sessions, retaining spatial/temporal components, imaging times, channels, landmarks and behaviour | [Widefield guide](https://int-brain-lab.github.io/iblenv/notebooks_external/loading_widefield_data.html) |
| Region table | `region_info.csv` | [Download CSV](https://raw.githubusercontent.com/int-brain-lab/paper-brain-wide-map/plotting/brainwidemap/meta/region_info.csv) |
| Atlas | Swanson flatmap and associated IBL atlas resources, acquired through `iblatlas` | [Atlas setup](https://int-brain-lab.github.io/iblenv/notebooks_external/atlas_swanson_flatmap.html) |

BWM is shared by both papers: download it once. Widefield is additionally used
by the prior-information paper. Do not restrict downloads to the tutorial's
first session, one brain region, or sessions selected for a benchmark query.

### Download and prepare

1. Install `ONE-api`, then use the examples below with your chosen data root.
   If prompted, use the public-access login in the official ONE guide.
2. Keep the ONE-created lab/subject/session directories. Existing downloads
   may be reused by pointing the client to their cache.
3. Save the region table under the accessible data root. Install `iblatlas`
   and acquire its atlas resources following the linked guide; package
   installation alone does not necessarily acquire all atlas assets.

<details>
<summary>Download commands — processed BWM and widefield data</summary>

```bash
python -m pip install ONE-api iblatlas
```

BWM (one shared copy):

```python
from pathlib import Path
from one.api import ONE

data_root = Path("/path/to/brain-arena-data")
one = ONE(
    base_url="https://openalyx.internationalbrainlab.org",
    cache_dir=data_root / "ibl-bwm",
)
one.load_cache(tag="Brainwidemap")
sessions = one.search(query_type="local")
print(f"BWM sessions indexed: {len(sessions)} (paper release: 459)")
if len(sessions) != 459:
    raise RuntimeError("Check the release/tag against the official BWM guide before downloading.")
for eid in sessions:
    one.load_collection(eid, "alf*", download_only=True)
```

Widefield (run separately with a fresh ONE instance):

```python
from pathlib import Path
from one.api import ONE

data_root = Path("/path/to/brain-arena-data")
one = ONE(
    base_url="https://openalyx.internationalbrainlab.org",
    cache_dir=data_root / "ibl-widefield",
)
sessions = one.search(datasets="widefieldU.images.npy", query_type="remote")
print(f"Available widefield sessions: {len(sessions)}")
for eid in sessions:
    one.load_collection(eid, "alf*", download_only=True)
```

These examples follow the official API guide but have not been validated by a
complete download. Processed-data downloads can still be large.

</details>

For this processed-data preparation, you can skip:

- Raw AP/LF signals (`.ap.cbin`, `.lf.cbin`) for redoing spike sorting.
- Raw camera videos for redoing behavioural tracking.
- Raw widefield movies when using the supplied processed components.

Do not omit processed behaviour, movement, timing or anatomical annotations.
The raw-inclusive approximately 40-TB copy is not a minimum requirement. Raw
signals remain accessible through the [official raw-data guide](https://int-brain-lab.github.io/iblenv/notebooks_external/loading_raw_ephys_data.html)
for users who want them for additional work.

## Zebrafish Compass-Neuron Data

Paper ID: `tanaka_2026` · [Queries](queries/tanaka_2026/) · [Rubrics](rubrics/tanaka_2026/)

- Tanaka and Portugues, Nature, 2026: [Plastic landmark anchoring in zebrafish compass neurons](https://doi.org/10.1038/s41586-025-09888-x).

### Required downloads

Source: [Zenodo record 17233579](https://doi.org/10.5281/zenodo.17233579).
Download all ten archives:

| File | Action |
| --- | --- |
| [main01.zip](https://zenodo.org/api/records/17233579/files/main01.zip/content) | Download and extract |
| [main02.zip](https://zenodo.org/api/records/17233579/files/main02.zip/content) | Download and extract |
| [main03.zip](https://zenodo.org/api/records/17233579/files/main03.zip/content) | Download and extract |
| [main05.zip](https://zenodo.org/api/records/17233579/files/main05.zip/content) | Download and extract |
| [ed03.zip](https://zenodo.org/api/records/17233579/files/ed03.zip/content) | Download and extract |
| [ed04a.zip](https://zenodo.org/api/records/17233579/files/ed04a.zip/content) | Download and extract |
| [ed04b.zip](https://zenodo.org/api/records/17233579/files/ed04b.zip/content) | Download and extract |
| [ed06.zip](https://zenodo.org/api/records/17233579/files/ed06.zip/content) | Download and extract |
| [ed08.zip](https://zenodo.org/api/records/17233579/files/ed08.zip/content) | Download and extract |
| [ed10.zip](https://zenodo.org/api/records/17233579/files/ed10.zip/content) | Download and extract |

### Download and prepare

Download the linked archives, or select all ten files on Zenodo. Extract all
ten under your data root, preserving their internal structures. Prepare the
complete collection, not one selected archive per task.

## C. elegans Brain-Wide Activity and Behavior

Paper ID: `atanas_2023` · [Queries](queries/atanas_2023/) · [Rubrics](rubrics/atanas_2023/)

- Atanas, Kim et al., Cell, 2023: [Brain-wide representations of behavior spanning multiple timescales and states in C. elegans](https://doi.org/10.1016/j.cell.2023.07.035).

### Required downloads

Source: [Zenodo record 8150515](https://doi.org/10.5281/zenodo.8150515),
*CePNEM model analysis data and ANTSUN and microscopy neural network weights*.
Download all seven files:

| File | After extraction |
| --- | --- |
| [analysis_dict.jld2.bz2](https://zenodo.org/api/records/8150515/files/analysis_dict.jld2.bz2/content) | `analysis_dict.jld2` |
| [dict_neuropal_label.jld2.bz2](https://zenodo.org/api/records/8150515/files/dict_neuropal_label.jld2.bz2/content) | `dict_neuropal_label.jld2` |
| [fit_results.jld2.bz2](https://zenodo.org/api/records/8150515/files/fit_results.jld2.bz2/content) | `fit_results.jld2` |
| [fit_results_lite.jld2.bz2](https://zenodo.org/api/records/8150515/files/fit_results_lite.jld2.bz2/content) | `fit_results_lite.jld2` |
| [relative_encoding_strength.jld2.bz2](https://zenodo.org/api/records/8150515/files/relative_encoding_strength.jld2.bz2/content) | `relative_encoding_strength.jld2` |
| [umap_dict.jld2.bz2](https://zenodo.org/api/records/8150515/files/umap_dict.jld2.bz2/content) | `umap_dict.jld2` |
| [deepnet-weights.tar.bz2](https://zenodo.org/api/records/8150515/files/deepnet-weights.tar.bz2/content) | Weights archive contents, with original directories |

### Download and prepare

Download all seven files. Decompress each `.jld2.bz2` using a bzip2-capable
archive tool and extract the `.tar.bz2` archive. Keep the six JLD2 files and
weights together under the data root.

<a id="zebrafish-activity-gene-expression-co-mapping"></a>

## Zebrafish Activity–Gene Expression Co-mapping

Paper ID: `marquez_legorreta_2026` · [Queries](queries/marquez_legorreta_2026/) · [Rubrics](rubrics/marquez_legorreta_2026/)

- Marquez-Legorreta et al., bioRxiv, 2026: [Whole-Brain Co-Mapping of Gene Expression and Neuronal Activity at Cellular Resolution in Behaving Zebrafish](https://doi.org/10.64898/2026.02.07.704095).

### Required downloads

| Dataset | Scope | Source |
| --- | --- | --- |
| Dataset 1 | All preprocessed files for the main three fish analysed in the paper | [Figshare Dataset 1](https://figshare.com/s/d1d19b105c4f74865c32) |

Includes cell activity traces and coordinates, gene-expression profiles,
behaviour, stimulus time-series/information and metadata such as cell masks.

### Download and prepare

Open Dataset 1 and download all its files. Extract its archives, preserving
the authors' three-fish organization.

## Drosophila Head-Direction Data

Paper ID: `basnak_2025` · [Queries](queries/basnak_2025/) · [Rubrics](rubrics/basnak_2025/)

- Basnak et al., Nature Neuroscience, 2025: [Multimodal cue integration and learning in a neural representation of head direction](https://doi.org/10.1038/s41593-024-01823-z).

### Required downloads

| Dataset | Scope | Source |
| --- | --- | --- |
| DANDI 000289 | Complete experimental Dandiset: all subject data and dataset metadata | [DANDI 000289](https://dandiarchive.org/dandiset/000289) |

### Download and prepare

Open the Dandiset, choose **Download**, and use its generated command to download
the complete dataset, not selected assets. For command-line downloading,
install `dandi` with `python -m pip install dandi` first. Keep the original
Dandiset structure.

<a id="developing-mouse-visual-cortex-devvis"></a>

## Developing Mouse Visual Cortex — DevVIS

Paper ID: `gao_2025` · [Queries](queries/gao_2025/) · [Rubrics](rubrics/gao_2025/)

- Gao et al., Nature, 2025: [Continuous cell-type diversification in mouse visual cortex development](https://doi.org/10.1038/s41586-025-09644-1).

### Required downloads

Download all three author-provided files:

| File | Data |
| --- | --- |
| [DevVIS_scRNA_processed.h5ad](https://allen-developmental-mouse-atlas.s3.amazonaws.com/scRNA/DevVIS_scRNA_processed.h5ad) | 10x scRNA-seq |
| [DevVIS_multiome_snRNA_processed.h5ad](https://allen-developmental-mouse-atlas.s3.us-west-2.amazonaws.com/Multiome/DevVIS_multiome_snRNA_processed.h5ad) | Multiome snRNA-seq |
| [DevVIS_multiome_snATAC_processed.h5ad](https://allen-developmental-mouse-atlas.s3.amazonaws.com/Multiome/DevVIS_multiome_snATAC_processed.h5ad) | Multiome snATAC-seq |

### Download and prepare

Download the three linked files into your data root, keeping their original
names. No extraction, format conversion or task-specific split is needed.

## Premotor Cortex Decision-Making Data

Paper ID: `genkin_2025` · [Queries](queries/genkin_2025/) · [Rubrics](rubrics/genkin_2025/)

- Genkin et al., Nature, 2025: [The dynamics and geometry of choice in the premotor cortex](https://doi.org/10.1038/s41586-025-09199-1).

### Required downloads

Source: the paper's [Figshare data record](https://doi.org/10.6084/m9.figshare.29052116.v1).

| File | Action |
| --- | --- |
| `dataset.zip` | Download and extract |
| `dataset_extended.zip` | Download and extract |
| `Datasets description.docx` | Download and retain as documentation |

### Download and prepare

Open the Figshare record and obtain all three named files. Extract both data
archives under the data root, retaining their internal structures. Do not
substitute only the smaller archive for the full collection.

## Cholinergic Sensory-Modulation Data

Paper ID: `yu_2025` · [Queries](queries/yu_2025/) · [Rubrics](rubrics/yu_2025/)

- Yu et al., Science, 2025: [Cholinergic feedback for modality- and context-specific modulation of sensory representations](https://doi.org/10.1126/science.ads9152).

### Required downloads

Source: [OSF project 293CS](https://doi.org/10.17605/OSF.IO/293CS).
Download these five archives:

| File | Action |
| --- | --- |
| `result_aud.zip` | Download and extract |
| `result_cortex.zip` | Download and extract |
| `result_dread.zip` | Download and extract |
| `result_learning.zip` | Download and extract |
| `result_passive.zip` | Download and extract |

### Download and prepare

Open the OSF **Files** section and select only the five named files, excluding
`code_flow.zip`. Extract all five under your data root, preserving their internal
structures. These form one shared collection, not one selected archive per task.

## Zebrafish Functional Brain-Network Data

Paper ID: `legare_2025` · [Queries](queries/legare_2025/) · [Rubrics](rubrics/legare_2025/)

- Légaré et al., Science Advances, 2025: [Structural and genetic determinants of zebrafish functional brain networks](https://doi.org/10.1126/sciadv.adv7576).

### Required downloads

Source: [Borealis dataset DOI 10.5683/SP3/IIVGOB](https://doi.org/10.5683/SP3/IIVGOB).
Download **all files in the record**, including:

| Deposited directory/file | Scope |
| --- | --- |
| `Subjects/` | All 22 fish directories: every `data.hdf5` and all deposited swim/tail files |
| `Atlas/` | All 8 deposited files |
| `Files/` | All 13 deposited files, including connectivity, gene expression and other resources |
| Root `README.txt` | Dataset documentation |

### Download and prepare

Select all files in Borealis and download them, using its bulk-download option
where available. If batch downloads are needed, cover all four rows above.
Extract archives and preserve the deposited folder labels. Different fish
have identically named `data.hdf5` files: **do not flatten the directory tree**
or overwrite these files. Not every fish has both swim and tail files.
