# Koninck_2025_Science_Advances Rubric 修订建议（视觉 + 文本双轨评分）

针对 `Koninck_2025_Science_Advances` 四个 panel 的 rubric 重新设计，采用**文本科学结论 + 视觉科学 pattern 双轨评分**结构。

## 设计原则

- **文本评分项（`type: "text"`）**：只评科学结论是否准确表达（是什么分析、揭示了什么生物 / 计算结论、关键定量与分类正确性）
- **视觉评分项（`type: "visual"`）**：只评具有**科学含义**的图像 pattern（生成图与 gt 图在科学事实层面是否一致），不评 colormap / 标注 / 尺寸 / 布局 / scale bar 等格式化细节
- **判别准则**：写完一条视觉项问自己——"这个 pattern 错了 / 没了，科学结论会变吗？" 如果不变，就别写进 rubric

## 评分项粗略配比

| Panel | 文本分 | 视觉分 | 总分 |
|-------|--------|--------|------|
| Fig_1E | 40 | 60 | 100 |
| Fig_2B | 40 | 60 | 100 |
| Fig_3A | 45 | 55 | 100 |
| Fig_5F | 30 | 70 | 100 |

视觉分占比偏高，因为 Koninck 四张图的核心科学发现都强依赖于图像 pattern（块结构、对称性、左侧化等）。

## 通用执行说明（建议加到每个 rubric 顶层 `Scoring instructions`）

> 评分时分两步：(1) 对模型输出的**文本结论部分**逐条核对 `type: "text"` 项，按 deduction_rule 扣分；(2) 对模型生成的**图像**与 gt 图并排比较，逐条核对 `type: "visual"` 项，仅判断科学 pattern 是否一致，不评配色、坐标、布局、scale bar 等格式细节。两类得分相加得到总分。

## 视觉项写作 checklist（避免写出格式化项目）

每条 `type: "visual"` 项写完后检查：
- ❌ 提到了 colormap / 配色名 / 颜色范围
- ❌ 提到了 axis / 坐标 / 朝向 / scale bar
- ❌ 提到了 panel 数量、布局位置、annotation 文字
- ❌ 提到了图像分辨率、尺寸
- ✅ 描述的是空间分布、相对强度、对称性、模块结构、量级排序、聚类层次等**与科学结论挂钩**的 pattern
- ✅ 即便模型用不同 colormap / 朝向也能得分

---

## Fig_1E — FC 矩阵

```json
{
  "tag": "Fig_1E",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Group-averaged functional connectivity matrix from 22 zebrafish larvae, computed as pairwise correlations between region-averaged spontaneous calcium activity, reveals anatomically structured functional organization across 65 brain regions.",
      "scoring_items": [
        {
          "type": "text", "point": 20,
          "criterion": "Correctly identifies the analysis as functional connectivity (FC) computed from pairwise correlations between region-averaged calcium activity traces, not structural / anatomical connectivity.",
          "deduction_rule": "Deduct 20 if FC vs SC is confused. Deduct 10 if 'connectivity' is described without mentioning correlation-based computation."
        },
        {
          "type": "text", "point": 10,
          "criterion": "States that the matrix is averaged across multiple larvae (n ≈ 22) and covers ~65 brain regions, representing a group-level whole-brain FC map.",
          "deduction_rule": "Deduct 10 if neither group-averaging nor whole-brain coverage is conveyed. Deduct 5 for missing one of the two."
        },
        {
          "type": "text", "point": 10,
          "criterion": "Indicates that FC was computed from spontaneous (not task-evoked) activity.",
          "deduction_rule": "Deduct 10 if spontaneous-activity context is explicitly contradicted (e.g., described as evoked). No deduction if simply omitted, since this is a task input."
        },
        {
          "type": "visual", "point": 25,
          "criterion": "The generated FC heatmap shows clear block-diagonal structure aligned with the three major anatomical divisions (telencephalon / mesencephalon / rhombencephalon), matching gt — i.e., regions within the same anatomical division have visibly stronger correlations than regions across divisions.",
          "deduction_rule": "Deduct 25 if no block structure is visible. Deduct 12 if blocks are present but do not align with anatomical divisions. Deduct 8 if only one of the three blocks is identifiable."
        },
        {
          "type": "visual", "point": 20,
          "criterion": "Hindbrain (rhombencephalon, posterior) block shows the strongest within-group correlations — the posterior diagonal block is visibly the most intense compared to telencephalic and mesencephalic blocks.",
          "deduction_rule": "Deduct 20 if the strongest block is in the wrong anatomical region (e.g., forebrain shown strongest). Deduct 10 if all three blocks appear roughly equal in intensity, losing the anterior-posterior gradient."
        },
        {
          "type": "visual", "point": 15,
          "criterion": "Within-block correlations are visibly stronger than cross-block correlations across the matrix, producing a clear modular appearance consistent with anatomically organized functional connectivity.",
          "deduction_rule": "Deduct 15 if intra-block vs inter-block contrast is absent or inverted. Deduct 8 if contrast is weak / patchy rather than a clear block pattern."
        }
      ]
    }
  }
}
```

---

## Fig_2B — SC 网络叠加

```json
{
  "tag": "Fig_2B",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Mesoscopic structural connectivity network of larval zebrafish overlaid on brain anatomy, with weighted interregional edges representing anatomical connection strength, showing bilaterally symmetric organization with denser connectivity in posterior brain.",
      "scoring_items": [
        {
          "type": "text", "point": 20,
          "criterion": "Correctly identifies the visualization as a structural / anatomical connectivity (SC) network where edges represent weighted interregional connection strength, distinct from functional connectivity.",
          "deduction_rule": "Deduct 20 if confused with FC. Deduct 10 if connectivity is mentioned without distinguishing structural from functional."
        },
        {
          "type": "text", "point": 10,
          "criterion": "States that the bilateral SC matrix is constructed by extending the unilateral SC to both hemispheres, and that excluded (single-hemisphere) regions are removed before visualization.",
          "deduction_rule": "Deduct 10 if neither bilateralization nor exclusion handling is conveyed. Deduct 5 for missing one."
        },
        {
          "type": "text", "point": 10,
          "criterion": "Conveys that edges are weighted (varying connection strengths) rather than binary on/off connections.",
          "deduction_rule": "Deduct 10 if connections are described as binary. Deduct 5 if weighting is implied but not explicit."
        },
        {
          "type": "visual", "point": 25,
          "criterion": "Top view shows clear left-right bilateral symmetry across the midline — both hemispheres are populated and the network pattern mirrors across the sagittal axis, consistent with the bilateralized SC matrix.",
          "deduction_rule": "Deduct 25 if only one hemisphere is connected. Deduct 15 if symmetry is broken (one side noticeably denser than the other). Deduct 10 if midline-crossing edges are entirely absent."
        },
        {
          "type": "visual", "point": 20,
          "criterion": "Connection density is visibly higher in posterior / mid-brain regions and sparser in the most anterior forebrain, matching the gt spatial gradient of structural connectivity.",
          "deduction_rule": "Deduct 20 if density distribution is uniform or inverted (anterior denser than posterior). Deduct 10 if the gradient is weak."
        },
        {
          "type": "visual", "point": 15,
          "criterion": "Edges show heterogeneous strength — strong (visually prominent) edges and weak (visually faint) edges coexist, reflecting the weighted nature of the SC network rather than a uniform-edge graph.",
          "deduction_rule": "Deduct 15 if all edges appear at uniform intensity. Deduct 8 if only 2-3 discrete strength levels are visible (loss of continuous weighting)."
        }
      ]
    }
  }
}
```

---

## Fig_3A — 共指派矩阵 + 4 模块

```json
{
  "tag": "Fig_3A",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Hierarchically clustered structural-module coassignment probability matrix shows that zebrafish brain regions group consistently into structural modules across iterative modularity partitions, revealing hierarchical modular organization in the structural connectome.",
      "scoring_items": [
        {
          "type": "text", "point": 20,
          "criterion": "Correctly identifies the matrix entries as the probability / frequency that pairs of regions are assigned to the same module across many iterative Louvain modularity runs (i.e., a consensus / coassignment matrix), not raw connectivity values.",
          "deduction_rule": "Deduct 20 if matrix is described as raw SC or FC. Deduct 10 if 'modules' are mentioned without explaining the consensus / coassignment meaning."
        },
        {
          "type": "text", "point": 15,
          "criterion": "States that the analysis reveals modular / community organization of the STRUCTURAL connectome, with regions preferentially clustered into modules.",
          "deduction_rule": "Deduct 15 if modular organization conclusion is missing. Deduct 8 if structural vs functional source is confused."
        },
        {
          "type": "text", "point": 10,
          "criterion": "Mentions that hierarchical clustering (Ward's linkage or equivalent) was applied to the coassignment matrix to organize modules, exposing nested hierarchical structure.",
          "deduction_rule": "Deduct 10 if hierarchical clustering is omitted. Deduct 5 if clustering is mentioned but not connected to hierarchical / nested module structure."
        },
        {
          "type": "visual", "point": 25,
          "criterion": "Generated matrix shows visible block-diagonal structure: within-module diagonal blocks have substantially higher coassignment probability (lighter cells in grayscale, or higher-value cells) than off-diagonal cross-module regions, producing a clear modular appearance.",
          "deduction_rule": "Deduct 25 if no block-diagonal structure is visible. Deduct 12 if contrast is reversed (off-diagonal higher than diagonal)."
        },
        {
          "type": "visual", "point": 20,
          "criterion": "Four modules along the diagonal are clearly distinguishable with visibly UNEQUAL sizes — one module spans a substantially larger fraction of the regions than the others, matching the gt where the first module covers roughly the largest portion of the matrix and the other three are smaller.",
          "deduction_rule": "Deduct 20 if number of distinguishable modules ≠ 4. Deduct 12 if all four modules appear roughly equal in size (loss of size hierarchy that reflects the underlying network structure). Deduct 8 if module boundaries do not align with the diagonal."
        },
        {
          "type": "visual", "point": 10,
          "criterion": "Dendrogram structure exposes nested / hierarchical relationships among modules — at least one pair of modules is visibly more closely related (joined at a lower level) than the rest, rather than all modules joining at a single flat level.",
          "deduction_rule": "Deduct 10 if dendrogram is absent. Deduct 5 if dendrogram is shown but flat (no hierarchy visible)."
        }
      ]
    }
  }
}
```

---

## Fig_5F — 四类细胞空间密度

> **前提**：question 与 figure 已修复一致（即 question 描述的是跨多条鱼的 consensus 空间密度图任务，而不是单鱼 calcium activity 时序）。

```json
{
  "tag": "Fig_5F",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Consensus spatial density maps of four sensorimotor neuronal populations (motor-positive, motor-negative, dark-responsive, light-responsive) across larvae show that these populations span much of the larval brain but occupy largely distinct spatial territories, with a striking left-habenular lateralization of the light-responsive population.",
      "scoring_items": [
        {
          "type": "text", "point": 15,
          "criterion": "Identifies four functionally defined cell populations defined by correlations with motor and visual variables: motor-positive, motor-negative, dark-responsive, light-responsive.",
          "deduction_rule": "Deduct 15 if the four populations are not enumerated. Deduct 8 if only motor or only visual populations are described. Deduct 5 if the +/- motor distinction is missed."
        },
        {
          "type": "text", "point": 10,
          "criterion": "States that the maps reflect consensus / group-level spatial distributions across multiple larvae (not a single-fish snapshot).",
          "deduction_rule": "Deduct 10 if presented as a single-fish result. Deduct 5 if group context is unclear."
        },
        {
          "type": "text", "point": 5,
          "criterion": "Conveys the overall scientific takeaway: these populations together cover most of the brain but are largely spatially distinct (non-overlapping).",
          "deduction_rule": "Deduct 5 if the answer implies extensive overlap or restricts coverage to a single region."
        },
        {
          "type": "visual", "point": 15,
          "criterion": "Motor-positive density is visibly distributed across the hindbrain (posterior brain), forming a broad posterior-dominant pattern.",
          "deduction_rule": "Deduct 15 if motor-positive is shown anterior-dominant. Deduct 8 if shown as a single small cluster instead of broad distribution."
        },
        {
          "type": "visual", "point": 10,
          "criterion": "Motor-negative distribution is visibly more restricted / clustered than motor-positive — fewer and smaller hotspots, not a broad distribution.",
          "deduction_rule": "Deduct 10 if motor-negative is identical or broader than motor-positive. Deduct 5 if it appears equally broad without local concentration."
        },
        {
          "type": "visual", "point": 15,
          "criterion": "Dark-responsive density is concentrated in anterior-to-middle visual-related regions (optic tectum / cerebellum / forebrain area), visibly anterior-dominant relative to motor populations.",
          "deduction_rule": "Deduct 15 if dark-responsive is shown in posterior hindbrain (visually opposite to gt). Deduct 8 if anterior coverage is sparse."
        },
        {
          "type": "visual", "point": 25,
          "criterion": "Light-responsive density shows clear LEFT-RIGHT ASYMMETRY in the top view, with the densest region located in the LEFT habenula. This lateralization is the key scientific finding of the panel.",
          "deduction_rule": "Deduct 25 if distribution is bilateral or symmetric. Deduct 20 if asymmetry is reversed (right-side enriched). Deduct 12 if light-responsive is broadly spread without a single focal hotspot."
        },
        {
          "type": "visual", "point": 5,
          "criterion": "Relative population abundance follows the rank order: dark-responsive > motor-positive >> motor-negative ≈ light-responsive (visible from total cell counts or from the relative density saturation across panels).",
          "deduction_rule": "Deduct 5 if rank order is wrong. No deduction if rank is preserved but absolute counts deviate."
        }
      ]
    }
  }
}
```

---

## 修订要点汇总

1. **新增 `type` 字段**：每个 scoring item 标记 `"text"` 或 `"visual"`，方便评测时分流处理。
2. **删除非科学评分点**：colormap、坐标、scale bar、panel 标题、annotation 文字、布局朝向等不进 rubric。
3. **强化关键科学 pattern**：
   - Fig_1E：anatomical block-diagonal、hindbrain 最强相关、anterior-posterior 梯度
   - Fig_2B：bilateral 对称性、posterior dense / anterior sparse、edge 加权异质性
   - Fig_3A：block-diagonal 对比、4 模块尺寸不等（hierarchy of sizes）、dendrogram nested 结构
   - Fig_5F：四类分布的脑区差异、light-responsive **左侧 habenula 侧化**（核心科学发现）、相对丰度 rank
4. **削弱知识检索型评分点**：例如 Fig_2B 原 rubric 要求模型说出"single-neuron reconstructions"作为 SC 来源（25 分），由于此信息不在 question 上下文中，已替换为 task-grounded 的"weighted edges"和"bilateralization"项。
5. **Fig_5F 前置条件**：上述 rubric 设计基于 question 已被修复为与 figure 一致的"跨鱼 consensus 空间密度"任务；如 question 仍保持原貌（单鱼时序可视化），则需要先修 question 或换 gt_figure，再用此 rubric。
