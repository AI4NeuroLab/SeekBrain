# Findling_Pouget_2025_Nature Rubric 修订版

按 [`rubric_writing_SOP.md`](./rubric_writing_SOP.md) 三层金字塔（L1/L2/L3 文本 + L1/L2 视觉）重做。每个 panel 给出新版 JSON 与"Changes vs original"。

原始文件位于：`evaluate/evaluate_query/rubric/Findling_Pouget_2025_Nature/Fig_*.json`

---

## Fig_2A — ORBvl 解码 ITI 期间的 Bayes-optimal prior

### 修订后 rubric

```json
{
  "tag": "Fig_2A",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "ORBvl population activity during the inter-trial interval encodes the Bayes-optimal prior probability of stimulus location. The decoded prior tracks both the Bayes-optimal prior and step-like true block transitions, with significant cross-validated decoding (R² ≈ 0.28, P = 0.001, r = 0.66 in the example session). This indicates that frontal cortex maintains an internal belief about the latent block context during pre-stimulus periods.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 10,
          "criterion": "Identifies the analysis as cross-validated linear decoding of the Bayes-optimal prior from ORBvl population activity during the inter-trial interval (ITI, ~-600 to -100 ms before stimulus onset).",
          "deduction_rule": "Deduct 10 if the brain region, decoded variable, or time window is wrong. Deduct 5 if the timing is described only as 'before stimulus' without anchoring it to the ITI."
        },
        {
          "type": "text", "layer": "L2", "point": 15,
          "criterion": "Interprets the decoded prior trace as tracking the Bayes-optimal prior across trials and reflecting step-like changes at block transitions, supported by statistically significant cross-validated decoding (R² ≈ 0.28, P ≈ 0.001, Pearson r ≈ 0.66, against a pseudosession null).",
          "deduction_rule": "Deduct 15 if the tracking relationship is missing. Deduct 8 if statistics are absent. Deduct 5 if step-like block-transition tracking is missing but smooth correlation is preserved."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Infers that ORBvl maintains a persistent internal belief about the latent block context during the pre-stimulus period — frontal cortex represents context as a top-down latent variable independent of immediate sensory input. (functional / mechanistic)",
          "deduction_rule": "Deduct 15 if no functional interpretation is offered. Deduct 8 if interpretation is generic ('the brain knows the context') without anchoring to pre-stimulus / top-down maintenance."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Connects the finding to the broader principle that the brain implements Bayesian inference by encoding the prior as an explicit, decodable population-level variable, not merely as a behavioral choice bias. (computational / theoretical)",
          "deduction_rule": "Deduct 15 if no broader-principle linkage is offered. Deduct 8 if linkage is named without explaining why an explicit neural representation is novel beyond a behavioral effect."
        },
        {
          "type": "visual", "layer": "L1", "point": 15,
          "criterion": "The generated time-series shows three traces (decoded prior, Bayes-optimal prior reference, and true block prior reference) that visibly co-vary across trials, with the decoded prior trace following the Bayes-optimal prior trace.",
          "deduction_rule": "Deduct 15 if the decoded prior trace is missing or flat. Deduct 8 if the Bayes-optimal prior reference is absent. Deduct 5 if traces are present but completely independent."
        },
        {
          "type": "visual", "layer": "L2", "point": 20,
          "criterion": "The decoded prior tracks the Bayes-optimal prior in the correct direction (positive co-variation, not anticorrelated) and visibly captures step-like transitions when the true block prior switches between high and low.",
          "deduction_rule": "Deduct 20 if direction is inverted (decoded prior moves opposite to Bayes-optimal). Deduct 12 if smooth tracking is preserved but block-step transitions are entirely smoothed away. Deduct 8 if tracking is partial / chance-level rather than clearly aligned."
        },
        {
          "type": "visual", "layer": "L2", "point": 10,
          "criterion": "The decoded prior amplitude variation (range of values reached) is comparable to the Bayes-optimal prior reference, not collapsed near a single mean value.",
          "deduction_rule": "Deduct 10 if decoded prior is essentially constant. Deduct 5 if its range is much smaller than the reference (e.g., < 30% of reference range)."
        }
      ],
      "Scoring instructions": "Stage 1: score text items against model's textual conclusion. Stage 2: score visual items by side-by-side comparison of model-generated figure with gt figure, evaluating only scientifically meaningful patterns. Sum to 100."
    }
  }
}
```

### Changes vs original

- **L1 占比从 ~65% 降至 10%**：原版有"brain region (20)"、"decoded variable (30)"、"time window (15)" 共 65 分都是任务事实复述，新版合并为单条 10 分 L1。
- **新增 L3 functional 项 (15 分)**：要求 inference 关于 ORBvl 的 belief maintenance 机制。
- **新增 L3 principle 项 (15 分)**：要求把 prior decoding 与 Bayesian inference 计算原理连接起来。
- **新增视觉项 (45 分)**：原版只有"decoded prior tracks Bayes-optimal prior"在文字层面，新版要求评测模型实际比较生成图与 gt 图的 (a) 三条 trace 共变；(b) 方向正确 + step transitions；(c) 振幅范围匹配。
- **删除**：原版"reports R² = 0.35, P = 0.001, r = 0.66 (10 pt)"等纯数字复述项 → 整合到 L2 的 supporting evidence。

---

## Fig_3A — SCm 后刺激期 prior-grouped neurometric curves

### 修订后 rubric

```json
{
  "tag": "Fig_3A",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Post-stimulus neural activity in SCm encodes the current stimulus side, but its decoded output is biased by Bayes-optimal prior: high-prior and low-prior trial groups produce vertically separated neurometric curves at zero contrast. This shows that prior information is integrated with sensory evidence even in motor-related areas, consistent with top-down prior modulation of perceptual decoding throughout the decision pathway.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 10,
          "criterion": "Identifies the analysis as decoding of the current stimulus side / signed contrast from post-stimulus neural activity in SCm (superior colliculus motor-related layer), with trials split into low (Bayes-optimal prior < 0.3) and high (> 0.7) prior groups.",
          "deduction_rule": "Deduct 10 if brain region, decoded variable, or post-stimulus context is wrong. Deduct 5 if the prior grouping is omitted."
        },
        {
          "type": "text", "layer": "L2", "point": 20,
          "criterion": "Interprets the vertical separation of the high-prior and low-prior neurometric curves at or near zero contrast as a prior-dependent shift in the neural readout of the stimulus — the high-prior condition yields a higher decoded-right output and the low-prior condition a lower output for ambiguous stimuli.",
          "deduction_rule": "Deduct 20 if zero-contrast separation is not described. Deduct 12 if separation is mentioned but not tied to the high-prior-yields-higher-decoded-right direction. Deduct 8 if the separation is misattributed to mid- or extreme-contrast regions."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Infers that prior information is integrated with incoming sensory evidence even in motor-related circuits, indicating that top-down prior modulation propagates beyond pure sensory areas into motor/decision regions. (functional / mechanism)",
          "deduction_rule": "Deduct 15 if no functional interpretation is given. Deduct 8 if interpretation is generic ('prior matters') without specifying that motor regions show this effect."
        },
        {
          "type": "text", "layer": "L3", "point": 10,
          "criterion": "Connects the finding to the broader principle that perceptual decisions reflect a Bayesian combination of prior and likelihood, with the prior shifting the neural decision boundary at points of sensory ambiguity. (computational)",
          "deduction_rule": "Deduct 10 if computational framing is missing. Deduct 5 if Bayesian combination is named without linking the shift specifically to ambiguous (zero-contrast) trials."
        },
        {
          "type": "visual", "layer": "L1", "point": 15,
          "criterion": "The generated figure shows two distinct neurometric curves (one per prior group) plotting decoded-right output as a function of signed contrast, with both curves following sigmoid-like shapes increasing from low contrast to high contrast.",
          "deduction_rule": "Deduct 15 if only one curve is shown. Deduct 8 if curves are not sigmoid-like / monotonic. Deduct 5 if curves are present but not labeled by prior group."
        },
        {
          "type": "visual", "layer": "L2", "point": 20,
          "criterion": "The two curves are visibly vertically separated at zero contrast, with the HIGH-prior curve consistently above the LOW-prior curve across the contrast range (i.e., the prior shift is in the correct direction).",
          "deduction_rule": "Deduct 20 if curves overlap with no separation. Deduct 15 if separation direction is reversed (high-prior below low-prior). Deduct 8 if curves cross instead of staying ordered."
        },
        {
          "type": "visual", "layer": "L2", "point": 10,
          "criterion": "The vertical shift between curves is most pronounced near zero contrast (ambiguous stimuli) and converges at extreme contrasts (-1 / +1), reflecting the expected diminishing prior influence under strong sensory evidence.",
          "deduction_rule": "Deduct 10 if shift is uniform across contrasts (no convergence at extremes). Deduct 5 if shift is largest at extremes instead of zero contrast."
        }
      ],
      "Scoring instructions": "Stage 1: text items. Stage 2: visual items via side-by-side comparison."
    }
  }
}
```

### Changes vs original

- **新增 L3 functional + computational 项 (25 分)**：原版只有 10 分的"interpretive" 项 ("prior-dependent modulation of post-stimulus neural responses")，新版分两条 L3 测 (a) 信号传播到运动区的功能含义，(b) Bayesian combination 计算原理。
- **L1 比例降为 10%**：原版"low/high prior comparison (20 pt)"、"SCm region (10 pt)"、"post-stimulus (15 pt)"是任务事实，新版合并为 10 分。
- **新增 L2 visual 关于"shift convergence at extremes" (10 分)**：原版没有捕捉这个科学相关的细节（强证据下 prior 影响减弱，是 Bayesian 关键预测）。
- **保留并强化方向性 visual L2 (20 分)**：高 prior 在上、低 prior 在下，方向反 → 直接科学结论错。

---

## Fig_3C — Ephys vs WFI post-stimulus shift 跨模态相关

### 修订后 rubric

```json
{
  "tag": "Fig_3C",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Corrected post-stimulus neurometric shifts measured by electrophysiology and widefield imaging are positively correlated across matched cortical regions (Spearman R = 0.51, P = 0.0027, n = 32 regions), demonstrating that prior-dependent biases in stimulus decoding are spatially consistent across recording modalities and therefore reflect a real biological signal rather than a methodological artifact.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 10,
          "criterion": "Identifies the analysis as a regional-level comparison of corrected post-stimulus neurometric shifts between Ephys and WFI across matched cortical regions.",
          "deduction_rule": "Deduct 10 if the cross-modality regional comparison is misidentified (e.g., as trial-level, neuron-level, or animal-level)."
        },
        {
          "type": "text", "layer": "L2", "point": 20,
          "criterion": "Interprets the positive Spearman correlation (R ≈ 0.51, P ≈ 0.003, n ≈ 32 regions) as evidence that the spatial distribution of prior-dependent post-stimulus biases is preserved across the two recording modalities.",
          "deduction_rule": "Deduct 20 if the positive correlation interpretation is missing. Deduct 10 if statistics are absent. Deduct 8 if correlation is named but not framed as cross-modality consistency."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Infers that the prior-dependent shifts reflect a real biological signal rather than a methodological artifact of one modality — i.e., independent measurement techniques converge on the same regional landscape of prior-related modulation. (methodological / theoretical)",
          "deduction_rule": "Deduct 15 if biological-signal vs methodological-artifact framing is missing. Deduct 8 if convergence is mentioned without explicitly contrasting it with the alternative that one modality might bias results."
        },
        {
          "type": "text", "layer": "L3", "point": 10,
          "criterion": "Connects this cross-modality consistency to the broader principle that brain-wide functional findings should be replicable across measurement scales (single units vs mesoscopic fluorescence) before being treated as robust. (principle)",
          "deduction_rule": "Deduct 10 if principle linkage is absent. Deduct 5 if linked but vaguely ('different methods agree')."
        },
        {
          "type": "visual", "layer": "L1", "point": 15,
          "criterion": "The generated scatter plot shows ~32 data points (one per matched cortical region), with x-axis Ephys-corrected shift and y-axis WFI-corrected shift, with both axes spanning a comparable range to gt.",
          "deduction_rule": "Deduct 15 if data point count differs by > ~10 from gt. Deduct 8 if axes are swapped. Deduct 5 if the scatter is collapsed to a degenerate line."
        },
        {
          "type": "visual", "layer": "L2", "point": 20,
          "criterion": "The scatter shows a clear positive trend — points cluster along an upward-sloping pattern, and a fitted regression line (if shown) has positive slope. Negative or flat trends fail this item.",
          "deduction_rule": "Deduct 20 if the trend is flat or negative. Deduct 12 if trend is weak / barely visible (would correspond to a near-zero correlation rather than R ≈ 0.5). Deduct 8 if direction is correct but most points lie far from the fitted line."
        },
        {
          "type": "visual", "layer": "L2", "point": 10,
          "criterion": "Both Ephys and WFI shift values are mostly positive (clustered in the positive quadrant of the scatter), reflecting that most cortical regions show post-stimulus prior-dependent modulation rather than null effects.",
          "deduction_rule": "Deduct 10 if points are clustered around zero / negative. Deduct 5 if substantial outliers extend deep into negative territory inconsistent with gt."
        }
      ],
      "Scoring instructions": "Stage 1: text items. Stage 2: visual items via side-by-side comparison."
    }
  }
}
```

### Changes vs original

- **新增 L3 methodological 项 (15 分)**：原版只在 "preserves the interpretation that the positive Ephys-WFI correlation supports a consistent spatial distribution" (10 分)中含蓄涉及，新版显式要求把"跨模态一致性"框为对"方法学伪影 vs 真生物信号"的判别。
- **新增 L3 principle 项 (10 分)**：把跨模态一致性与"脑区域级别发现应跨尺度可重复"的科学方法论原理联系起来。
- **新增 visual L2"两 modality 都为正"(10 分)**：原版未涵盖；这是验证大部分皮层区域确实有 prior 调制（而非零附近聚集）的关键 sanity check。
- **L1 文字描述项从 30+15+15 = 60 分降至 10 分**：避免奖励"复述题目"。

---

## Fig_4A — Bayesian model comparison（action-kernel 胜出）

### 修订后 rubric

```json
{
  "tag": "Fig_4A",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Bayesian model comparison across 107 mice shows that the action-kernel model — which estimates the prior by exponentially integrating recent past actions / choices — explains mouse choice behavior far better than the Bayes-optimal prior model or the stimulus-kernel model, with model frequency and exceedance probability close to 1. This indicates that mice approximate the prior using an action-history-based heuristic rather than performing strict Bayesian inference over stimulus history.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 10,
          "criterion": "Identifies the analysis as Bayesian model comparison among three candidate prior models (Bayes-optimal prior, stimulus kernel, action kernel) using model frequency and/or exceedance probability across ≥ ~100 mice.",
          "deduction_rule": "Deduct 10 if any of the three candidate models is missing or substituted. Deduct 5 if the comparison framework (BMC / model frequency / exceedance) is missing."
        },
        {
          "type": "text", "layer": "L2", "point": 15,
          "criterion": "Interprets the result as the action-kernel model winning with model frequency and exceedance probability near 1, while the Bayes-optimal and stimulus-kernel models show near-zero support.",
          "deduction_rule": "Deduct 15 if the wrong model is named as winner. Deduct 8 if the dominance of action-kernel is reported without contrasting against the other two models. Deduct 5 if exceedance / frequency framing is missing."
        },
        {
          "type": "text", "layer": "L3", "point": 20,
          "criterion": "Infers that mice approximate the prior using an action-history-based heuristic (exponentially weighted recent actions / choices) rather than performing strict Bayes-optimal inference over stimulus history — a substantial deviation from normative Bayesian behavior. (computational / mechanism)",
          "deduction_rule": "Deduct 20 if the heuristic vs Bayes-optimal contrast is missing. Deduct 10 if exponential weighting / recent-action integration is omitted. Deduct 15 if the answer claims mice behave as Bayes-optimal observers."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Connects the finding to the broader principle that biological agents often replace optimal inference with simpler recursive update rules that are biologically tractable, with action history (rather than stimulus history) being the natural substrate. (principle / theoretical)",
          "deduction_rule": "Deduct 15 if no broader-principle linkage is offered. Deduct 8 if linkage is named but not contrasted with stimulus-history-based heuristics."
        },
        {
          "type": "visual", "layer": "L1", "point": 15,
          "criterion": "The generated figure shows a bar plot with three bars labeled (or ordered as) Bayes-optimal, stimulus kernel, and action kernel, plus an inset / panel showing exceedance probability for the same three models.",
          "deduction_rule": "Deduct 15 if any of the three bars is missing or model count is wrong. Deduct 8 if exceedance probability is not displayed. Deduct 5 if labels are missing or unreadable."
        },
        {
          "type": "visual", "layer": "L2", "point": 20,
          "criterion": "The action-kernel bar visibly dominates, reaching close to 1 in both model frequency and exceedance probability, while Bayes-optimal and stimulus-kernel bars are near zero — i.e., the rank order matches gt with a large dominance gap.",
          "deduction_rule": "Deduct 20 if the wrong model dominates. Deduct 12 if action-kernel is highest but the gap to alternatives is small (e.g., 0.5 vs 0.3 vs 0.2). Deduct 8 if exceedance probability shows a different rank than model frequency."
        },
        {
          "type": "visual", "layer": "L2", "point": 5,
          "criterion": "The total height across model-frequency bars sums to ~1 (frequencies form a probability distribution), and exceedance probabilities also lie within [0,1], consistent with the BMC framework.",
          "deduction_rule": "Deduct 5 if frequencies clearly do not sum to ~1 (e.g., all bars > 0.8) or if exceedance values exceed 1."
        }
      ],
      "Scoring instructions": "Stage 1: text items. Stage 2: visual items via side-by-side comparison."
    }
  }
}
```

### Changes vs original

- **新增 L3 computational 项 (20 分)**：原版"action kernel based on past action history" (25 分) 部分涉及，但新版显式对比"strict Bayes-optimal inference vs heuristic"，强调这是 normative deviation。
- **新增 L3 principle 项 (15 分)**：连接到"生物 agent 用简单递归规则替代最优推断"的更宏观原理。
- **新增 visual L2 (20 分)**：要求评测模型对比生成图与 gt 图的 model dominance gap（不仅胜者正确，还要差距足够大）。
- **新增 visual L2"frequencies sum to ~1" (5 分)**：sanity check，避免概率分布违例。
- **L1 任务复述（"alternative models"等）合并 / 缩减**：原版三条 L1（30+20+15+10 = 75 分）共占绝大多数，新版降到 ~10 分。

---

## Fig_4F — 神经-行为 inverse decay constant 相关

### 修订后 rubric

```json
{
  "tag": "Fig_4F",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Across sessions, neural inverse decay constants (extracted from neural activity's dependence on past actions) are significantly positively correlated with behavioral inverse decay constants (from the action-kernel model fit) in both Ephys (R = 0.23, P = 0.0037) and WFI (R = 0.49, P = 0.0006). This brain-behavior alignment indicates that the same temporal integration timescale governing choice behavior is also expressed in the temporal dynamics of neural activity, providing direct neural evidence for the action-kernel computation.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 10,
          "criterion": "Identifies the analysis as session-level Pearson correlations between neural inverse decay constants (from neural-activity dependence on past actions) and behavioral inverse decay constants (from the action-kernel model), separately for Ephys and WFI.",
          "deduction_rule": "Deduct 10 if neural / behavioral metrics are confused with prior decoding R². Deduct 5 if the action-kernel context is omitted."
        },
        {
          "type": "text", "layer": "L2", "point": 15,
          "criterion": "Interprets the significant positive correlations in both modalities (Ephys R ≈ 0.23, P ≈ 0.004; WFI R ≈ 0.49, P ≈ 0.0006) as evidence that neural and behavioral integration timescales are aligned across sessions.",
          "deduction_rule": "Deduct 15 if the positive cross-session relationship is missing. Deduct 8 if statistics are absent or grossly wrong. Deduct 5 if only one modality is reported. Note: minor swap of Ephys/WFI numbers should yield only small deduction (3-5)."
        },
        {
          "type": "text", "layer": "L3", "point": 20,
          "criterion": "Infers that neural circuits implement the same temporal integration timescale that governs the animal's choice behavior — providing direct neural evidence that the action-kernel computation is realized in the brain rather than being a phenomenological behavioral fit. (mechanism / theoretical)",
          "deduction_rule": "Deduct 20 if the brain-implementing-the-behavioral-model interpretation is missing. Deduct 10 if alignment is named but not framed as evidence for circuit-level realization of the action kernel."
        },
        {
          "type": "text", "layer": "L3", "point": 10,
          "criterion": "Connects this finding to the broader principle that computational models of behavior gain credibility when their internal parameters (here, the integration timescale) are independently recoverable from neural activity. (principle)",
          "deduction_rule": "Deduct 10 if no principle linkage. Deduct 5 if linked vaguely ('neural and behavioral data agree')."
        },
        {
          "type": "visual", "layer": "L1", "point": 15,
          "criterion": "The generated figure shows TWO scatter plots side by side — one for Ephys and one for WFI — with both plotting neural inverse decay constant (x-axis) against behavioral inverse decay constant (y-axis).",
          "deduction_rule": "Deduct 15 if only one panel is shown. Deduct 8 if axes are swapped between modalities. Deduct 5 if labels are missing."
        },
        {
          "type": "visual", "layer": "L2", "point": 20,
          "criterion": "Both scatter plots show a positive trend (upward-sloping fitted line), and the WFI panel shows a visibly TIGHTER trend than the Ephys panel — consistent with the gt where WFI R ≈ 0.49 is substantially larger than Ephys R ≈ 0.23.",
          "deduction_rule": "Deduct 20 if either panel shows a flat / negative trend. Deduct 12 if both panels show similar trend strength (loss of WFI > Ephys ranking). Deduct 8 if direction is correct but trend is barely perceptible in either panel."
        },
        {
          "type": "visual", "layer": "L2", "point": 10,
          "criterion": "Data points cluster in roughly the same value range as gt (most points in the positive quadrant, decay constants on the order of 0.0–0.5), without massive scale mismatches or all-negative values.",
          "deduction_rule": "Deduct 10 if axis ranges differ from gt by more than 5×. Deduct 5 if a substantial fraction of points lie at non-physical (e.g., negative) decay constants."
        }
      ],
      "Scoring instructions": "Stage 1: text items. Stage 2: visual items via side-by-side comparison."
    }
  }
}
```

### Changes vs original

- **新增 L3 mechanism 项 (20 分)**：原版"identifies the figure compares neural and behavioral temporal dynamics" (30 分) 是 L1/L2 性质；新版显式要求模型 infer "brain implements the action-kernel"，并区分"现象拟合 vs 神经实现"。
- **新增 L3 principle 项 (10 分)**：把 brain-behavior alignment 提升为方法学/理论原理。
- **新增 visual L2"WFI 相关比 Ephys 紧" (20 分)**：原版只要求"correlation is observed in both modalities" (15 分文本)，新版要求评测模型识别**两 modality 之间相关强度的相对差异**（这是科学相关 detail）。
- **L1 视觉 panel-count 检查 (15 分)**：单 panel vs 双 panel 直接影响科学结论的"双 modality 重复"。

---

## 总体修订要点汇总

1. **L1 占比**：原版每个 panel 普遍 60-75% → 新版统一压到 10-15%。
2. **L3 占比**：原版基本无独立 L3 项（仅在 "interpretation" 项含蓄涉及）→ 新版每个 panel 至少 25-35% 的 L3 项，分 "functional / mechanism" 和 "principle / theoretical" 两类。
3. **视觉项**：原版完全无独立 visual rubric → 新版每个 panel 增 35-50% 的视觉项，包含 L1（pattern 存在）+ L2（方向 / 排序 / 量级正确）。
4. **删除的格式化检查**：colormap、axis、scale bar、labels 文字 等不进 rubric。
5. **保留并强化的科学关键 pattern**（每 panel 一例）：
   - Fig_2A: 步阶切换被解码追踪
   - Fig_3A: 高 prior 在上、低 prior 在下；shift 在零对比度最大、极端对比度收敛
   - Fig_3C: 散点正向趋势 + 大部分点在正象限
   - Fig_4A: action-kernel 主导间隔（不只是排序对、要差距大）
   - Fig_4F: WFI 比 Ephys 趋势更紧（相对相关强度）

---

## 通用 Scoring 流程（建议复用）

> Stage 1 — Text Scoring: 对模型输出的文本结论部分逐条核对 `type: "text"` 项，按 deduction_rule 扣分；L1/L2/L3 项分别独立累计。
>
> Stage 2 — Visual Scoring: 对模型生成的图像与 gt 图并排比较，逐条核对 `type: "visual"` 项；只评科学 pattern 是否一致，不评配色 / 坐标 / 布局 / scale bar 等格式细节；L1 visual（pattern 存在）+ L2 visual（方向 / 排序正确）独立累计。
>
> Total = sum(text) + sum(visual)，满分 100。
