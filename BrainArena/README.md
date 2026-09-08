# BrainArena

BrainArena is a benchmark designed to test how well LLM agents handle complex
analyses of multimodal neuroscience data. BrainArena includes 32 tasks constructed
from selected neuroscience studies. Each task includes an expert-annotated
analysis query and a scoring rubric. The query sets the scope of the task by
specifying the input data, overall objective, and required output.

The rubric evaluates three aspects: method correctness, figure fidelity (whether
the visual patterns match the reference), and interpretive validity (whether the
results are interpreted in a scientifically valid way).

This collection covers 10 papers. See the [agent input example](../README.md#-brainarena),
browse the [queries and rubrics](#queries-and-rubrics), and follow the
[data preparation guide](DATASETS.md).

## Contents

```text
BrainArena/
  README.md
  DATASETS.md
  papers.json
  tasks.csv
  queries/<paper_id>/<figure>.md
  rubrics/<paper_id>/<figure>.json
```

- [tasks.csv](tasks.csv) maps each task to its query, rubric, paper ID, and
  original figure/panel reference. Paths are relative to this directory.
- [papers.json](papers.json) records paper titles, citations, DOIs, publication
  years, labelled official resource links, and links to the data instructions.
- [DATASETS.md](DATASETS.md) lists required downloads and preparation instructions.
- `queries/` contains the query text.
- `rubrics/` contains an expert-annotated scoring rubric for each analysis query.

## Papers

The same `paper_id` identifies each paper across the query and rubric directories,
[tasks.csv](tasks.csv), [papers.json](papers.json), and [DATASETS.md](DATASETS.md).

| Paper ID | Paper | Publication | Tasks | Resources |
| --- | --- | --- | ---: | --- |
| `atanas_2023` | [Brain-wide representations of behavior spanning multiple timescales and states in C. elegans](https://doi.org/10.1016/j.cell.2023.07.035) | Cell, 2023 | 5 | [Queries](queries/atanas_2023/) · [Rubrics](rubrics/atanas_2023/) · [Data](DATASETS.md#c-elegans-brain-wide-activity-and-behavior) |
| `marquez_legorreta_2026` | [Whole-Brain Co-Mapping of Gene Expression and Neuronal Activity at Cellular Resolution in Behaving Zebrafish](https://doi.org/10.64898/2026.02.07.704095) | bioRxiv, 2026 | 3 | [Queries](queries/marquez_legorreta_2026/) · [Rubrics](rubrics/marquez_legorreta_2026/) · [Data](DATASETS.md#zebrafish-activity-gene-expression-co-mapping) |
| `genkin_2025` | [The dynamics and geometry of choice in the premotor cortex](https://doi.org/10.1038/s41586-025-09199-1) | Nature, 2025 | 4 | [Queries](queries/genkin_2025/) · [Rubrics](rubrics/genkin_2025/) · [Data](DATASETS.md#premotor-cortex-decision-making-data) |
| `findling_2025` | [Brain-wide representations of prior information in mouse decision-making](https://doi.org/10.1038/s41586-025-09226-1) | Nature, 2025 | 4 | [Queries](queries/findling_2025/) · [Rubrics](rubrics/findling_2025/) · [Data](DATASETS.md#ibl-brain-wide-map-and-widefield-data) |
| `ibl_2025` | [A brain-wide map of neural activity during complex behaviour](https://doi.org/10.1038/s41586-025-09235-0) | Nature, 2025 | 2 | [Queries](queries/ibl_2025/) · [Rubrics](rubrics/ibl_2025/) · [Data](DATASETS.md#ibl-brain-wide-map-and-widefield-data) |
| `yu_2025` | [Cholinergic feedback for modality- and context-specific modulation of sensory representations](https://doi.org/10.1126/science.ads9152) | Science, 2025 | 2 | [Queries](queries/yu_2025/) · [Rubrics](rubrics/yu_2025/) · [Data](DATASETS.md#cholinergic-sensory-modulation-data) |
| `legare_2025` | [Structural and genetic determinants of zebrafish functional brain networks](https://doi.org/10.1126/sciadv.adv7576) | Science Advances, 2025 | 4 | [Queries](queries/legare_2025/) · [Rubrics](rubrics/legare_2025/) · [Data](DATASETS.md#zebrafish-functional-brain-network-data) |
| `tanaka_2026` | [Plastic landmark anchoring in zebrafish compass neurons](https://doi.org/10.1038/s41586-025-09888-x) | Nature, 2026 | 3 | [Queries](queries/tanaka_2026/) · [Rubrics](rubrics/tanaka_2026/) · [Data](DATASETS.md#zebrafish-compass-neuron-data) |
| `basnak_2025` | [Multimodal cue integration and learning in a neural representation of head direction](https://doi.org/10.1038/s41593-024-01823-z) | Nature Neuroscience, 2025 | 2 | [Queries](queries/basnak_2025/) · [Rubrics](rubrics/basnak_2025/) · [Data](DATASETS.md#drosophila-head-direction-data) |
| `gao_2025` | [Continuous cell-type diversification in mouse visual cortex development](https://doi.org/10.1038/s41586-025-09644-1) | Nature, 2025 | 3 | [Queries](queries/gao_2025/) · [Rubrics](rubrics/gao_2025/) · [Data](DATASETS.md#developing-mouse-visual-cortex-devvis) |

## Queries and rubrics

Each row is one analysis task. The Data link opens the paper's shared download guide.

| Paper ID | Original figure reference | Query | Scoring rubric | Data |
| --- | --- | --- | --- | --- |
| `atanas_2023` | Figure 1, panel H | [Query](queries/atanas_2023/Fig_1H.md) | [Rubric](rubrics/atanas_2023/Fig_1H.json) | [Data](DATASETS.md#c-elegans-brain-wide-activity-and-behavior) |
| `atanas_2023` | Figure 2, panel C | [Query](queries/atanas_2023/Fig_2C.md) | [Rubric](rubrics/atanas_2023/Fig_2C.json) | [Data](DATASETS.md#c-elegans-brain-wide-activity-and-behavior) |
| `atanas_2023` | Figure 2, panel D | [Query](queries/atanas_2023/Fig_2D.md) | [Rubric](rubrics/atanas_2023/Fig_2D.json) | [Data](DATASETS.md#c-elegans-brain-wide-activity-and-behavior) |
| `atanas_2023` | Figure 3, panel B | [Query](queries/atanas_2023/Fig_3B.md) | [Rubric](rubrics/atanas_2023/Fig_3B.json) | [Data](DATASETS.md#c-elegans-brain-wide-activity-and-behavior) |
| `atanas_2023` | Figure 3, panel G | [Query](queries/atanas_2023/Fig_3G.md) | [Rubric](rubrics/atanas_2023/Fig_3G.json) | [Data](DATASETS.md#c-elegans-brain-wide-activity-and-behavior) |
| `marquez_legorreta_2026` | Figure 3, panel B | [Query](queries/marquez_legorreta_2026/Fig_3B.md) | [Rubric](rubrics/marquez_legorreta_2026/Fig_3B.json) | [Data](DATASETS.md#zebrafish-activity-gene-expression-co-mapping) |
| `marquez_legorreta_2026` | Figure 4, panel D | [Query](queries/marquez_legorreta_2026/Fig_4D.md) | [Rubric](rubrics/marquez_legorreta_2026/Fig_4D.json) | [Data](DATASETS.md#zebrafish-activity-gene-expression-co-mapping) |
| `marquez_legorreta_2026` | Figure 5, panel A | [Query](queries/marquez_legorreta_2026/Fig_5A.md) | [Rubric](rubrics/marquez_legorreta_2026/Fig_5A.json) | [Data](DATASETS.md#zebrafish-activity-gene-expression-co-mapping) |
| `genkin_2025` | Figure 2, panel B | [Query](queries/genkin_2025/Fig_2B.md) | [Rubric](rubrics/genkin_2025/Fig_2B.json) | [Data](DATASETS.md#premotor-cortex-decision-making-data) |
| `genkin_2025` | Figure 3, panel A | [Query](queries/genkin_2025/Fig_3A.md) | [Rubric](rubrics/genkin_2025/Fig_3A.json) | [Data](DATASETS.md#premotor-cortex-decision-making-data) |
| `genkin_2025` | Figure 3, panel C | [Query](queries/genkin_2025/Fig_3C.md) | [Rubric](rubrics/genkin_2025/Fig_3C.json) | [Data](DATASETS.md#premotor-cortex-decision-making-data) |
| `genkin_2025` | Figure 4, panel B | [Query](queries/genkin_2025/Fig_4B.md) | [Rubric](rubrics/genkin_2025/Fig_4B.json) | [Data](DATASETS.md#premotor-cortex-decision-making-data) |
| `findling_2025` | Figure 2, panel A | [Query](queries/findling_2025/Fig_2A.md) | [Rubric](rubrics/findling_2025/Fig_2A.json) | [Data](DATASETS.md#ibl-brain-wide-map-and-widefield-data) |
| `findling_2025` | Figure 3, panel A | [Query](queries/findling_2025/Fig_3A.md) | [Rubric](rubrics/findling_2025/Fig_3A.json) | [Data](DATASETS.md#ibl-brain-wide-map-and-widefield-data) |
| `findling_2025` | Figure 4, panel A | [Query](queries/findling_2025/Fig_4A.md) | [Rubric](rubrics/findling_2025/Fig_4A.json) | [Data](DATASETS.md#ibl-brain-wide-map-and-widefield-data) |
| `findling_2025` | Figure 4, panel F | [Query](queries/findling_2025/Fig_4F.md) | [Rubric](rubrics/findling_2025/Fig_4F.json) | [Data](DATASETS.md#ibl-brain-wide-map-and-widefield-data) |
| `ibl_2025` | Figure 4, panel B | [Query](queries/ibl_2025/Fig_4B.md) | [Rubric](rubrics/ibl_2025/Fig_4B.json) | [Data](DATASETS.md#ibl-brain-wide-map-and-widefield-data) |
| `ibl_2025` | Figure 4, panels L and M | [Query](queries/ibl_2025/Fig_4LM.md) | [Rubric](rubrics/ibl_2025/Fig_4LM.json) | [Data](DATASETS.md#ibl-brain-wide-map-and-widefield-data) |
| `yu_2025` | Figure 5, panel C | [Query](queries/yu_2025/Fig_5C.md) | [Rubric](rubrics/yu_2025/Fig_5C.json) | [Data](DATASETS.md#cholinergic-sensory-modulation-data) |
| `yu_2025` | Figure 5, panel M | [Query](queries/yu_2025/Fig_5M.md) | [Rubric](rubrics/yu_2025/Fig_5M.json) | [Data](DATASETS.md#cholinergic-sensory-modulation-data) |
| `legare_2025` | Figure 1, panel E | [Query](queries/legare_2025/Fig_1E.md) | [Rubric](rubrics/legare_2025/Fig_1E.json) | [Data](DATASETS.md#zebrafish-functional-brain-network-data) |
| `legare_2025` | Figure 2, panel B | [Query](queries/legare_2025/Fig_2B.md) | [Rubric](rubrics/legare_2025/Fig_2B.json) | [Data](DATASETS.md#zebrafish-functional-brain-network-data) |
| `legare_2025` | Figure 3, panel A | [Query](queries/legare_2025/Fig_3A.md) | [Rubric](rubrics/legare_2025/Fig_3A.json) | [Data](DATASETS.md#zebrafish-functional-brain-network-data) |
| `legare_2025` | Figure 5, panel F | [Query](queries/legare_2025/Fig_5F.md) | [Rubric](rubrics/legare_2025/Fig_5F.json) | [Data](DATASETS.md#zebrafish-functional-brain-network-data) |
| `tanaka_2026` | Figure 3, panel E | [Query](queries/tanaka_2026/Fig_3E.md) | [Rubric](rubrics/tanaka_2026/Fig_3E.json) | [Data](DATASETS.md#zebrafish-compass-neuron-data) |
| `tanaka_2026` | Figure 4, panel A | [Query](queries/tanaka_2026/Fig_4A.md) | [Rubric](rubrics/tanaka_2026/Fig_4A.json) | [Data](DATASETS.md#zebrafish-compass-neuron-data) |
| `tanaka_2026` | Figure 4, panel G | [Query](queries/tanaka_2026/Fig_4G.md) | [Rubric](rubrics/tanaka_2026/Fig_4G.json) | [Data](DATASETS.md#zebrafish-compass-neuron-data) |
| `basnak_2025` | Figure 2, panel C | [Query](queries/basnak_2025/Fig_2C.md) | [Rubric](rubrics/basnak_2025/Fig_2C.json) | [Data](DATASETS.md#drosophila-head-direction-data) |
| `basnak_2025` | Figure 3, panel C | [Query](queries/basnak_2025/Fig_3C.md) | [Rubric](rubrics/basnak_2025/Fig_3C.json) | [Data](DATASETS.md#drosophila-head-direction-data) |
| `gao_2025` | Figure 4, panel B | [Query](queries/gao_2025/Fig_4B.md) | [Rubric](rubrics/gao_2025/Fig_4B.json) | [Data](DATASETS.md#developing-mouse-visual-cortex-devvis) |
| `gao_2025` | Figure 5, panel A | [Query](queries/gao_2025/Fig_5A.md) | [Rubric](rubrics/gao_2025/Fig_5A.json) | [Data](DATASETS.md#developing-mouse-visual-cortex-devvis) |
| `gao_2025` | Figure 5, panel D | [Query](queries/gao_2025/Fig_5D.md) | [Rubric](rubrics/gao_2025/Fig_5D.json) | [Data](DATASETS.md#developing-mouse-visual-cortex-devvis) |

## Data preparation

Follow [DATASETS.md](DATASETS.md) to obtain data from the authors' sources.
Existing local downloads may be reused.

Give the agent the query and a single local data-root path. The agent must
inspect the available data and identify relevant files and sessions itself.

Where a query uses `<DATA_DIR>` or `ZEBRAFISH_PATH`, use your local data-root path.

## Using the rubrics

Rubrics contain reference answers and are for evaluation, not the agent's task
input. For scoring items that refer to a source figure, use the paper links and
figure references in the tables above to consult the original panel.

Follow the referenced papers' and datasets' citation and use terms.
