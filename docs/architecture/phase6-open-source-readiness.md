# Phase 6: open-source readiness

Phase 6 prepares the `0.1.5` source tree for external review and repeatable
validation. It does not publish an npm package, create a tag, or push changes.

## Completed controls

- User-specific filesystem paths were replaced with repository-relative paths
  or explicit environment variables.
- Private relay and RAG service addresses were removed from defaults.
- Paper RAG is opt-in and requires an explicitly configured endpoint.
- README installation, startup, configuration, and validation instructions now
  describe the canonical SeekBrain launcher and Node 24 workflow.
- Contribution, security, notice, and third-party dependency documents exist.
- CI runs doctor, typecheck, unit/contract tests, the source audit, and
  `npm pack --dry-run` on Node 24.
- The package `files` allowlist prevents archived sources, benchmark helpers,
  runtime output, and local configuration from entering a release tarball.
- Generated/vendored skill corpora under `library/` and `.pi/skills/` are not
  release inputs and are excluded from the source audit and pack allowlist.

## Release policy

The repository version remains `0.1.5`. The root package remains private until
maintainers explicitly choose an npm package name and support contract. A source
release may use `v0.1.5`; prerelease validation must use `v0.1.5-rc.1`.

External publication, tag creation, and remote pushes require an explicit
maintainer action after reviewing the generated pack manifest.

## Known license follow-up

`@pi-archimedes/diff@1.7.1` does not declare a license in its installed package
metadata. Its status is recorded in `THIRD_PARTY_NOTICES.md` and must be resolved
before distributing a bundled binary that contains that dependency.
