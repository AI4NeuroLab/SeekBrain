# 0.1.4 source upgrade

`legacy/0.1.1` preserves the previous main at commit
`5a9ffecd02bd10fe92c39b54d475a80394c2b2a0`.
The 0.1.4 source upgrade is a normal descendant commit; history is retained.

The source tree includes the CLI, four research modes, updated research and
report workflows, Recipe retrieval, WebUI source and Windows compatibility.
Old project state is not compatible with the new workflow format.

Remote BrainArena queries, rubrics, dataset links, contribution guidance,
example data and project presentation assets are retained. The old entry and
deep_research prompts are retired in favor of the unified mode prompts.

Local credentials, caches, test environments, study results, raw benchmark
downloads, local experiment scripts, old archives and personal notes are
excluded. Plan skills retain their authored guidance and bibliographic sources;
textbook extracts and scanned pages are excluded. Verified fd/ripgrep binaries
are retained for source-checkout use, with manifests and licenses.

This source update does not publish npm packages or a GitHub Release. Public
one-line installers, automatic Python/Git Bash provisioning and platform
release bundles remain pending. Windows compatibility has local regression
coverage; the Windows workflow must be checked on GitHub.
