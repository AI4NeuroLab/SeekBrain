# SeekBrain 单包化与 CLI 重构方案

状态：Proposed direction / implementation plan
日期：2026-07-20
基线版本：`v0.1.3`
目标版本：`v0.2.0`；如需预发布验证，使用 `v0.2.0-rc.1`

## 1. 目标

SeekBrain 已完成领域层、工作流层和 Pi 适配层的边界拆分，但当前仓库仍保留
npm workspace、历史 launcher、`internagent/` Python bridge、评估脚本、内部数据
映射和大量与 SeekBrain 无关的 Pi extensions。当前发布包虽然有 `files` 白名单，
但还不是一个安装后即可独立使用的产品包。

本方案的目标是把 SeekBrain 收敛为一个类似 `pi-subagents` 的单 npm package，
同时提供一个类似 Codex、Claude Code 和 Hypa 的命令行入口：

```bash
npm install --global <seekbrain-package>

seekbrain
seekbrain -h
seekbrain --version
seekbrain doctor
```

核心目标：

- 安装一个 npm package 后获得 `seekbrain` 可执行命令。
- `seekbrain` 自动启动 package 自带依赖的 Pi 并只加载 SeekBrain 自身扩展，
  用户不再手写 `pi -e ...`。
- `seekbrain -h` 与 `seekbrain --help` 完全等价，只显示帮助，不启动 TUI。
- 合并当前四个 workspace package，保留模块边界但只发布一个 package。
- 删除整个 `internagent/`，不再通过该历史目录定位 launcher 或运行模块。
- 清除评估脚本、内部 benchmark 映射、`cases/`、`images/` 和无关扩展。
- package 内资源通过安装目录定位；用户输入、配置和结果通过当前工作目录定位。
- 保持当前 `neuro_*` tool schema、state、artifact 和科学工作流语义兼容。
- 发布包不得包含 benchmark、私有路径、内部 provider、运行结果或历史归档。

## 1.1 已确认的产品决策

以下内容作为本轮硬约束：

1. **发布单元是一个 npm package。** 不再分别发布 `@seekbrain/core`、
   `@seekbrain/workflows`、`@seekbrain/pi-extension` 和 `@seekbrain/cli`。
2. **命令名固定为 `seekbrain`。** npm 包名可以是无 scope 的 `seekbrain`，也可以
   是组织 scope 下的名称；无论包名如何，`bin` 始终导出 `seekbrain`。
3. **`-h` 就是 `--help`。** 两者输出、退出码和副作用必须一致。
4. **不保留 `internagent/`。** 其中仍有价值的运行能力必须迁移到 package 正式
   模块；评估、批处理映射和历史设置不迁移。
5. **不打包评估体系。** benchmark runner、scorer、GT、rubric、cases 和结果属于
   独立评估项目，不属于 SeekBrain runtime package。
6. **只保留 SeekBrain extension。** 通用实验扩展不进入目标仓库和发布包。
7. **不依赖或打包 `pi-subagents`。** SeekBrain 的隔离阶段代理由自身 Pi SDK
   adapter 执行；通用用户委派和外部 agent/skill 不属于开源核心包。
8. **移除 `@pi-archimedes/diff`。** 当前 `1.7.1` 发布物缺少明确许可证元数据和
   LICENSE 文件；使用 `diff` 与 Pi TUI 实现最小的本地 review renderer。
9. **CLI 控制面使用 Node。** Python 仅作为科学分析执行环境存在；targeted-skill、
   配置、状态和启动逻辑不得再要求 LangChain/Python bridge。
10. **本方案不自动发布。** npm publish、tag 和 push 必须在本地安装验收后由维护者
    显式授权。

## 2. 当前状态与证据

### 2.1 当前启动链

```text
pi_run_seekbrain.sh
  → internagent/workflow/seekbrain.sh
  → extensions/neuro.ts
  → packages/pi-extension/src/index.ts
  → packages/pi-extension/src/seekbrain-extension.ts
  → packages/pi-extension/src/seekbrain-runtime.ts
```

这条链同时依赖仓库根目录、shell、固定相对路径和 project-local Pi。npm 全局安装后，
用户当前目录不再是 package 根目录，因此现有路径模型不能直接复用。

### 2.2 `internagent/` 中仍在运行的内容

当前活动代码仍调用：

- `workflow/seekbrain.sh`：主 launcher。
- `workflow/summarize_usage.py`：运行结束后的 usage 汇总。
- `modules/targeted_skill/seekbrain_recipe_retrieve.py`：技能解析和生成入口。
- `modules/targeted_skill/rag_paper.py`：Paper RAG HTTP client。
- `modules/targeted_skill/save_skill.py`：技能落盘、taxonomy 和索引更新。

以下内容不属于单次 SeekBrain runtime：

- `workflow/many_seekbrain.sh`。
- `workflow/pi_mapping.tsv`，其中仍存在内部 GPFS 数据路径。
- `workflow/export_report.py`。
- `pi/agent/settings.json`。
- `modules/targeted_skill/single_skill/` 中的离线论文/仓库技能生成流水线。

因此不能先删除 `internagent/` 再修复功能；必须先替换所有活动引用。

### 2.3 参考项目结论

#### `pi-subagents`

借鉴：

- 单 `package.json` 同时声明 `bin`、`files` 和 `pi.extensions`。
- TypeScript 源码直接作为 Pi package 资源发布。
- `src/` 按 extension、slash、TUI、shared 等职责拆分。
- 测试留在仓库，但由 `files` 白名单排除。

不照搬：

- SeekBrain CLI 还必须启动 Pi，而不仅仅安装 extension。
- SeekBrain 有 prompts、default config、run state 和科学 artifact 等额外资源。

#### Hypa

借鉴：

- npm `bin` 是稳定用户入口。
- wrapper 负责解析平台/安装位置并转发参数。
- `-h`、`--version` 等 CLI 行为由产品命令自己拥有。

不照搬：

- SeekBrain 是 Node/Pi package，不需要 Hypa 的多平台 native binary 和 optional
  platform package 矩阵。
- SeekBrain CLI 应启动依赖中的 Pi JS CLI，而不是选择本地原生二进制。

## 3. 目标仓库结构

采用单 package、单 lockfile、单发布清单：

```text
SeekBrain/
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
├── LICENSE
├── NOTICE
├── THIRD_PARTY_NOTICES.md
│
├── bin/
│   └── seekbrain.mjs
│
├── src/
│   ├── extension/
│   │   ├── index.ts
│   │   ├── composition.ts
│   │   ├── runtime.ts
│   │   ├── hooks/
│   │   ├── commands/
│   │   ├── tools/
│   │   └── tui/
│   ├── core/
│   │   ├── schemas/
│   │   ├── config/
│   │   ├── state/
│   │   ├── artifacts/
│   │   ├── observability/
│   │   └── ports/
│   ├── workflows/
│   │   └── seekbrain/
│   └── targeted-skill/
│       ├── resolver.ts
│       ├── rag-client.ts
│       ├── skill-writer.ts
│       ├── taxonomy.ts
│       └── indexer.ts
│
├── prompts/
│   ├── entry.md
│   ├── plan.md
│   ├── code.md
│   ├── validate.md
│   ├── image_refine.md
│   ├── image_analysis.md
│   ├── conclude.md
│   └── save_skill.md
│
├── config/
│   └── default.yaml
│
├── docs/
│   └── architecture/
│
└── test/
    ├── unit/
    ├── contract/
    ├── integration/
    └── e2e/
```

源码依赖保持单向：

```text
CLI → Pi extension → Workflows → Core
             │             ▲
             └→ adapters ──┘
             └→ targeted-skill
```

虽然取消 npm workspaces，但不得把 core/workflows 重新合并成一个大文件。

## 4. Package 设计

目标 `package.json` 形态：

```json
{
  "name": "<confirmed-package-name>",
  "version": "0.2.0",
  "type": "module",
  "bin": {
    "seekbrain": "./bin/seekbrain.mjs"
  },
  "files": [
    "bin",
    "src",
    "prompts",
    "config",
    "README.md",
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md"
  ],
  "pi": {
    "extensions": [
      "./src/extension/index.ts"
    ]
  },
  "engines": {
    "node": ">=22.19.0"
  }
}
```

正式 runtime dependencies 至少包括：

- `@earendil-works/pi-coding-agent`：提供 Pi CLI 和 SDK。
- 与 Pi 版本匹配的 `@earendil-works/pi-tui`。
- `typebox`。
- `yaml`。
- `diff`。

`vitest`、TypeScript 和测试辅助依赖只放入 `devDependencies`。

包名必须在实施前确认 npm registry 可用性。若无 scope 名称不可用，推荐使用组织
scope，例如 `@<org>/seekbrain`；这不影响安装后命令仍叫 `seekbrain`。

## 5. CLI 契约

### 5.1 帮助语义

以下两个命令必须完全等价：

```bash
seekbrain -h
seekbrain --help
```

约束：

- 输出 SeekBrain 自己的 usage、commands、options 和 examples。
- 退出码为 `0`。
- 不读取 API key。
- 不创建 `.pi/`、`.seekbrain/`、run 或日志目录。
- 不启动 Pi、不加载 extension、不发起网络请求。
- 帮助输出必须由 snapshot test 固定。

建议帮助界面：

```text
SeekBrain 0.2.0

Usage:
  seekbrain [options]
  seekbrain run [options]
  seekbrain doctor
  seekbrain config <command>

Commands:
  run       Run a non-interactive research task
  doctor    Check Node, Pi, Python and provider configuration
  config    Inspect or initialize SeekBrain configuration

Options:
  -h, --help       Show help
  -V, --version    Show version
  --cwd <path>     Working directory
  --config <path>  Project configuration file
  --pi-arg <value> Forward one advanced argument to Pi
```

### 5.2 主命令

```bash
seekbrain
```

行为：

1. 保留调用者当前目录作为 `PROJECT_ROOT`。
2. 解析 package 安装位置作为 `PACKAGE_ROOT`。
3. 验证配置和依赖。
4. 定位依赖包中的 Pi CLI。
5. 使用 `process.execPath` 启动 Pi，避免依赖全局 `pi` 或 `.tools/node`。
6. 传入 `--no-extensions`，只显式加载 SeekBrain 自身扩展。
7. 加载 package 内 `prompts/entry.md`。
8. 保持 stdin/stdout/stderr 和退出码透传。

### 5.3 子命令

```text
seekbrain                         启动交互式 Pi TUI
seekbrain run                    非交互运行
seekbrain setup                  首次配置 provider、endpoint、Core/Fast 模型
seekbrain doctor                 环境诊断
seekbrain config show            显示配置来源，不显示 secret 值
seekbrain config init --user     创建用户配置模板
seekbrain config init --project  创建项目覆盖模板
seekbrain --version / -V         输出 package 版本
seekbrain -h / --help            输出帮助
```

建议非交互参数：

```bash
seekbrain run \
  --query "Research question" \
  --dataset /path/to/metadata.json \
  --output results/example
```

未知 SeekBrain 参数退出码为 `2`。高级 Pi 参数使用明确的 `--` 分隔符透传，避免
SeekBrain 和 Pi 的 `-h`、`--version`、`--model` 发生歧义：

```bash
seekbrain -- --model anthropic/claude-opus-4-7
```

首次交互启动在不存在可认证的 Core 模型时进入 Pi 内的 `seekbrain setup` 向导。
普通用户只选择一个主流 provider、API key 和官方/自定义 URL；Core 与可选 Fast
模型均从该 provider 的主流模型中选择。模型路由保持强模型负责
main/skill/research/plan/code/validate，Fast 模型负责 image refine/image
analysis/conclude/default helpers。未选择 Fast 时所有阶段使用 Core。跨 provider
或逐 agent 路由属于高级配置，通过用户/项目 YAML 显式覆盖。非交互运行不得等待
向导输入。

## 6. Package 与工作目录边界

必须区分三类路径：

```text
PACKAGE_ROOT
  npm 安装目录，只读
  src、prompts、default config

PROJECT_ROOT
  用户执行 seekbrain 时的 cwd
  项目配置、输入路径和可选项目技能

RUN_ROOT
  --output/work_dir 指定的结果目录
  state、events、code、figure、validation、conclusions
```

禁止：

- 使用 `process.cwd()` 定位 package 内 prompt 或源码。
- 在 `node_modules/<package>` 内写状态、技能或日志。
- 假定仓库存在 `.tools/node`、`extensions/` 或 `internagent/`。
- 将全局安装目录作为用户工作目录。

配置优先级：

```text
package config/default.yaml
  < user config (~/.config/seekbrain/config.yaml)
  < project config (seekbrain.config.yaml)
  < environment variables
  < CLI arguments
```

默认配置必须使用公开 provider 语义，不得依赖 `neuro-proxy`、内部 relay 或固定
私有模型列表。secret 只从环境或 Pi 标准 auth storage 读取。

## 7. 移除 `internagent/`

### 7.1 Targeted skill 控制面迁移

将当前 Python 控制面迁移为 TypeScript：

| 当前能力 | 目标模块 |
| --- | --- |
| skill 目录扫描与匹配 | `src/targeted-skill/resolver.ts` |
| Paper RAG HTTP 请求 | `src/targeted-skill/rag-client.ts` |
| SMMT taxonomy 规范化 | `src/targeted-skill/taxonomy.ts` |
| 保存 `SKILL.md` | `src/targeted-skill/skill-writer.ts` |
| 重建 skill index | `src/targeted-skill/indexer.ts` |

模型辅助的 skill 生成通过现有 `StageAgentRunner`/Pi adapter 完成，不再由
`langchain_openai` 建立第二套模型客户端。

### 7.2 Python 的保留边界

SeekBrain 科学分析仍可能执行用户或 agent 生成的 Python 代码，因此
`seekbrain doctor` 应检查 `python3` 和项目所需科学依赖。但 package 自身的启动、
配置、skill 解析和状态机必须是 Node-only；不能因为 package 控制面而要求安装完整
`environment.yaml`。

Python 命令必须可配置：

```text
SEEKBRAIN_PYTHON=/path/to/python
```

默认按 `python3`、`python` 顺序解析，并在真正进入 Code 阶段前给出可操作错误。

### 7.3 删除条件

只有在以下检查全部满足后才删除 `internagent/`：

- 活动源码中 `rg "internagent/"` 无命中。
- Targeted skill match、RAG-disabled fallback 和 save-skill contract 通过。
- `seekbrain` CLI 不再调用 shell launcher。
- usage 汇总迁入 TypeScript observability service。
- batch/evaluation 文件已明确删除而非误迁移。

## 8. Skill library 策略

实施修订（2026-07-21）：`library/skills/trajectory` 是原版 skill-first 流程的必要
运行资源，不能删除。主 npm package 携带只读种子，并在首次 skill 解析时原子同步到
`~/.seekbrain/skills/builtin/trajectory/<version>`。RAG 生成内容写入
`~/.seekbrain/skills/from_rag`，避免写 npm 安装目录，同时支持任意 cwd 启动和跨项目复用。

默认技能目录：

```text
~/.seekbrain/skills
<PROJECT_ROOT>/.seekbrain/skills
```

可选策略：

- 主 package 发布 resolver、taxonomy 和 trajectory 只读种子。
- 官方技能库未来独立发布为可选 package，例如 `@<org>/seekbrain-skills`。
- 未安装技能库时返回结构化 `no_match`，主工作流继续执行。
- `/seekbrain-save-recipe` 默认写入用户目录，不写入 npm 安装目录。

## 9. 仓库清理清单

### 9.1 迁移后删除

```text
internagent/
packages/
extensions/
pi_run_seekbrain.sh
run_neuro.sh
pi_install.sh
pi_deploy.sh
```

删除前，SeekBrain extension、prompts、theme/footer 必要能力必须已迁入 `src/` 和
`prompts/`。删除 `packages/` 是取消 workspace，不是删除其中已经迁移的领域代码。

### 9.2 明确删除的评估与内部数据内容

```text
cases/
images/
question/
CC_v3.sh
Codex_v3.sh
Intern-v3.sh
v2.sh
v3.sh
score_outputs_v2.py
score_outputs_v3.py
comparison_vs_ours_scores.csv
q_pi_many_question_*.jsonl
pi_run_many_seekbrain.sh
pi_run_paper.sh
scripts/run_benchmark.sh
scripts/run_all.sh
scripts/eval_benchmark.sh
tests/paper-batch-launcher.mjs
tests/eval-benchmark-launcher.mjs
```

评估体系如需保留，应在删除前迁往独立、非发布的 `seekbrain-eval` 仓库；不得改名后
继续混在 runtime package。

### 9.3 删除的无关 Pi 扩展

以下实验扩展不属于 SeekBrain package：

```text
agent-chain
agent-team
coms / coms-net
cross-agent
damage-control
minimal
pi-pi
pure-focus
purpose-gate
session-replay
subagent-widget
system-select
theme-cycler
tilldone
tool-counter
```

`usage-footer` 中确属 SeekBrain 的最小功能迁入 `src/extension/tui/`。通用主题系统不
随 package 发布；SeekBrain 只保留自己的 widget/render 所需样式。

### 9.4 其他候选清理项

以下目录先做引用和许可证审计，再决定删除：

- `.pi/agents`、`.pi/skills`、`.pi/themes`。
- `assets/`。
- `custom/`。
- `library/`。
- 与 Nature Reader/Figure、Pi UI patch 相关的 specs/scripts。
- `deprecated/`。

原则：不属于 `seekbrain` CLI、SeekBrain extension、科学工作流或公开开发文档的内容
不进入目标仓库；即使暂时保留，也必须被 npm `files` 排除。

## 10. Diff review 替换

删除 `@pi-archimedes/diff`，使用已声明 BSD-3-Clause 的 `diff` 包生成结构化 diff，
并通过 Pi TUI 的 `Text`/`Box` 实现最小 renderer。

必须冻结并复验：

- code edit 和 code update 的 unified diff 内容。
- approve、feedback、cancel 交互结果。
- 窄终端降级显示。
- 非交互模式不注册 diff review tools。
- 大 diff 截断和错误 fallback。

不要求复制第三方 syntax highlighting 或 split-view 实现；先保证许可证清晰和功能
完整，再将视觉增强作为后续版本功能。

## 11. 兼容策略

必须保持：

- `neuro_*` tool 名称和主要参数。
- `state.json` schemaVersion、主要字段和迁移能力。
- artifact 文件名和目录含义。
- Plan → Code → Validate → Image → Conclude 的证据依赖。
- review、retry、resume 和多 round 行为。
- SeekBrain 自身隔离阶段代理的执行能力。

允许改变：

- 安装和启动命令改为 `seekbrain`。
- 配置文件名改为 `seekbrain.config.yaml`。
- 默认技能目录改到用户/项目 `.seekbrain/skills`。
- 删除 benchmark、batch、旧 launcher 和实验扩展。
- 删除旧 `extensions/neuro.ts`、`extensions/seekbrain/index.ts` 兼容入口。
- 删除内部 provider/model 默认配置。

不提供对 `internagent/...` 路径的 re-export 或 symlink。路径兼容会使历史目录继续
成为架构依赖，与本方案目标冲突。

## 12. 测试方案

### 12.1 CLI unit tests

- `-h` 与 `--help` stdout 完全一致。
- help/version 不启动 Pi、不写文件、不读取 secret。
- 未知参数退出 `2`。
- `--` 后参数原样传给 Pi。
- package root 和 cwd 分离。
- Windows/macOS/Linux 路径构造不依赖 shell。

### 12.2 Package contract tests

- `package.json` 同时包含 `bin`、`pi.extensions` 和 `files`。
- `bin/seekbrain.mjs` 有 shebang 和可执行权限。
- npm tarball 不含 `internagent`、评估脚本、cases、images、tests 或 secret。
- tarball 包含 extension、prompts、default config、NOTICE 和 LICENSE。
- 所有 package 内资源在改变 cwd 后仍能解析。

### 12.3 Runtime contract tests

- 保留当前 tool schema/state/artifact baseline。
- Targeted skill 的 matched/no-match/disabled/error 场景。
- Paper RAG 未配置时安全跳过。
- save-skill 只写用户或项目 skill 目录。
- SeekBrain extension 与 usage footer 各注册一次。

### 12.4 安装 E2E

CI 必须真正验证 tarball，而不只读取 manifest：

```bash
npm pack
npm install --global --prefix "$TEMP_PREFIX" ./<package>.tgz

"$TEMP_PREFIX/bin/seekbrain" -h
"$TEMP_PREFIX/bin/seekbrain" --version
"$TEMP_PREFIX/bin/seekbrain" doctor
```

再从一个不在源码树内的临时 cwd 运行 mock/non-interactive smoke，证明资源路径不依赖
repository root。

## 13. 分阶段实施

### Phase 0：冻结 package/CLI 基线（1–2 天）

- 固化 tool、state、artifact 和当前启动参数 baseline。
- 生成 keep/migrate/delete 文件清单。
- 为 `seekbrain -h`、`--version`、doctor 定义 snapshot。
- 禁止同时新增科学功能。

### Phase 1：建立单 package 骨架（2–3 天）

- 新建 `src/`、`bin/`、`prompts/`、`config/`。
- 将 core/workflows/pi-extension 源码机械迁移到一个 package。
- 修正内部 import，但保留现有行为。
- 增加 `bin`、`pi.extensions`、`files` 和 package metadata。

### Phase 2：实现 `seekbrain` CLI（2–4 天）

- 参数解析、help/version/doctor/config/run。
- 解析并启动依赖中的 Pi CLI。
- 只加载 SeekBrain 自身扩展。
- 移除对 shell launcher、`.tools/node` 和全局 `pi` 的依赖。
- 在临时安装前缀进行 CLI E2E。

### Phase 3：资源和配置自包含（2–3 天）

- prompts 与 default config 迁入 package。
- 建立 PACKAGE_ROOT/PROJECT_ROOT/RUN_ROOT。
- 移除 `neuro-proxy` 和内部模型默认值。
- 用户配置和项目配置迁移。

### Phase 4：移除 InternAgent（4–7 天）

- Targeted skill、RAG client、taxonomy、skill writer 迁移到 TypeScript。
- usage 汇总迁到 observability service。
- Python code runner 只保留科学代码执行职责。
- contract 通过后删除整个 `internagent/`。

### Phase 5：TUI dependency 和仓库瘦身（2–4 天）

- 替换 `@pi-archimedes/diff`。
- 迁移必要 usage/footer UI。
- 删除无关 extensions、评估脚本、cases、images、question 和旧 launcher。
- 审计并处理 `.pi`、assets、custom、library、deprecated。

### Phase 6：发布验证（2–3 天）

- Node 22.19 和 Node 24 CI。
- typecheck、unit、contract、integration、E2E。
- secret/license scan。
- `npm pack --dry-run` 和 tarball allowlist assertion。
- 临时全局安装后验证 `seekbrain -h`、doctor 和 mock run。
- 先发布 `v0.2.0-rc.1`；验收后再决定 `v0.2.0`。

预计工期：

- 1 名工程师：约 2–3 周。
- 2 名工程师：约 1.5–2 周，但必须先冻结 CLI 与 package contract。

## 14. 发布验收标准

- 仓库中不存在 `internagent/`、`cases/`、`images/` 和评估脚本。
- 不存在 npm workspaces 和 `@seekbrain/*` 内部发布依赖。
- `src/core` 不依赖 Pi SDK。
- `src/workflows` 不直接注册 Pi tools。
- `src/extension/index.ts` 只负责 composition、widget 和注册。
- `seekbrain -h` 与 `seekbrain --help` 输出一致、退出 `0`、无副作用。
- `seekbrain` 在任意 cwd 中能自动启动 Pi 和本 package。
- `seekbrain` 不依赖全局 `pi`、`.tools/node` 或源码仓库 shell script。
- package 控制面不依赖 Python/LangChain；科学代码执行器可使用配置的 Python。
- npm tarball 不含 tests、benchmark、private path、runtime output 和历史归档。
- `@pi-archimedes/diff` 不再出现在依赖树或 NOTICE/TODO 阻塞项中。
- 现有 tool/state/artifact contract 全部通过。
- 临时全局安装 E2E 通过。
- Node 22.19 和 Node 24 CI 通过。
- 未经授权不执行 npm publish、tag 或 push。

## 15. 建议的第一个 PR

标题：

```text
refactor: establish the standalone SeekBrain package and CLI contract
```

第一 PR 只做：

- `bin/seekbrain.mjs` 骨架。
- `seekbrain -h`、`--help`、`--version` 和参数 snapshot tests。
- 目标 `package.json` 的 `bin`、`pi` 和 `files` 字段。
- PACKAGE_ROOT/PROJECT_ROOT/RUN_ROOT 类型与 path resolver。
- keep/migrate/delete 清单和 pack contract。

第一 PR 不删除 `internagent/`，不迁移 targeted-skill，也不删除旧扩展。其目标是先建立
可验证的新入口和发布边界，后续每个迁移步骤都能通过 tarball E2E 判断是否真正脱离
源码仓库。
