# SeekBrain

## 1. Environment Setup

All tooling is installed **locally inside the project** . Run the installer once:

```bash
./pi_install.sh
```

This downloads **Node.js v24** and the `@earendil-works/pi-coding-agent` package into `.tools/`.


---

## 2. Configure the third-party base URL

### 2.1 `.env`

Copy the sample and fill in your key:

```bash
cp .env.sample .env
```

Set at least:

```bash
ANTHROPIC_API_KEY=sk-xxxxxxxx
ANTHROPIC_BASE_URL=http://<relay-host>:<port>
```
To route through a third-party relay you must add a provider override in `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "http://<relay-host>:<port>",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "compat": {
        "supportsEagerToolInputStreaming": false,
        "supportsCacheControlOnTools": false,
        "supportsLongCacheRetention": false
      }
    }
  }
}
```

---

## 3. Run

```bash
./run_neuro.sh
```

`run_neuro.sh` puts the bundled Node on `PATH`, loads `.env`, then launches `pi -e extensions/neuro.ts`.

Select NeuroScientist workflow.

```bash
/neuro
```

---

## 4. Distill skills

When a Level-1 run produces a processing method / preprocessing flow / whole pipeline worth reusing, distill it into a reusable **skill** .

In the interactive session, after a run finishes:

```bash
/neuro-save-skill
```

It reads the finished run, then an LLM proposes a name under the taxonomy
`Stage-Species-Modality-Method-Target`, drafts the skill, and asks you to confirm before writing. The controlled vocabulary lives in : [`library/skills/Neuroscience_Analysis_Skill_Taxonomy.md`](library/skills/Neuroscience_Analysis_Skill_Taxonomy.md).

Pass a `run_id` to target a specific run, and `--yes` to skip the prompt:

```bash
/neuro-save-skill <run_id> --yes
```

Saved skills land in `library/skills/from_expert/` and are **dual-registered**:

- **Auto-retrieved** by future Level-1 runs — the matcher scans this library, so a related
  question pulls the skill in automatically.
- **Invocable** in pi as `/skill:<name>` — each saved skill's own directory is
  added to `skills` in `.pi/settings.json` on save (active on the next pi launch).


---
