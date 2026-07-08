# Level-1 Pi Workflow Development Guide

本文档说明如何从原始项目
`/mnt/shared-storage-user/zhuyuqing-p/Intern-NeuroScientist`
一步步构建出当前可运行的
`/mnt/shared-storage-user/zhuyuqing-p/agent-loop/pi_run_level1.sh`。

范围只覆盖 Level-1。Level-2、批量运行、评测脚本只在它们影响 Level-1
可运行性时简要提及。

## 1. 目标

原始 `Intern-NeuroScientist` 项目包含一组面向神经科学分析任务的 Python
agent、问题文件、数据 metadata、custom 分析工具和评测资源。当前
`agent-loop` 的 Level-1 目标不是简单运行旧的 `agent_loop.py`，而是把旧项目
能力封装成一个 Pi Coding Agent workflow：

1. 用户通过 `pi_run_level1.sh` 启动任务。
2. Shell wrapper 固定加载项目本地 Pi runtime、Level-1 extension 和 `/entry`
   prompt。
3. Pi 主 agent 只负责 workflow 编排。
4. 具体阶段由 extension 注册的工具完成：
   capabilities、start/resume、deep research、targeted skill、plan、code、
   validate、refine image、analyze image、conclude。
5. 每次运行写入独立 `work_dir`，包括 `state.json`、计划、代码、图、统计、
   验证、图像解读和最终结论。

最终可运行入口是：

```bash
/mnt/shared-storage-user/zhuyuqing-p/agent-loop/pi_run_level1.sh
```

它本身很薄，只负责跳转到真正的 Level-1 workflow shell：

```bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${ROOT_DIR}/internagent/workflow/level1.sh" "$@"
```

## 2. 从旧项目到新项目的职责变化

### 2.0 历史 workflow 来源说明

旧项目里有两个容易混淆的 workflow 文件：

```text
Intern-NeuroScientist/internagent/mas/workflow/agent_loop_workflow.py
Intern-NeuroScientist/internagent/mas/workflow/neuroscientist_workflow.py
```

当前 `agent-loop` 的 Level-1 **不是直接运行这两个文件中的任何一个**；Pi
版本已经把旧 Python workflow 重写成 TypeScript extension + prompt + shell
wrapper 的形式。

当前 Pi Level-1 的阶段设计主要来自 `neuroscientist_workflow.py`。该文件定义
固定 NeuroScientist 可视化/分析流水线，核心阶段包括：

```text
deep research / skill discovery
-> planning
-> code generation and execution
-> semantic validation
-> image refinement
-> image analysis
-> conclusion / summary
```

这与当前 Pi Level-1 的 `/entry` spine 对应：

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

`agent_loop_workflow.py` 的设计重点不同：它是一个动态 tool-loop orchestrator，
由中心 LLM 在循环中选择 `classify_data`、`load_skills`、`make_plan`、
`generate_code`、`execute_code`、`repair_code`、`analyze_image`、
`draw_conclusions`、`finish` 等工具。它给当前 Pi 版本提供了一些“工具化
stage”的思路，但当前 Level-1 没有照搬它的动态 `AgentLoopWorkflow` 主循环。
当前 Pi Level-1 是由 `/entry` prompt 约束的固定科学链条，结构上更接近
`neuroscientist_workflow.py`。

### 2.1 原始项目职责

`Intern-NeuroScientist` 提供了这些基础资产：

- `question/`：每个 figure 或分析任务的自然语言描述。
- `custom/`：项目内维护的分析辅助函数。
- `requirements.txt`、`environment.yaml`：Python 运行环境。
- `assets/`：README 和展示用资源。
- `evaluate/`：评测脚本和部分评测资源。
- `internagent/`：旧 agent 辅助模块。
- `main.py`、`agent_loop.py`、`command_*.sh`：旧式入口和命令脚本。

### 2.2 新项目职责

`agent-loop` 保留旧项目的数据和分析资产，但把主执行方式换成 Pi workflow。
新增或重构的核心部分是：

- `pi_run_level1.sh`：用户面对的稳定入口。
- `internagent/workflow/level1.sh`：Level-1 shell orchestrator。
- `internagent/workflow/agent_config.py`：shell 和 extension 共用的配置解析层。
- `internagent/pi/extensions/neuroscientist-level1/`：Level-1 extension 源目录。
- `.pi/extensions/neuroscientist-level1/`：部署后的 Level-1 extension。
- `.pi/agent/`：Pi runtime 的 settings、auth、models 和辅助 bin。
- `internagent/modules/targeted_skill/`：迁移后的 targeted skill / RAG Python 模块。
- `library/skills/`：可检索或生成的技能库。
- `config.yaml`：Level-1 workflow、模型、能力开关和模块路径配置。
- `pi_install.sh`：项目内安装 Node.js 和 Pi CLI。
- `pi_deploy.sh`：部署 extension、settings、models、auth。

关键变化是：旧项目的 `agent_loop.py` 不再是 Level-1 主入口；它的思想被拆成
Pi extension 工具和 prompt。现在的主控逻辑由 Pi agent 根据 `/entry` prompt
执行，extension 负责提供边界清晰的工具。

## 3. 最终目录结构

下面是 Level-1 相关的最小结构。

```text
agent-loop/
  pi_run_level1.sh
  pi_install.sh
  pi_deploy.sh
  config.yaml
  .env
  .env.example

  .tools/
    node/
      bin/
        node
        npm
        pi

  .pi/
    agent/
      settings.json
      auth.json
      models.json
      bin/
        rg
        fd
    extensions/
      neuroscientist-level1/
        index.ts
        config.json
        prompts/
          entry.md
          continue.md
          conclude_only.md
          deep_research.md
          plan.md
          code.md
          validate.md
          image_refine.md
          image_analysis.md
          conclude.md

  internagent/
    workflow/
      level1.sh
      agent_config.py
      summarize_usage.py
      many_level1.sh
      pi_mapping.tsv
    pi/
      agent/
        settings.json
      extensions/
        neuroscientist-level1/
          index.ts
          prompts/
            ...
    modules/
      targeted_skill/
        resolve_targeted_skill.py
        rag_paper.py
        skill_loader.py
        single_skill/

  library/
    skills/
      trajectory/
      from_rag/

  question/
  custom/
  cases/
  results/
```

`internagent/pi/extensions/...` 是源目录；`.pi/extensions/...` 是部署目录。
开发时改源目录，然后运行 `./pi_deploy.sh` 重新部署。当前 `level1.sh` 直接加载
`.pi/extensions/neuroscientist-level1/index.ts`，所以只改源目录但不部署不会生效。

## 4. 构建步骤总览

从 `Intern-NeuroScientist` 构建 `agent-loop` 的步骤可以分成 8 层：

1. 复制基础项目资产。
2. 删除或旁路旧主入口。
3. 新增 targeted skill 模块。
4. 新增 Pi extension 源目录。
5. 新增 workflow shell 和配置解析层。
6. 新增安装和部署脚本。
7. 部署 `.pi` 运行资源。
8. 暴露 `pi_run_level1.sh` 入口。

下面逐层说明。

## 5. 第一步：复制基础项目资产

以 `Intern-NeuroScientist` 作为初始目录：

```bash
cp -a /mnt/shared-storage-user/zhuyuqing-p/Intern-NeuroScientist \
  /mnt/shared-storage-user/zhuyuqing-p/agent-loop
cd /mnt/shared-storage-user/zhuyuqing-p/agent-loop
```

保留以下内容：

- `question/`
- `custom/`
- `assets/`
- `requirements.txt`
- `environment.yaml`
- 与评测相关的 `evaluate/`

这些文件支撑实际分析和任务输入，不属于 Pi runtime，但 Level-1 code stage
最终会依赖它们。

## 6. 第二步：替换旧入口思路

旧项目里常见入口包括：

- `agent_loop.py`
- `main.py`
- `command_interactive.sh`
- `command_michael.sh`
- `command_findling.sh`
- `command_ryosuke.sh`
- `test_agent_loop.sh`

这些入口通常将 agent 调用、任务输入、模型选择和流程控制混在一起。新的
Level-1 设计将它们拆开：

- shell 只负责启动 Pi 和传参。
- prompt 负责 workflow 策略。
- extension tool 负责每个阶段的隔离实现。
- `config.yaml` 负责模型、timeout、能力开关。
- `work_dir/state.json` 负责运行状态。

因此，新入口不是改旧 `agent_loop.py`，而是新建：

```text
pi_run_level1.sh
internagent/workflow/level1.sh
```

## 7. 第三步：新增配置层

### 7.1 `config.yaml`

`config.yaml` 是 Level-1 的主配置文件。它包含四类配置：

```yaml
paths:
  # root_dir: /path/to/project
  # project_dir: /path/to/python/source

modules:
  targeted_skill:
    skill_dir: library/skills/trajectory
    generated_skill_output_dir: library/skills/from_rag
    skill_enable: true
    generate_skill_enable: true
    model: claude-opus-4-7
    top_k: 1
    relevance_threshold: 0.3
    temperature: 1.0
    rag_top_k: 2

workflow:
  debug_disk_writes: true
  level1:
    deep_research: true
    targeted_skill_match: true
    targeted_skill_generate: true
    image_refine: true
    image_analysis: true

agents:
  level1:
    provider: anthropic
    model: claude-opus-4-7
    thinking: high
    timeout_seconds: 5400
```

字段含义：

- `paths.root_dir`：项目根目录。通常不写，运行时使用当前 cwd。
- `paths.project_dir`：Python targeted skill 模块目录。通常不写，默认
  `internagent/modules`。
- `modules.targeted_skill.skill_dir`：已验证技能库目录。
- `modules.targeted_skill.generated_skill_output_dir`：RAG 生成技能的输出目录。
- `workflow.debug_disk_writes`：是否写 session log、events、usage、snapshot。
- `workflow.level1.deep_research`：是否启用 RAG 背景检索。
- `workflow.level1.targeted_skill_match`：是否匹配已有技能。
- `workflow.level1.targeted_skill_generate`：未匹配时是否生成技能。
- `workflow.level1.image_refine`：是否启用图像修复阶段。
- `workflow.level1.image_analysis`：是否启用图像解读阶段。
- `agents.level1`：主 Pi orchestrator 的模型参数。
- `agents.level1_default`：Level-1 子 agent 默认模型参数。
- `agents.level1_code`：代码生成子 agent 参数，通常需要更长 timeout。
- `agents.level1_validate`、`level1_refine_image`、`level1_analyze_image`：视觉能力配置。
- `models`：额外 OpenAI-compatible 模型定义。

### 7.2 `agent_config.py`

`internagent/workflow/agent_config.py` 是 shell 和 extension 之间的配置中间层。
它做三件事：

1. 解析一个受限 YAML 子集，避免 shell 直接依赖复杂 YAML 工具。
2. 合并 workflow 默认值和用户配置。
3. 为 shell 输出 Pi CLI 参数或 timeout。

常用调用：

```bash
python3 internagent/workflow/agent_config.py merged config.yaml
python3 internagent/workflow/agent_config.py workflow debug_disk_writes config.yaml
python3 internagent/workflow/agent_config.py level1 pi_args config.yaml
python3 internagent/workflow/agent_config.py level1 timeout_seconds 5400 config.yaml
python3 internagent/workflow/agent_config.py level1_conclude timeout_seconds 600 config.yaml
```

`level1.sh` 通过它读取：

- 主模型 CLI 参数：`--provider`、`--model`
- 主流程 timeout
- conclude-only timeout
- `workflow.debug_disk_writes`

`pi_deploy.sh` 也通过它读取 merged config，并 bake 到
`.pi/extensions/neuroscientist-level1/config.json`。

## 8. 第四步：新增 Pi extension

### 8.1 源目录和部署目录

源目录：

```text
internagent/pi/extensions/neuroscientist-level1/
```

部署目录：

```text
.pi/extensions/neuroscientist-level1/
```

`pi_deploy.sh` 会把源目录复制到部署目录，并生成：

```text
.pi/extensions/neuroscientist-level1/config.json
```

### 8.2 `index.ts`

`index.ts` 是 Level-1 extension 的实现。它向 Pi 注册工具，并负责：

- run 状态创建和恢复。
- 子 agent 调用。
- prompt 读取。
- artifact 归一化。
- `state.json` 更新。
- debug log、usage、snapshot 写入。
- dummy data 检查。
- statistics sanity warning。

核心工具如下。

#### `neuro_ping`

用途：确认 extension 已加载。

不会创建 run，不会修改任务状态。适合部署后快速验证：

```text
/entry 请先调用 neuro_ping 检查 extension
```

#### `neuro_capabilities`

用途：读取 `config.yaml` 或 baked `config.json`，报告 Level-1 可用能力。

返回内容包括：

- required spine：
  - `neuro_start_run`
  - `neuro_plan`
  - `neuro_code`
  - `neuro_validate`
  - `neuro_conclude`
- optional：
  - `deep_research`
  - `targeted_skill`
  - `image_refine`
  - `image_analysis`

主 agent 必须先调用它。被用户配置关闭的 optional stage 不是错误。

#### `neuro_start_run`

用途：创建一个新 run。

输入：

- `work_dir`
- `question`
- optional `deliverables`

输出：

- `run_id`
- `run_dir`
- `deliverables`
- `question`

如果没有显式 deliverables，extension 会注入默认产物：

- `generated_code.py`
- `figure.png`
- `figure.pdf`
- `statistics.json`

同时还会确保 code 和 statistics 基础 artifact 存在。

#### `neuro_resume_run`

用途：恢复已有 run。

输入：

- `work_dir`
- optional `question`

它读取：

```text
{work_dir}/state.json
```

如果传入新的 `question`，旧 question 会进入 `question_history`，当前 question
会被替换。

#### `resolve_targeted_skill`

用途：调用 Python targeted skill flow。

它会运行：

```text
internagent/modules/targeted_skill/resolve_targeted_skill.py
```

该脚本负责：

1. 使用 `SkillLoader` 在 `library/skills/trajectory` 中匹配已有技能。
2. 如果未匹配且允许生成，则调用 RAG 相关流程生成技能。
3. 写入 trace 和 targeted skill 文本。

输出写入：

```text
{work_dir}/targeted_skill.md
{work_dir}/targeted_skill_trace/
```

并更新 `state.json`：

```json
{
  "targeted_skill": "...",
  "targeted_skill_result": {}
}
```

#### `neuro_deep_research`

用途：调用 Paper RAG 获取背景上下文。

它会运行：

```text
internagent/modules/targeted_skill/rag_paper.py
```

输出：

```text
{work_dir}/deep_research_context.md
{work_dir}/deep_research_sources.json
```

即使 RAG 没有返回可用来源，也会写一个明确的空背景说明，避免后续阶段误以为
有证据。

#### `neuro_plan`

用途：启动隔离 planning subagent。

输入：

- question
- run_id
- metadata as `data_info`
- `extra_path_info`
- targeted skill
- deep research context

输出：

```text
{work_dir}/plan.md
```

并更新 `state.json.plan`。

#### `neuro_code`

用途：启动隔离 coding subagent，生成分析代码和实际产物。

输入：

- question
- run_id
- plan
- data_info
- extra_path_info
- targeted_skill
- validation_feedback

coding subagent 可用工具：

- read
- write
- edit
- bash
- grep
- find
- ls

输出包括：

- code files
- execution log
- statistics
- artifacts
- summary
- warnings

extension 会把返回的代码和产物写入 run directory：

```text
{work_dir}/generated_code.py
{work_dir}/exec.log
{work_dir}/statistics.json
{work_dir}/figure.png
{work_dir}/figure.pdf
```

实际 artifact 路径以 `state.json.artifacts` 为准。不要从文件名猜测。

`neuro_code` 还会做 deterministic checks：

- 检测 dummy/synthetic data 信号。
- 检测 statistics plausibility warning。
- 检查 artifact 是否存在。

如果发现 dummy data 信号，结果会包含：

```json
{
  "blocked_by_dummy_data": true
}
```

此时后续结论必须明确说明数据完整性限制。

#### `neuro_validate`

用途：对实际图像 artifact 做语义和视觉验证。

它从 `state.json.artifacts` 找 figure artifact，并加载图像给 vision subagent。

输出：

```text
{work_dir}/validation.json
```

内容包括：

- `pass`
- `per_figure`
- `overall_mismatches`
- `confidence`
- `summary`
- `next_code_feedback`

如果验证失败，主 agent 应该把 `next_code_feedback` 合并成
`validation_feedback`，最多默认重试 code 3 次。

#### `neuro_refine_image`

用途：当图像质量或验证指出问题时，启动 image refinement subagent。

它会：

1. 加载目标 figure。
2. 定位生成该 figure 的代码。
3. 让子 agent 修改代码。
4. 用 bash 重跑代码。
5. 原地覆盖目标 figure。

要求：

- 不生成 `figure_refine.png` 这类旁路文件。
- `refined_figure_path` 应等于原始 `figure_path`。
- refine 后应重新运行 `neuro_validate`。

#### `neuro_analyze_image`

用途：对最终图像做科学解读。

输出：

```text
{work_dir}/image_analyses/{figure_basename}.md
```

并更新：

```json
{
  "image_analysis": {},
  "image_analyses": []
}
```

多图时，每个 image analyzer 只解释自己负责的一张图，跨图综合由 conclude
stage 完成。

#### `neuro_conclude`

用途：从验证结果、统计、图像解读和数据 artifact 中写最终结论。

输出：

```text
{work_dir}/conclusions.json
```

内容包括：

- `conclusions`
- `summary`
- `limitations`
- `confidence`

如果 `state.checks.dummy_data_signals` 非空，conclude prompt 会注入
DATA INTEGRITY WARNING，要求最终限制中明确说明。

## 9. 第五步：编写 `/entry` prompt

Level-1 的行为不是写死在 shell 里，而是写在：

```text
.pi/extensions/neuroscientist-level1/prompts/entry.md
```

源文件位于：

```text
internagent/pi/extensions/neuroscientist-level1/prompts/entry.md
```

该 prompt 规定了主 agent 的职责边界：

- 主 agent 是 workflow orchestrator。
- 不直接实现分析逻辑。
- 不随意扫描大目录。
- 不发明数据。
- 不直接编辑 `state.json`。
- 所有状态更新必须通过 NeuroScientist tools。
- 写入边界限制在 `work_dir` 和用户显式要求的输出路径。

它还规定 Level-1 执行顺序：

```text
0. neuro_capabilities
1. neuro_start_run / neuro_resume_run
2. neuro_deep_research
3. resolve_targeted_skill
4. neuro_plan
5. neuro_code
6. neuro_validate
7. neuro_refine_image
8. neuro_analyze_image
9. neuro_conclude
```

必需主干是：

```text
start/resume -> plan -> code -> validate -> conclude
```

optional stage 由 `neuro_capabilities` 和 `config.yaml` 决定。

### 9.1 `continue.md`

用于非交互运行的恢复。如果 Pi 退出码为 0，但 `work_dir` 中没有
`conclusions.json`，`level1.sh` 会构造 `/entry {continue.md}` 再跑一次。

### 9.2 `conclude_only.md`

用于最后兜底。如果 continue 后仍没有结论，但 `state.json` 有 `run_id`，
`level1.sh` 会只加载少量工具：

```text
read,bash,neuro_resume_run,neuro_conclude
```

然后尝试只完成 conclusion。

## 10. 第六步：编写 `level1.sh`

`internagent/workflow/level1.sh` 是真正的 Level-1 shell runner。

### 10.1 初始化项目上下文

脚本启动后首先定位项目根目录：

```bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"
export PI_CODING_AGENT_DIR="${ROOT_DIR}/.pi/agent"
```

这保证无论从哪里调用，Pi 都在项目根目录运行，并使用项目内 `.pi/agent`。

### 10.2 选择 Pi 命令

优先使用本地安装：

```bash
PROJECT_NODE_BIN="${ROOT_DIR}/.tools/node/bin"
if [[ -x "${PROJECT_NODE_BIN}/pi" && -x "${PROJECT_NODE_BIN}/node" ]]; then
  export PATH="${PROJECT_NODE_BIN}:${PATH}"
  PI_CMD="${PROJECT_NODE_BIN}/pi"
elif command -v pi >/dev/null 2>&1; then
  PI_CMD="$(command -v pi)"
else
  echo "Error: 'pi' command not found. Run ./pi_install.sh first." >&2
  exit 1
fi
```

这样开发机没有全局 Pi 也可以运行。

### 10.3 固定加载 Level-1 extension

`PI_RESOURCE_ARGS` 关闭默认 extension 和 prompt template，只加载项目内
Level-1：

```bash
PI_RESOURCE_ARGS=(
  --approve
  --no-extensions
  --extension "${ROOT_DIR}/.pi/extensions/neuroscientist-level1/index.ts"
  --no-prompt-templates
  --prompt-template "${ROOT_DIR}/.pi/extensions/neuroscientist-level1/prompts/entry.md"
  --tools "read,bash,edit,write,neuro_ping,neuro_capabilities,neuro_start_run,neuro_resume_run,resolve_targeted_skill,neuro_deep_research,neuro_plan,neuro_code,neuro_validate,neuro_refine_image,neuro_analyze_image,neuro_conclude"
)
```

这几个参数很关键：

- `--approve`：避免项目 `.pi` 资源加载时弹 trust prompt。
- `--no-extensions`：不加载用户或系统其它 extension。
- `--extension ...level1/index.ts`：只加载当前 Level-1 extension。
- `--no-prompt-templates`：不加载其它 prompt template。
- `--prompt-template ...entry.md`：显式加载 `/entry`。
- `--tools ...`：只开放 workflow 需要的工具。

### 10.4 参数解析

Level-1 支持：

```text
--non-interactive
--query TEXT
--dataset TEXT
--work_dir PATH
--path TEXT
```

含义：

- `--query`：研究问题，可以是问题文本，也可以由调用方先 `cat question/*.md`。
- `--dataset`：metadata JSON 内容或 `.json` 文件路径。
- `--work_dir`：本次运行输出目录。
- `--path`：额外路径或数据访问说明。
- `--non-interactive`：使用 `--mode json` 运行到结论。

如果 `--dataset` 是文件路径，脚本会读入文件内容：

```bash
if [[ -n "${DATASET}" && -f "${DATASET}" ]]; then
  DATASET="$(cat "${DATASET}")"
fi
```

### 10.5 构造 `/entry` message

交互模式：

```text
/entry {query}

## Dataset / Metadata
{dataset}

## Output work directory
Use work_dir: {work_dir}

## Extra path / access notes
{path}
```

非交互模式会追加执行策略：

```text
This run is non-interactive. Continue through the workflow until
neuro_conclude succeeds and writes the final conclusion artifact.
Only stop after conclusion. Do not ask the user follow-up questions.
...
```

### 10.6 交互模式

不加 `--non-interactive` 时：

```bash
./pi_run_level1.sh
```

或：

```bash
./pi_run_level1.sh \
  --query "..." \
  --dataset path/to/meta.json \
  --work_dir results/example
```

脚本会 exec 到 Pi TUI：

```bash
exec "${PI_CMD}" "${PI_RESOURCE_ARGS[@]}" "${PI_MAIN_ARGS[@]}" "${ENTRY_MESSAGE}"
```

用户可以在 Pi 里观察、继续输入、手动检查过程。

### 10.7 非交互模式

非交互模式要求必须提供：

- `--query`
- `--dataset`

命令形态：

```bash
./pi_run_level1.sh --non-interactive \
  --query "..." \
  --dataset path/to/meta.json \
  --work_dir results/example
```

脚本运行：

```bash
pi ... --mode json "/entry ..."
```

并将 session JSONL 写入：

```text
{work_dir}/pi_session.jsonl
```

如果 `workflow.debug_disk_writes=false`，session log 会写到 `/dev/null`。

### 10.8 自动恢复

非交互模式结束后，脚本检查：

```text
{work_dir}/conclusions.json
```

如果不存在，再检查：

```text
{work_dir}/state.json
```

如果 `state.json` 有 `run_id`，则按顺序尝试：

1. `continue.md`：完整工具集再续跑一次。
2. `conclude_only.md`：只恢复 run 并调用 `neuro_conclude`。

这解决了主 agent 退出码为 0 但没有最终结论的问题。

### 10.9 日志压缩和 usage 汇总

如果 `debug_disk_writes=true`，脚本结束后会：

- gzip `pi_session.jsonl`
- gzip `pi_session.continue.jsonl`
- gzip `pi_session.conclude_only.jsonl`
- 写 `workflow_timing.json`
- 调用 `internagent/workflow/summarize_usage.py`

生成：

```text
{work_dir}/workflow_timing.json
{work_dir}/usage/summary.json
```

## 11. 第七步：编写 `pi_install.sh`

`pi_install.sh` 负责项目本地安装，不污染系统环境。

它安装：

- Node.js `v24.18.0`
- `@earendil-works/pi-coding-agent`

安装位置：

```text
.tools/node/
```

最终 Pi binary：

```text
.tools/node/bin/pi
```

脚本检查：

- Node.js >= `22.19.0`
- Pi >= `0.80.2`

使用：

```bash
./pi_install.sh
```

失败常见原因：

- 网络无法下载 Node tarball。
- npm registry 不可达。
- `.tools/node` 权限异常。

处理方式：

1. 检查网络。
2. 删除损坏的 `.tools/node` 后重跑。
3. 或全局安装 Node.js >= 22.19 和 Pi CLI。

## 12. 第八步：编写 `pi_deploy.sh`

`pi_deploy.sh` 负责把源资源部署成 Pi 可直接加载的 `.pi` 目录。

### 12.1 输入

默认读取：

```text
.env
config.yaml
internagent/pi/
vendor/bin/
```

### 12.2 输出

写入：

```text
.pi/extensions/neuroscientist-level1/
.pi/extensions/neuroscientist-level2/
.pi/agent/settings.json
.pi/agent/models.json
.pi/agent/auth.json
.pi/agent/bin/
```

Level-1 只依赖：

```text
.pi/extensions/neuroscientist-level1/
.pi/agent/
```

### 12.3 部署 extension

部署时会删除并重建 `.pi` 下的 deploy 目录，然后复制：

```text
internagent/pi/extensions -> .pi/extensions
```

### 12.4 bake config

如果 `config.yaml` 存在，部署脚本调用：

```bash
python3 internagent/workflow/agent_config.py merged config.yaml
```

然后写入：

```text
.pi/extensions/neuroscientist-level1/config.json
.pi/extensions/neuroscientist-level2/config.json
```

这样 extension 即使在运行中读取不到原始 YAML，也有 baked config 可用。

### 12.5 写 settings

`agents.level1` 会写入：

```text
.pi/agent/settings.json
```

例如：

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-opus-4-7",
  "defaultThinkingLevel": "high"
}
```

### 12.6 写 auth 和 models

`.env` 支持：

```env
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=
OPENAI_API_KEY=
OPENAI_BASE_URL=
```

部署后写入：

```text
.pi/agent/auth.json
.pi/agent/models.json
```

如果没有 `.env`，默认部署会失败。只部署 extension 可用：

```bash
./pi_deploy.sh --force
```

但没有 API key 时，真正运行模型调用仍会失败。

### 12.7 复制 vendor bin

如果存在：

```text
vendor/bin/rg
vendor/bin/fd
```

部署脚本会复制到：

```text
.pi/agent/bin/
```

这样子 agent 可用稳定的 `rg` / `fd`，不完全依赖系统命令。

## 13. 第九步：暴露 `pi_run_level1.sh`

最终入口只做一件事：

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${ROOT_DIR}/internagent/workflow/level1.sh" "$@"
```

它的价值是：

- 用户不需要记住内部 workflow 路径。
- 未来可以移动 `internagent/workflow/level1.sh` 的实现，但保持入口不变。
- `pi_run_many_level1.sh` 等批处理也可以稳定调用它。

## 14. 最小可运行构建命令

完整构建流程：

```bash
cd /mnt/shared-storage-user/zhuyuqing-p

cp -a Intern-NeuroScientist agent-loop
cd agent-loop

# 添加或同步 Pi workflow 相关文件：
# - config.yaml
# - pi_install.sh
# - pi_deploy.sh
# - pi_run_level1.sh
# - internagent/workflow/
# - internagent/pi/extensions/neuroscientist-level1/
# - internagent/modules/targeted_skill/
# - library/skills/
# - vendor/bin/rg, vendor/bin/fd

./pi_install.sh

cp .env.example .env
# 编辑 .env，写入 ANTHROPIC_API_KEY 或 OPENAI_API_KEY

./pi_deploy.sh

./pi_run_level1.sh
```

非交互 smoke test：

```bash
./pi_run_level1.sh --non-interactive \
  --query "$(cat question/Adam_2023_Cell/Fig_1H.md)" \
  --dataset /path/to/meta.json \
  --work_dir results/dev-smoke/adam-fig-1h
```

## 15. 运行模式

### 15.1 交互模式

只启动 Pi TUI：

```bash
./pi_run_level1.sh
```

带任务进入 Pi TUI：

```bash
./pi_run_level1.sh \
  --query "$(cat question/Adam_2023_Cell/Fig_1H.md)" \
  --dataset /path/to/meta.json \
  --work_dir results/adam-fig-1h
```

适合：

- 开发调试。
- 查看 agent 中间决策。
- 手动恢复或追问。
- 验证 prompt 修改效果。

### 15.2 非交互模式

```bash
./pi_run_level1.sh --non-interactive \
  --query "$(cat question/Adam_2023_Cell/Fig_1H.md)" \
  --dataset /path/to/meta.json \
  --work_dir results/adam-fig-1h
```

适合：

- 批处理。
- 自动评测。
- 后台长任务。
- 和 `many_level1.sh` 集成。

非交互模式必须传 `--query` 和 `--dataset`，因为 prompt 明确禁止在缺少
metadata 时发明或自行搜索数据。

## 15A. Plan Review Gate

Level-1 支持在 `neuro_plan -> neuro_code` 之间插入人工审核 gate。方案、
状态结构、工具、配置和当前修改内容见独立文档：

[docs/level1_plan_review_gate.md](level1_plan_review_gate.md)

## 16. 输入契约

### 16.1 `--query`

可以是：

- 直接问题文本。
- `cat question/.../*.md` 后的 markdown 内容。

推荐写法：

```bash
--query "$(cat question/Findling_2025_Nature/Fig_3A.md)"
```

### 16.2 `--dataset`

可以是：

- metadata JSON 字符串。
- metadata JSON 文件路径。

如果是文件路径，`level1.sh` 会自动读取文件内容并内联进 prompt。

推荐写法：

```bash
--dataset /mnt/shared-storage-gpfs2/.../meta.json
```

### 16.3 `--work_dir`

本次运行所有输出的目录。

推荐使用：

```text
results/{paper_or_dataset}/{tag}
```

例如：

```bash
--work_dir results/Adam_2023_Cell/fig-1h-dev
```

如果交互模式没有提供 `work_dir`，entry prompt 要求主 agent 创建类似：

```text
results/default/20260626-153045-neuroscientist
```

### 16.4 `--path`

额外路径说明，例如：

- 数据文件实际挂载路径。
- metadata 里路径需要替换的规则。
- 只读数据根目录。
- 期望输出额外文件。

这些会进入 `extra_path_info`，传给 plan 和 code。

## 17. 输出目录契约

一个成功 Level-1 run 通常包含：

```text
work_dir/
  state.json
  plan.md
  generated_code.py
  exec.log
  statistics.json
  figure.png
  figure.pdf
  validation.json
  conclusions.json
  targeted_skill.md
  targeted_skill_trace/
  deep_research_context.md
  deep_research_sources.json
  image_analyses/
  snapshots/
  usage/
    summary.json
  events.jsonl
  workflow_timing.json
  pi_session.jsonl.gz
```

并非所有文件都必然存在：

- `targeted_skill.md` 取决于 targeted skill 是否启用且匹配/生成成功。
- `deep_research_context.md` 取决于 deep research 是否启用。
- `image_analyses/` 取决于 image analysis 是否启用。
- `snapshots/`、`events.jsonl`、`usage/` 取决于 `debug_disk_writes=true`。
- `pi_session.jsonl.gz` 只在非交互模式且 debug 写入开启时存在。

判断运行是否真正完成，优先看：

```text
work_dir/conclusions.json
```

其次看：

```json
state.json 中的 "conclusions"
```

## 18. `state.json` 设计

`state.json` 是 run 的核心状态文件。主 agent 可以读它，但不能直接编辑它。
所有更新必须通过 extension tool。

典型字段：

```json
{
  "run_id": "...",
  "run_dir": "...",
  "question": "...",
  "question_history": [],
  "deliverables": [],
  "data_info": "...",
  "extra_path_info": "...",
  "deep_research_context": "...",
  "deep_research_sources": [],
  "targeted_skill": "...",
  "targeted_skill_result": {},
  "plan": {},
  "code_attempt": 1,
  "code": {},
  "checks": {},
  "artifacts": [],
  "validation": {},
  "validations": [],
  "refinement": {},
  "image_analysis": {},
  "image_analyses": [],
  "conclusions": {},
  "events": []
}
```

### 18.1 `run_id`

所有后续 tool 调用都必须传同一个 `run_id`。

### 18.2 `deliverables`

声明本次 run 应产出的文件。若用户没有指定，extension 注入默认值。

### 18.3 `artifacts`

动态 artifact 索引。后续 validate、refine、analyze、conclude 都应以它为准。
不要从默认文件名猜测真实产物。

### 18.4 `checks`

包含 deterministic checks：

- `dummy_data_signals`
- `statistics_warnings`
- `artifact_warnings`

这些会影响 validate 和 conclude 的可信度。

### 18.5 `events`

每个 tool 完成后追加结构化 event，便于恢复时判断进度。

## 19. 开发 workflow

### 19.1 修改 shell 行为

改：

```text
internagent/workflow/level1.sh
```

典型修改：

- 新增 CLI 参数。
- 调整非交互恢复策略。
- 调整 log、timeout、usage 行为。
- 调整加载的工具列表。

修改后无需 `pi_deploy.sh`，因为 `pi_run_level1.sh` 直接调用该文件。

建议检查：

```bash
bash -n internagent/workflow/level1.sh
./pi_run_level1.sh --help
```

### 19.2 修改配置解析

改：

```text
internagent/workflow/agent_config.py
```

修改后检查：

```bash
python3 internagent/workflow/agent_config.py merged config.yaml
python3 internagent/workflow/agent_config.py level1 pi_args config.yaml
python3 internagent/workflow/agent_config.py workflow debug_disk_writes config.yaml
```

如果 deploy 依赖新字段，改完后需要：

```bash
./pi_deploy.sh
```

### 19.3 修改 extension

改源文件：

```text
internagent/pi/extensions/neuroscientist-level1/index.ts
internagent/pi/extensions/neuroscientist-level1/prompts/*.md
```

然后部署：

```bash
./pi_deploy.sh
```

确认部署目录已更新：

```bash
diff -qr \
  internagent/pi/extensions/neuroscientist-level1 \
  .pi/extensions/neuroscientist-level1
```

注意：`config.json` 是部署时生成的，diff 时它可能只存在于 `.pi` 目录。

### 19.4 修改 prompt

改：

```text
internagent/pi/extensions/neuroscientist-level1/prompts/entry.md
```

然后：

```bash
./pi_deploy.sh
```

prompt 修改风险很高，因为它控制主 agent 行为。修改时重点检查：

- 是否仍要求先调用 `neuro_capabilities`。
- 是否仍禁止缺 metadata 时发明数据。
- 是否仍限制写入边界。
- 是否仍要求 validate 后再 conclude。
- 是否仍保留 dummy data 处理规则。
- 是否明确哪些 stage optional。

### 19.5 修改 targeted skill

改：

```text
internagent/modules/targeted_skill/
library/skills/
```

通常不需要 `pi_deploy.sh`，因为 extension 运行时直接调用项目里的 Python
脚本和 skill 目录。

但如果修改了 `config.yaml` 中 targeted skill 参数，需要：

```bash
./pi_deploy.sh
```

因为 extension 部署目录里有 baked `config.json`。

## 20. 验证 checklist

### 20.1 静态检查

```bash
bash -n pi_run_level1.sh
bash -n internagent/workflow/level1.sh
bash -n pi_install.sh
bash -n pi_deploy.sh
python3 -m py_compile internagent/workflow/agent_config.py
python3 -m py_compile internagent/workflow/summarize_usage.py
python3 -m py_compile internagent/modules/targeted_skill/resolve_targeted_skill.py
python3 -m py_compile internagent/modules/targeted_skill/rag_paper.py
```

### 20.2 配置检查

```bash
python3 internagent/workflow/agent_config.py merged config.yaml
python3 internagent/workflow/agent_config.py level1 pi_args config.yaml
python3 internagent/workflow/agent_config.py level1 timeout_seconds 5400 config.yaml
python3 internagent/workflow/agent_config.py workflow debug_disk_writes config.yaml
```

### 20.3 部署检查

```bash
./pi_install.sh
./pi_deploy.sh
test -x .tools/node/bin/pi
test -f .pi/extensions/neuroscientist-level1/index.ts
test -f .pi/extensions/neuroscientist-level1/prompts/entry.md
test -f .pi/extensions/neuroscientist-level1/config.json
test -f .pi/agent/settings.json
```

### 20.4 入口检查

```bash
./pi_run_level1.sh --help
```

### 20.5 extension 加载检查

进入交互模式后调用 `neuro_ping`，或使用一个极小任务确认 `/entry` 能看到
Level-1 tools。

### 20.6 非交互 smoke test

```bash
./pi_run_level1.sh --non-interactive \
  --query "Create a minimal diagnostic figure from the provided metadata." \
  --dataset /path/to/meta.json \
  --work_dir results/smoke/minimal
```

检查：

```bash
test -f results/smoke/minimal/state.json
test -f results/smoke/minimal/conclusions.json
```

如果没有 `conclusions.json`，检查：

```bash
cat results/smoke/minimal/workflow_timing.json
zcat results/smoke/minimal/pi_session.jsonl.gz | tail
cat results/smoke/minimal/state.json
```

## 21. 常见问题

### 21.1 `pi` command not found

原因：

- 没有运行 `./pi_install.sh`。
- `.tools/node/bin/pi` 不存在。
- 全局也没有 `pi`。

处理：

```bash
./pi_install.sh
```

### 21.2 extension 修改后不生效

原因：

- 只改了 `internagent/pi/extensions/...`，没有部署到 `.pi/extensions/...`。

处理：

```bash
./pi_deploy.sh
```

### 21.3 `.env` 缺失导致部署失败

处理：

```bash
cp .env.example .env
# 填 API key
./pi_deploy.sh
```

如果只想部署 extension：

```bash
./pi_deploy.sh --force
```

### 21.4 非交互模式报 `--query is required`

非交互模式必须显式传 query：

```bash
./pi_run_level1.sh --non-interactive \
  --query "..." \
  --dataset "..." \
  --work_dir results/...
```

### 21.5 非交互模式报 `--dataset is required`

Level-1 不允许缺 metadata 时自行发明或搜索数据。必须传：

```bash
--dataset /path/to/meta.json
```

或：

```bash
--dataset '{"key":"value"}'
```

### 21.6 运行结束但没有 `conclusions.json`

检查：

```bash
cat {work_dir}/workflow_timing.json
cat {work_dir}/state.json
ls -la {work_dir}
```

如果 `state.json` 有 `run_id`，非交互脚本理论上会自动尝试 continue 和
conclude_only。若仍失败，通常原因是：

- provider 调用失败。
- `neuro_conclude` 子 agent 超时。
- `state.json` 不完整。
- 上游没有生成可用 validation/statistics/artifacts。

可以交互恢复：

```bash
./pi_run_level1.sh \
  --query "继续完成这个 run，写出 conclusions.json" \
  --dataset /path/to/meta.json \
  --work_dir {work_dir}
```

### 21.7 validate 报没有图像 artifact

原因：

- `neuro_code` 没有生成 figure。
- coding subagent 没有在 finalize output 里声明 artifacts。
- artifact path 不存在。

检查：

```bash
cat {work_dir}/state.json
cat {work_dir}/exec.log
find {work_dir} -maxdepth 2 -type f
```

修复方向：

- 修改 `code.md` prompt，强调必须生成 figure。
- 修改 `neuro_code` artifact normalization。
- 让主 agent 根据 validation error 重试 code。

### 21.8 dummy data 被检测

原因：

- code 使用了 synthetic/random/fake/example data。
- metadata 路径不可用，coding subagent 造了替代数据。

处理：

- 提供正确数据路径。
- 用 `--path` 补充访问说明。
- 重跑或恢复 run。

不要忽略 dummy data warning；conclude 阶段会把它写入 limitations。

### 21.9 RAG 服务不可用

如果 `neuro_deep_research` 调用失败或无来源，workflow 不应整体失败。
它会写一个空背景说明并继续。若想关闭：

```yaml
workflow:
  level1:
    deep_research: false
```

修改后：

```bash
./pi_deploy.sh
```

### 21.10 targeted skill 匹配慢或不稳定

可调整：

```yaml
modules:
  targeted_skill:
    top_k: 1
    relevance_threshold: 0.3
    generate_skill_enable: true
```

或关闭：

```yaml
workflow:
  level1:
    targeted_skill_match: false
    targeted_skill_generate: false
```

修改后部署。

## 22. 设计原则

### 22.1 Shell 只负责启动，不负责科学逻辑

`level1.sh` 不实现 plan/code/validate/conclude，它只：

- 解析参数。
- 加载 Pi。
- 组装 `/entry`。
- 管理非交互恢复。
- 写日志和 timing。

### 22.2 Extension 负责状态和工具边界

`index.ts` 是唯一允许更新 run state 的地方。这样可以保证：

- 每个 stage 输出格式稳定。
- 恢复逻辑可靠。
- artifact index 可追踪。
- debug 和 usage 可汇总。

### 22.3 Prompt 负责 agent 行为约束

`entry.md` 决定主 agent 如何组织 workflow。工具只是能力，prompt 决定何时调用
和如何处理失败。

### 22.4 Python 模块负责已有领域能力

targeted skill、RAG、custom 分析工具仍保留 Python 生态，不强行改写成 TypeScript。
TypeScript extension 通过 subprocess 调用 Python，保持边界清晰。

### 22.5 所有产物进入 `work_dir`

除用户显式指定的输出路径外，Level-1 所有写入都应在 `work_dir` 内。
这保证每次 run 可复现、可调试、可删除、可归档。

## 23. 维护建议

1. 改 extension 源文件后一定运行 `./pi_deploy.sh`。
2. 改 `config.yaml` 后也运行 `./pi_deploy.sh`，确保 baked config 同步。
3. 不要手动编辑 `work_dir/state.json` 修复运行；用 `neuro_resume_run`。
4. 新增 stage 时同时改：
   - `index.ts`
   - `prompts/entry.md`
   - `config.yaml`
   - `agent_config.py` 默认值或解析逻辑
   - `level1.sh` 工具白名单
5. 新增输出 artifact 时，必须让 `neuro_code` finalize output 声明它，并写入
   `state.artifacts`。
6. 修改 validate/refine/analyze 的图像逻辑时，始终以 `state.artifacts` 为准。
7. 非交互模式必须保证最终有 `conclusions.json`，否则批处理很难判断成功。

## 24. Level-1 构建完成判定

满足以下条件，可以认为从 `Intern-NeuroScientist` 到
`agent-loop/pi_run_level1.sh` 的 Level-1 构建完成：

1. `./pi_install.sh` 能安装或识别本地 Pi。
2. `./pi_deploy.sh` 能生成 `.pi/extensions/neuroscientist-level1` 和 `.pi/agent`。
3. `./pi_run_level1.sh --help` 正常输出。
4. `./pi_run_level1.sh` 能进入交互式 Pi，且 `/entry` 可用。
5. 非交互模式能创建 `work_dir/state.json`。
6. 成功任务能生成 `conclusions.json`。
7. 失败或受阻任务也能通过 conclude 写出明确 limitation，而不是静默退出。
8. 所有关键输出都在 `work_dir` 中可追踪。
