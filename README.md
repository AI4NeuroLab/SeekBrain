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

---
