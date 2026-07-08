# Level-1 Plan Review Gate

本文档记录 Level-1 在 `neuro_plan -> neuro_code` 之间加入人工审核 gate 的方案
和当前实现改动。

主开发文档见 [level1_development.md](level1_development.md)。

## 1. 背景

当前 Pi Level-1 默认在收到 `/entry`、question 和 metadata 后，会由主 agent
自动执行完整流程：

```text
neuro_capabilities
-> neuro_start_run / neuro_resume_run
-> neuro_deep_research
-> resolve_targeted_skill
-> neuro_plan
-> neuro_code
-> neuro_validate
-> neuro_refine_image
-> neuro_analyze_image
-> neuro_conclude
```

这个模式适合非交互批处理，但交互式研究场景需要在关键阶段暂停，让用户确认
或修改下一步。例如在 `neuro_plan` 后，用户希望先看到分析计划，再决定是否
进入代码生成。

第一版只实现 `plan -> code` 之间的 gate。后续可以按同一机制扩展到 code、
validate、conclude。

## 2. 目标

交互式运行中，`neuro_plan` 完成后：

1. 主 agent 展示 `plan_path`、摘要、confidence、warnings 和关键假设。
2. 主 agent 等待用户输入。
3. 用户明确批准后，主 agent 调用 `neuro_approve_stage(stage="plan")`。
4. 只有 plan 被批准后，`neuro_code` 才能执行。
5. 用户提出修改建议时，主 agent 调用
   `neuro_record_feedback(stage="plan", feedback=...)`，然后重新运行
   `neuro_plan`。
6. 非交互模式不被 gate 阻塞。

## 3. 配置

配置位于 [config.yaml](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/config.yaml:36)：

```yaml
workflow:
    level1:
        human_review:
            enabled: true
            gates:
                plan: true
                code: false
                validate: false
                conclude: false
```

字段含义：

- `enabled: true`：交互式运行启用人工审核。
- `gates.plan: true`：`neuro_plan` 后必须人工批准，才能进入 `neuro_code`。
- `code`、`validate`、`conclude`：预留扩展点，当前关闭。

非交互模式由 [internagent/workflow/level1.sh](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/workflow/level1.sh:394)
设置：

```bash
export NEURO_LEVEL1_NON_INTERACTIVE=1
```

extension 检测到该环境变量后会禁用 human review gate，避免批处理卡住。

## 4. 新增工具

Level-1 extension 在
[internagent/pi/extensions/neuroscientist-level1/index.ts](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/index.ts:1608)
新增两个工具。

### 4.1 `neuro_approve_stage`

用途：记录用户明确批准某个阶段。

参数：

```json
{
  "run_id": "...",
  "stage": "plan",
  "notes": "approved"
}
```

写入 `state.json`：

```json
{
  "human_reviews": {
    "plan": {
      "status": "approved",
      "approved_at": "2026-07-07T...",
      "notes": "approved"
    }
  }
}
```

### 4.2 `neuro_record_feedback`

用途：记录用户对某个阶段的修改建议或拒绝原因。

参数：

```json
{
  "run_id": "...",
  "stage": "plan",
  "feedback": "不要用 mean，改用 median 和 bootstrap 95% CI。"
}
```

写入 `state.json`：

```json
{
  "human_reviews": {
    "plan": {
      "status": "changes_requested",
      "feedback": [
        {
          "at": "2026-07-07T...",
          "text": "不要用 mean，改用 median 和 bootstrap 95% CI。"
        }
      ]
    }
  }
}
```

## 5. 硬阻断

`neuro_code` 在启动 coder subagent 前检查 plan gate：

```text
human_review.gates.plan == true
AND state.human_reviews.plan.status != "approved"
```

如果未批准，`neuro_code` 返回：

```json
{
  "ok": false,
  "blocked_by_human_review": true,
  "required_stage": "plan",
  "next_tool": "neuro_code"
}
```

这让 gate 不只依赖 prompt。即使主 agent 误调用 `neuro_code`，extension 也会
拒绝继续。

实现位置：

- gate 配置解析：
  [index.ts](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/index.ts:496)
- 阻断返回结构：
  [index.ts](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/index.ts:565)
- `neuro_code` 检查：
  [index.ts](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/index.ts:1949)

## 6. Prompt 修改

`/entry` prompt 已增加 Human Review Gates 规则：

[internagent/pi/extensions/neuroscientist-level1/prompts/entry.md](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/prompts/entry.md:99)

规则摘要：

- `neuro_capabilities` 可能返回 `human_review.enabled=true`。
- 如果 `human_review.gates.plan=true`，`neuro_plan` 后必须停住。
- 主 agent 展示计划信息并等待用户确认。
- 用户批准时调用 `neuro_approve_stage(stage="plan")`。
- 用户提出修改时调用 `neuro_record_feedback(stage="plan", feedback=...)`，
  然后重新运行 `neuro_plan`。
- 如果下游工具返回 `blocked_by_human_review=true`，主 agent 不应立即重试
  下游工具，而应回到用户确认/反馈流程。

## 7. Planner 反馈注入

`neuro_plan` 会读取：

```json
state.human_reviews.plan.feedback
```

并把历史人工反馈注入 planner subagent prompt：

```text
Human review feedback for the plan:
1. ...
2. ...
```

因此用户提出修改后，重新运行 `neuro_plan` 会吸收这些建议。

实现位置：

[index.ts](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/index.ts:1873)

## 8. 交互体验

启动交互式运行：

```bash
./pi_run_level1.sh \
  --query "$(cat question/Adam_2023_Cell/Fig_1H.md)" \
  --dataset /path/to/meta.json \
  --work_dir results/dev/adam-fig-1h
```

预期流程：

```text
neuro_capabilities
-> neuro_start_run
-> optional context stages
-> neuro_plan
-> stop and show plan
-> user approval or feedback
```

用户批准：

```text
yes
```

主 agent 应调用：

```text
neuro_approve_stage(stage="plan")
neuro_code(...)
```

用户提出修改：

```text
不要用 mean，改用 median 和 bootstrap 95% CI；另外保存每个 animal 的单独统计。
```

主 agent 应调用：

```text
neuro_record_feedback(stage="plan", feedback="...")
neuro_plan(additional_context="Revise according to human feedback...")
```

新的 plan 生成后仍需用户批准。

## 9. 涉及文件

当前实现修改了：

- [config.yaml](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/config.yaml:36)
- [internagent/workflow/level1.sh](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/workflow/level1.sh:38)
- [internagent/workflow/agent_config.py](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/workflow/agent_config.py:21)
- [internagent/pi/extensions/neuroscientist-level1/index.ts](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/index.ts:496)
- [internagent/pi/extensions/neuroscientist-level1/prompts/entry.md](/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/prompts/entry.md:99)
- [docs/level1_development.md](level1_development.md)
- [docs/level1_plan_review_gate.md](level1_plan_review_gate.md)

部署后同步生成：

- `.pi/extensions/neuroscientist-level1/index.ts`
- `.pi/extensions/neuroscientist-level1/prompts/entry.md`
- `.pi/extensions/neuroscientist-level1/config.json`

## 10. 验证

已执行：

```bash
bash -n pi_run_level1.sh
bash -n internagent/workflow/level1.sh
python3 -m py_compile internagent/workflow/agent_config.py
python3 internagent/workflow/agent_config.py merged config.yaml
./pi_deploy.sh
./pi_run_level1.sh --help
```

部署后检查：

```bash
rg -n "neuro_approve_stage|neuro_record_feedback|human_review|blocked_by_human_review" \
  .pi/extensions/neuroscientist-level1/index.ts \
  .pi/extensions/neuroscientist-level1/prompts/entry.md \
  .pi/extensions/neuroscientist-level1/config.json
```

## 11. 后续扩展

同一机制可以扩展到：

- `code` gate：`neuro_code` 产物生成后，用户确认是否进入 validate。
- `validate` gate：验证结束后，用户决定 retry、refine 或 conclude。
- `conclude` gate：最终总结前，用户确认是否已有足够证据。

扩展时需要同时修改：

- `config.yaml` gate 开关。
- `level1WorkflowConfig` 的 gate 解析。
- 下游工具的硬阻断检查。
- `/entry` prompt 的对应人机交互规则。

