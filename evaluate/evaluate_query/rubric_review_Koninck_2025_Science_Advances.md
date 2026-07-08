# Koninck_2025_Science_Advances Rubric 评估报告

对 `Koninck_2025_Science_Advances` 四个 panel 的 rubric 与 question / gt_data / gt_figure 之间一致性的分析。

## 总体判断

整体 rubric 设计**质量较高**，准确捕捉了 figure 的科学含义。但与 Findling 项目相比，存在两类系统性问题：

1. **question 是"操作型/数据分析任务"，rubric 是"figure 解读型评分"**。Koninck 的 question 多是 "use file X.npy, do Y, save Z" 形式的任务指令，而 rubric 评的是模型对 figure 科学含义的描述能力。这种不对齐在 rubric 要求"模型应提及论文背景知识"时尤其明显。
2. **存在一例 question 与 figure 严重不对应（Fig_5F）**，导致 rubric 不可能被一个正确执行 question 的模型所满足。

此外，gt_data 文件结构比 Findling 简化得多（只有 `image_ids`、`query`、`key_analysis_conclusions`），缺少 `statistical_info` 和 `analyse_plan`，这本身不一定是问题，但减少了 rubric 设计的参考信息。

## 逐图分析

### Fig_1E — ✅ 基本合适

- **Figure**：22 条斑马鱼幼体的群体平均 FC 矩阵（65×65 脑区，对角线区分前/中/后脑）。
- **Question**：要求计算每条鱼的 FC、做平均、排除 excluded_regions、保存矩阵。
- **rubric**：评分点覆盖 group-averaged FC、pairwise correlation、spontaneous activity、65 regions、22 larvae。
- **判断**：question 与 figure 对应，rubric 评分点可以从最终输出图中合理推断。**唯一小瑕疵**：rubric 给"spontaneous activity"分配了 15 分，而 question 已经明确说 "Use the spontaneous period (only the first 600 time points)"，所以这部分本就是任务前提而非模型自行判断的结论；如果模型只是执行任务而不重述 spontaneous 上下文，可能被扣分。建议把这条改成可被任务前提自动满足的项。

### Fig_2B — ⚠️ 部分项要求模型具备 question 之外的论文知识

- **Figure**：SC 网络叠加在斑马鱼脑解剖图上（顶视图 + 侧视图，加权边）。
- **Question**：明确给出 SC 矩阵文件 `SC_matrix_undirected_terminals_expanded.npy`，让模型双侧化、排除半脑区域、可视化。**没有提及 single-neuron reconstructions**。
- **rubric 问题**：
  - 25 分要求模型陈述 "structural connectivity was derived from single-neuron reconstructions or neuronal morphology data"。这是论文中 SC 矩阵的来源，但 question 给出的输入只是一个 .npy 矩阵，模型无从知晓其来源（除非有先验论文知识）。
  - 10 分要求"weaker edges partly omitted for visualization"，但 question 也没说要过滤弱边，模型按 question 执行时不会做这件事。
- **判断**：rubric 把"figure 视觉特征"当作"分析结论"评分，但有些视觉特征是论文级别的描述，而非任务输出能直接产出的。**建议修订**：把这两条改为 acceptable but not required，或仅在 model 主动提及时给奖励分。

### Fig_3A — ✅ 合适

- **Figure**：SC 共指派概率矩阵 + 左侧 dendrogram + 4 个彩色 module 框（紫/青/黄/红）。
- **Question**：明确要求 iterative Louvain → 共指派矩阵 → Ward's hierarchical clustering → 4 modules + dendrogram。
- **rubric**：评分点（coassignment matrix、coassignment probability meaning、modular organization、hierarchical clustering、four modules）与 question 步骤一一对应，且与 figure 视觉一致。
- **判断**：question / figure / rubric 三方对齐良好。**最佳示例**。

### Fig_5F — ❌ Question 与 Figure 严重不对应

- **Figure**：四张 consensus 空间密度图（**跨 18 条鱼幼体**），分别为 motor-positive / motor-negative / dark / light，每张图给 Top + Side 两个投影 + 总细胞数（37,207 / 4204 / 57,423 / 4700）。
- **Question**：
  > "I aim to visualize the calcium activities of those identified individual neurons that were correlated with swimming and visual responses **in a given fish larva**. Use the following files in **the 8th fish's folder**: dff.npy, swim_events.npy, correlations_motor.npy, correlations_dark.npy, correlations_light.npy. Describe the activity features of different functional neuronal types in the report."
  - question 要求**单条鱼（第8条）**的**钙活动时间序列**（dff.npy + swim_events 是时序数据），重点是 "activity features"。
- **rubric**：评分基于跨 18 条鱼的空间密度图，要求识别四类细胞、各自的脑区分布（motor-positive 在 hindbrain，dark 在 anterior visual regions，light 富集在左 habenula 等）。
- **关键不一致**：
  - question 要求时间序列可视化（calcium activity over time），figure 是空间密度热图。
  - question 限定单条鱼（第8条），figure 是 18 条鱼的 consensus map。
  - 模型若严格按 question 执行，输出的将是 dff trace 图（类似 raster/line plot），完全无法满足 rubric 中关于空间分布的所有评分点。
- **判断**：**rubric 本身是对 figure 准确的描述，但 question 与 figure 错配**。需要修复的是 question（或更换 figure）：
  - 可能 question 文本是从 Fig_5C/D/E（单鱼 trace 图）误粘贴过来的；
  - 或 gt_figure 应该是另一张包含 dff trace 的 panel。
- **建议**：把 question 改写为类似 "visualize the consensus spatial density of motor-positive/motor-negative/dark-responsive/light-responsive neurons across all 18 larvae using their per-fish correlation files; project onto top and side views."

## 总结表

| Panel | Question ↔ Figure 对应 | Rubric ↔ Figure 对应 | Rubric ↔ Question 对应 | 总体 |
|-------|----------------------|--------------------|------------------------|------|
| Fig_1E | ✅ | ✅ | ✅（小瑕疵） | 合适 |
| Fig_2B | ✅ | ✅ | ⚠️ rubric 要求论文级背景知识 | 部分合适 |
| Fig_3A | ✅ | ✅ | ✅ | 合适（最佳示例）|
| Fig_5F | ❌ Question 与 Figure 错配 | ✅ | ❌ | **不合适** |

## 建议修复

### 高优先级
- **`evaluate_query/query_questions/Koninck_2025_Science_Advances/Fig_5F.md`**：Question 与 figure 完全不匹配。需要重写 question 为"跨 18 条鱼的 consensus 空间密度图"任务，或更换 gt_figure。

### 中优先级
- **`evaluate_query/rubric/Koninck_2025_Science_Advances/Fig_2B.json`**：把"single-neuron reconstructions"和"weakest quartile omitted"改为奖励项而非必答项，或在 question 中显式提供这些上下文。

### 低优先级
- **`evaluate_query/rubric/Koninck_2025_Science_Advances/Fig_1E.json`**：spontaneous activity 评分点权重可降低，因为 question 已直接告知模型用 spontaneous period。

## 通用观察

Koninck 与 Findling 的评测哲学不同：
- **Findling**：question 是科学目标陈述（"To demonstrate ..."），评的是模型能否完成科学论证，rubric 围绕统计结论与解释。
- **Koninck**：question 是数据分析操作指令（"use file X, do Y"），但 rubric 仍按 Findling 风格评 figure 解读。

如果 Koninck 评测的目标是模型的"数据分析执行能力"，rubric 中应该增加**对最终图像与 ground truth 视觉一致性**的检查项（例如：是否产出了正确格式的矩阵 / 网络图 / 密度图），而不仅是检查模型能否用文字描述论文结论。如果目标确实是评"figure 解读"，则 question 应该改写为更偏解读型（e.g. "Describe the figure shown when running this pipeline on data X..."）。
