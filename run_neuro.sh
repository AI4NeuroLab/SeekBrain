#!/usr/bin/env bash
# 启动 neuro 扩展的 pi。自动:1) 使用项目自带的 node v24  2) 读取 .env  3) 启动 pi
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# 1) 让 shebang(#!/usr/bin/env node)优先命中项目自带的 node v24,而非系统老版本
export PATH="$ROOT/.tools/node/bin:$PATH"

# 2) 读取 .env 并导出为环境变量(pi 不会自动读 .env)。这会覆盖 ~/.bashrc 里的旧值
set -a
source "$ROOT/.env"
set +a

# 3) 启动 pi(附加参数会透传,例如 --model claude-sonnet-4-5-20250929)
exec pi -e extensions/neuro.ts "$@"
