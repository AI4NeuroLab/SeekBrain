# Security policy

## Supported version

Security fixes currently target the latest `0.1.x` release line.

## Reporting a vulnerability

Do not open a public issue containing credentials, private datasets, exploitable
paths, or vulnerability details. Contact the repository maintainers privately
through the hosting platform's security-reporting channel. Include affected
versions, reproduction steps, impact, and any suggested mitigation.

## Credential handling

- Store provider keys only in `.env` or Pi's local authentication directory.
- Never commit `.env`, `.pi/agent/auth.json`, session logs, or generated data.
- Treat third-party relay URLs as deployment configuration, not source defaults.
- Rotate any credential immediately if it appears in a commit or build log.
