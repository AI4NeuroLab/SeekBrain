# SeekBrain

## 1. Environment Setup

NeuroScientist supports two Pi installation modes.

**Option A: global/home Pi**

```bash
npm install -g @earendil-works/pi-coding-agent
pi --version
```

**Option B: project-local Pi**

```bash
./pi_install.sh
```

Requirements:

```text
Node.js >= 22.19.0
Pi >= 0.80.2
```

---

## 2. Configure API

Copy the example file and fill in at least one API key:

```bash
cp .env.example .env
# edit .env
```

The `.env` format is compatible with both official APIs and relay services:

```env
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=

OPENAI_API_KEY=
OPENAI_BASE_URL=
```

URL handling is automatic:

```text
Empty or official Anthropic URL      -> provider: anthropic
Non-official ANTHROPIC_BASE_URL      -> provider: anthropic-proxy
Empty or official OpenAI URL         -> provider: openai
Non-official OPENAI_BASE_URL         -> provider: llm-proxy
```

For an OpenAI-compatible relay, set:

```env
OPENAI_API_KEY=sk-xxxxxxxx
OPENAI_BASE_URL=http://<relay-host>:<port>/v1
```

Generate the Pi API config:

```bash
./scripts/setup_api.sh
```

The setup script follows the same agent config directory that Pi uses:

```text
If PI_CODING_AGENT_DIR is set -> writes there
Otherwise                     -> writes ~/.pi/agent
```

It writes:

```text
models.json
auth.json
settings.json
```

After this, ordinary global Pi usage works from the project root:

```bash
pi -e extensions/neuro.ts -e extensions/theme-cycler.ts
```

For isolated project-local config, set `PI_CODING_AGENT_DIR` before setup and before running Pi:

```bash
export PI_CODING_AGENT_DIR="$PWD/.pi/agent"
./scripts/setup_api.sh
pi -e extensions/neuro.ts -e extensions/theme-cycler.ts
```

---

## 3. NeuroScientist UI Branding

The NeuroScientist UI patch changes the Pi startup banner to `NeuroScientist v0.1.2`, hides the generic Pi startup resource summary for `extensions/neuro.ts`, and avoids the `theme-cycler.ts` shortcut conflict.

Deploy the NeuroScientist UI:

```bash
./scripts/deploy_neuro_ui.sh
```

Restore the original Pi startup UI:

```bash
./scripts/restore_pi_ui.sh
```

The deploy script patches both possible Pi installs when present:

```text
.tools/node/lib/node_modules/@earendil-works/pi-coding-agent
~/.local/lib/node_modules/@earendil-works/pi-coding-agent
```

You can override the displayed NeuroScientist version during deployment:

```bash
NEURO_UI_VERSION=0.1.2 ./scripts/deploy_neuro_ui.sh
```

---
## 4. Run

```bash
./run_neuro.sh
```

`run_neuro.sh` loads `.env`, uses `${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}`, prefers the bundled Pi when present, and otherwise falls back to a global `pi`.

Advanced direct global-Pi launch:

```bash
set -a
source .env
set +a
export PI_CODING_AGENT_DIR="$PWD/.pi/agent"
pi -e extensions/neuro.ts -e extensions/theme-cycler.ts
```

---
