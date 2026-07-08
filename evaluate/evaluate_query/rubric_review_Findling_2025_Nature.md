# Findling_Pouget_2025_Nature Rubric 评估报告

对 `Findling_Pouget_2025_Nature` 五个 panel 的 rubric 与 question / gt_data / gt_figure 之间一致性的分析。

## 总体判断

整体而言，rubric **质量较高且贴合 figure 内容**。每条 rubric 都准确捕捉了对应 panel 的核心科学结论、关键统计量与解释要点。**值得注意的是，rubric 作者已主动识别并修正了 gt_data 中存在的几处错误**（详见下文）。

## 逐图分析

### Fig_2A — ✅ 合适，且 rubric 帮 gt_data 修正了错误

- **Figure**：在 ORBvl 中 ITI 期间用神经活动解码贝叶斯最优先验，corrected R²=0.28，P=0.001，r=0.66。
- **不一致点（在 gt_data 内）**：`analyse_plan.Steps` 描述的是 block-switch reversal-curve 拟合（应该是其他 panel 的内容），与 question/conclusion 完全不匹配。
- **rubric 处理**：rubric 在 `reason` 中明确指出 "the block-switch reversal-curve steps in the analyse_plan are not appropriate for Fig. 2A, they should not be treated as core scoring requirements"，并在 Acceptable deviations 中允许忽略这些步骤。**判断合适**。

### Fig_3A — ✅ 合适

- **Figure**：SCm 中 prior>0.7 / prior<0.3 两组 trial 在 signed contrast 上的 decoded right-stimulus 神经计量曲线。
- rubric 准确强调 post-stimulus 时窗、SCm、低/高 Bayes-optimal prior 分组、零对比度处的 vertical shift，以及解码对象是 stimulus side（避免与 Fig 2 的 prior decoding 混淆）。
- 唯一可挑剔的是 100 ms 时窗在 rubric 中被概括为 "short post-stimulus window"，但这在 Acceptable deviations 中是允许的。

### Fig_3C — ✅ 合适

- **Figure**：scatter plot，Ephys-corrected vs WFI-corrected post-stimulus shift，R=0.51, P=0.0027, n=32 regions。
- rubric 完整覆盖了跨模态比较、跨 32 个皮层区域的正相关、定量结果，并明确提醒 "neurometric shift" 不要与 Fig 2 的 prior decoding R² 混淆。**完全对应**。

### Fig_4A — ✅ 合适

- **Figure**：bar plot 展示 Bayes opt / stim kernel / act kernel 三种模型的 model frequency（act kernel 接近 1），inset 是 exceedance probability。
- rubric 正确将 act-kernel 列为 winning model，包含三个候选模型、Bayesian model comparison 框架、107 只小鼠的样本规模，并强调 action-kernel 的计算/生物学解释（基于近期动作历史的指数加权）。**对应良好**。

### Fig_4F — ✅ 合适，且 rubric 修正了 gt_data 中的数值互换

- **Figure**：左 Ephys 子图 R=0.23, P=0.0037；右 WFI 子图 R=0.49, P=0.0006。
- **不一致点（在 gt_data 内）**：`summary_report.results` 写成 "electrophysiology (R = 0.49, P = 0.0006) and in widefield imaging (R = 0.23, P = 0.0037)"，**Ephys 与 WFI 的统计量被互换**（不过同文件 `key_analysis_results` 与 `statistical_info` 与 figure 一致）。
- **rubric 处理**：rubric 中 Ephys R=0.23、WFI R=0.49 与 figure 完全一致；并在 Acceptable deviations 中加入了 "Swapping the exact R and P values between Ephys and WFI should receive a small-to-moderate deduction"，处理稳健。**判断合适**。

## 结论

5 个 panel 的 rubric **整体设计合理，与 gt_figure 的视觉内容、question 的研究目标、key_analysis_conclusions 都形成了正确对应**。亮点在于 rubric 作者并非机械照搬 gt_data，而是审校了内容并显式纠偏（Fig_2A 的错误 analyse_plan、Fig_4F 的数值互换）。

## 建议同步修复 gt_data 中的错误

为避免后续模型在评测之外（如 retrieval / few-shot 用法）误用，建议修复：

1. `query_gt_data/Findling_2025_Nature/Fig_2A.json` 的 `analyse_plan.Steps` 实际描述的是 reversal-curve 分析（属于其他 panel）。
2. `query_gt_data/Findling_2025_Nature/Fig_4F.json` 的 `summary_report.results` 中 Ephys 与 WFI 的 R / P 值互换。
