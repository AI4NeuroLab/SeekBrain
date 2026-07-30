# SeekBrain

[![Built on pi](https://img.shields.io/badge/Built_on-pi-24292f?style=flat-square)](https://github.com/earendil-works/pi)
![Node.js >=22.19](https://img.shields.io/badge/Node.js-%3E%3D22.19-339933?style=flat-square&logo=nodedotjs&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

SeekBrain is an open-source, domain-specialized multi-agent framework for
semi-autonomous neuroscience discovery. It transforms broad scientific questions
and heterogeneous, multimodal brain data into hierarchical research plans,
executable analysis pipelines, validated figures and statistics, and
evidence-grounded conclusions—while keeping researchers in the loop.

<p align="center">
  <img src="./demo.gif" alt="SeekBrain terminal demo" width="100%" />
</p>

## News

- **2026-07-17** — SeekBrain was released at the WAIC 2026 Science Frontiers Forum.

## Get started

> [!NOTE]
> SeekBrain requires Node.js 22.19 or newer and a supported model-provider API
> key. Node.js 24 is recommended.

Install SeekBrain from npm:

```bash
npm install --global seekbrain
```

Launch it:

```bash
seekbrain
```

On first launch, SeekBrain guides you through model routing and literature-provider
setup. To see all commands and options, run:

```bash
seekbrain --help
```

## How it works

SeekBrain adapts its workflow to the scientific question and data you provide.

### Explore a dataset

Enter a dataset directory:

```text
path/to/dataset
```

SeekBrain profiles the dataset and constructs canonical metadata describing its
scientific assets, repeated experimental units, conditions, modalities, data
shapes, axis semantics, and execution-relevant relationships. It then gives you
a compact dataset overview and recommends 3–5 concrete research directions
supported by the available data.

### Run a neuroscience study

Enter a research question together with the dataset:

```text
How does neural activity differ between the experimental conditions?

Dataset: path/to/dataset
```

Each terminal task enters a four-agent Analysis Execution workflow that
generates and examines empirical results before they are accepted for
interpretation.

1. **Formulate** — Turn an atomic task and its available data into a
   recipe-grounded methodological schema.
2. **Code** — Translate the schema into Python, then explore the data, tune
   parameters, and resolve errors in a sandbox.
3. **Validate** — Review the methods and outputs, returning targeted feedback
   until the analysis is scientifically sound.
4. **Interpret** — Synthesize validated figures and statistics while documenting
   limitations and uncertainty.

#### Example 1: hierarchical zebrafish SC modules

SeekBrain includes a compact structural-connectivity dataset from Légaré et al.,
*Structural and genetic determinants of zebrafish functional brain networks*
(*Science Advances*, 2025). It contains directed and undirected 70 × 70 SC
matrices, the five region indices excluded in the paper's analysis, bilateral
regional centroids, and dorsal and sagittal atlas projections.

Enter the following question and bundled dataset path directly in SeekBrain:

```text
I want to identify structural connectivity (SC) network modules through a hierarchical consensus algorithm. First, generate a co-assignment probability matrix of SC based on the iterative Louvain algorithm for maximization of modularity. Then, generate the list of module labels by using hierarchical clustering (Ward’s linkage) on the co-assignment matrix of SC. Highlight a partition with 4 modules with thick-edge boxes on the co-assignment probability matrix of SC. Plot the dendrogram along the left side of the matrix. Use SC_matrix_directed_terminals_expanded.npy in ZEBRAFISH_PATH for analysis and visualization. Before analysis, use excluded_regions.npy to identify regions to exclude from the SC matrix.

dataset: "$(npm root --global)/seekbrain/examples/zebrafish-sc-network-modules"
```

The original panel and a SeekBrain reproduction from the same two input files
are shown below.

<table>
  <tr>
    <td align="center" width="42%">
      <img src="assets/readme/zebrafish-sc-modules-original.png" alt="Original Figure 3A structural-connectivity co-assignment matrix" width="100%"><br>
      <em>Original Figure 3A from Légaré et al. (2025).</em>
    </td>
    <td align="center" width="58%">
      <img src="assets/readme/zebrafish-sc-modules-seekbrain.png" alt="SeekBrain reproduction of the structural-connectivity module analysis" width="100%"><br>
      <em>SeekBrain reproduction.</em>
    </td>
  </tr>
</table>

#### Example 2: SC network overlay on the zebrafish brain atlas

The same bundled dataset also supports anatomical visualization of the SC
network. Enter the following question with the same dataset path:

```text
I want to visualize the Structural Connectivity (SC) network on the zebrafish brain atlas. Overlay the regional centroid network representation onto the top and side views of the brain projection images. Use the SC values stored in SC_matrix_undirected_terminals_expanded.npy to color the edges between regional centroids. Note that the undirected SC matrix is unilateral, a bilateral SC matrix should be created from it. Get the coordinates of left and right-brain regional centroids from the atlas folder, adjusting the y-coordinates of the centroids to match the image orientation. Before visualization, remove those regions listed in the excluded_regions.npy(the regions IDs only in a half brain, also need to double them for bilateral visualization) from the bilateral SC matrix and regional centroids.

dataset: "$(npm root --global)/seekbrain/examples/zebrafish-sc-network-modules"
```

This analysis expands the unilateral SC matrix into a bilateral representation,
removes the corresponding regions from both hemispheres, and overlays weighted
edges between regional centroids on the top and side atlas projections.

<table>
  <tr>
    <td align="center" width="36%">
      <img src="assets/readme/zebrafish-sc-atlas-original.png" alt="Original Figure 2B zebrafish structural-connectivity atlas overlay" width="100%"><br>
      <em>Original Figure 2B from Légaré et al. (2025).</em>
    </td>
    <td align="center" width="64%">
      <img src="assets/readme/zebrafish-sc-atlas-seekbrain.png" alt="SeekBrain reproduction of the zebrafish structural-connectivity atlas overlay" width="100%"><br>
      <em>SeekBrain reproduction.</em>
    </td>
  </tr>
</table>

The processed source dataset is available under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) at
[doi:10.5683/SP3/IIVGOB](https://doi.org/10.5683/SP3/IIVGOB), with analysis code
at [pdesrosiers/Legare-zebrafish-brain-networks](https://github.com/pdesrosiers/Legare-zebrafish-brain-networks).

### Investigate a broad question with Research Planning

For a complex, multi-part scientific objective, you can request Research Planning
directly:

```text
Use Research Planning mode to investigate how individual variability,
brain-network organization, and behavior are related across this dataset.

Dataset: path/to/dataset
```

SeekBrain may also recommend Research Planning when a question requires several
linked hypotheses or analyses. A **Survey Agent** supplies scientific
background. The **Orchestrator** decomposes the question, while a **Reviewer**
challenges and refines the plan until it is concrete and feasible.

- **ROOT** — General research query
- **BRANCHES** — Sub-questions and biological hypotheses
- **LEAVES** — Atomic analysis tasks

Independent task branches can formulate methods and run in parallel. Their
validated evidence is aggregated from task rounds to sub-question conclusions
and then to an overall scientific conclusion, preserving links to the supporting
statistics, figures, and limitations.

Run the following command to select completed task rounds and generate the final
report:

```text
/seekbrain-report
```

## Highlights

### A neuroscience-specific analytical repertoire

SeekBrain ships with **68 foundational, curated analysis recipes** spanning the
workflow from data preprocessing to statistical analysis, modeling, and
visualization.

The repertoire covers neural dynamics, behavior, structural and anatomical data,
molecular data, and multimodal analyses. Each recipe links a scientific objective
to its required data, processing and modeling steps, expected outputs,
visualization logic, and corresponding executable code. SeekBrain can retrieve,
adapt, and combine these recipes for new research questions rather than treating
them as fixed templates.

### Learn from validated research trajectories

After a run has passed Validation, you can distill its plan, code, execution
history, results, and researcher feedback into a reusable recipe:

```text
/seekbrain-save-recipe
```

To save a specific run or Research Planning task round:

```text
/seekbrain-save-recipe <run-id>
```

The resulting recipe removes incidental details such as local paths and
dataset-specific variable names while retaining the reusable methodological
sequence and expected outputs. It is added to the user's recipe collection and
can be retrieved in future analyses.

### Researcher-in-the-loop validation

Researchers can review and revise the hierarchical research plan, methodological
schemas, and task rounds. Code generation and scientific validation form a
closed loop, allowing concrete problems to be repaired before interpretation
while preserving visible limitations when the available evidence is incomplete.

### Parallel hierarchical research

Research Planning connects broad biological objectives to concrete computational
tasks. Independent task branches can prepare methods and execute concurrently,
while task-level evidence remains linked to its originating sub-question,
hypothesis, plan, and round.

### Traceable academic reports

Research Planning projects support explicit report generation through:

```text
/seekbrain-report
```

Researchers can select one or multiple completed rounds from any task. The Report
Agent aggregates key findings, supporting statistics, figures, and limitations
from task-level evidence into sub-question conclusions and then into an overall
answer.

The built-in reporter produces a publication-style `report.md` and `report.pdf`
with a title, abstract, introduction, results with cited figures, discussion,
conclusion, and limitations. Conclusions remain traceable to their supporting
task rounds and generated artifacts.

## Paper

**SeekBrain: An Autonomous Multi-Agent Framework for Accelerating Neuroscience Discovery**

### Overview

SeekBrain accelerates neuroscience discovery through domain-grounded hierarchical
planning and cross-modal data analysis. It combines a dynamically evolving
Neuroscience Analysis Repertoire with a Research Planning Engine, an Analysis
Execution Engine, scientific validation, and researcher-in-the-loop feedback.

On the expert-annotated BrainArena benchmark, SeekBrain outperformed Claude Code
and Codex by 11.7% and 17.7%, respectively. The contribution extends beyond
benchmark performance: two real-world studies demonstrate its ability to support
both researcher-directed exploration and agent-led hypothesis testing.

<p align="center">
  <img src="assets/readme/workflow.png" alt="SeekBrain workflow" width="100%">
</p>

<p align="center"><em>Figure 1. SeekBrain couples a Research Planning Engine and an Analysis Execution Engine with a co-evolving Neuroscience Analysis Repertoire and hierarchical evidence reporting.</em></p>

### Structured neural representations of zebrafish behavior

In a multimodal dataset from free-moving larval zebrafish, SeekBrain integrated
tail kinematics, brain-wide calcium dynamics, and anatomy. It identified three
behavioral bout types and learned an eight-dimensional neural representation that
decoded these types with an accuracy of 0.949 ± 0.034.

After cross-fish alignment, matching behavioral clusters showed significantly
more similar neural geometry than nonmatching clusters
(*P* = 2.44 × 10⁻⁴, *n* = 13 larvae). Behaviorally tuned neural signals were
distributed from forebrain to hindbrain, revealing structured and distributed
brain-wide representations of behavioral types.

<p align="center">
  <img src="assets/readme/zebrafish-discovery.png" alt="Structured and distributed brain-wide neural representations of behavioral types in free-moving larval zebrafish" width="100%">
</p>

<p align="center"><em>Figure 2. Structured and distributed brain-wide neural representations of behavioral types in free-moving larval zebrafish.</em></p>

### A shared axis of regional decoding strength in mouse brain

In an agent-led reanalysis of the International Brain Laboratory mouse
decision-making dataset, SeekBrain tested whether five regional decoder maps—
stimulus, choice, feedback, speed, and velocity—shared a common organization
across 201 brain regions.

The first principal component explained 63.2% of the variance, exceeding a
5,000-permutation null distribution (*P* ≈ 0.0002). Rank-based PCA reproduced
the same regional axis (*r* = 0.96). Movement explained part, but not all, of
this organization: stimulus, choice, and feedback retained distinct regional
patterns after speed- and velocity-related variation was removed.

<p align="center">
  <img src="assets/readme/mouse-shared-axis.png" alt="Shared axis of regional decoding strength and task-specific residual patterns in mouse brain" width="100%">
</p>

<p align="center"><em>Figure 3. A shared axis of regional decoding strength and task-specific residual patterns in a mouse decision-making task.</em></p>

Together, these studies show that SeekBrain can perform cross-modal analyses,
test data-grounded hypotheses, and help researchers explore existing datasets in
new ways.

## Acknowledgements

SeekBrain is built on [Pi](https://github.com/earendil-works/pi), whose agent
runtime and terminal interface provide the foundation for its interactive
research workflow. We thank the Pi maintainers and contributors for making this
open-source infrastructure available.

The built-in academic report pipeline uses
[PDFKit](https://github.com/foliojs/pdfkit) for PDF generation,
[Marked](https://github.com/markedjs/marked) for Markdown processing, and the
[STIX General font family](assets/fonts/LICENSE_STIX.txt) for scientific
typesetting. We thank their maintainers and contributors. Third-party licenses
and font notices are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

We also acknowledge the neuroscience researchers and open-data initiatives whose
public datasets, publications, and code repositories make reproducible,
data-driven discovery possible.

## License

SeekBrain is released under the [MIT License](LICENSE).
