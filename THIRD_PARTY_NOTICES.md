# Third-party notices

SeekBrain depends on third-party packages distributed under their own terms.
The built-in PDF renderer also redistributes the STIXGeneral font family under
the SIL Open Font License; the complete font license is included at
`assets/fonts/LICENSE_STIX.txt`.

The direct runtime dependency metadata installed for the `0.1.4` source version is:

| Package | Version | Declared license |
| --- | --- | --- |
| `@earendil-works/pi-coding-agent` | 1.2.0 | MIT |
| `@earendil-works/pi-tui` | 1.2.0 | MIT |
| `diff` | 8.0.4 | BSD-3-Clause |
| `jiti` | 2.7.0 | MIT |
| `marked` | 16.4.2 | MIT |
| `pdfkit` | 0.17.2 | MIT |
| `pi-web-access` | 0.42.0 | MIT |
| `typebox` | 1.1.24 | MIT |
| `yaml` | 2.9.0 | ISC |
| `@earendil-works/pi-agent-core` | 1.2.0 | MIT |
| `@earendil-works/pi-ai` | 1.2.0 | MIT |
| `@earendil-works/pi-codemode` | 1.2.0 | MIT |
| `@earendil-works/pi-mcp` | 1.2.0 | MIT |
| `@earendil-works/pi-telemetry` | 1.2.0 | MIT |
| `@xterm/addon-fit` | 0.11.0 | MIT |
| `@xterm/xterm` | 6.0.0 | MIT |
| `js-yaml` | 5.5.0 | MIT |
| `next` | 16.3.8 | MIT |
| `node-pty` | 1.2.0-beta.15 | MIT |
| `proper-lockfile` | 4.1.2 | MIT |
| `react` | 19.3.1 | MIT |
| `react-dom` | 19.3.1 | MIT |
| `semver` | 7.8.5 | ISC |
| `undici` | 8.11.0 | MIT |
| `web-push` | 3.6.7 | MPL-2.0 |

Transitive dependency notices remain the responsibility of their respective
packages. Before a public binary redistribution, regenerate the dependency
inventory before release. SeekBrain's own MIT license does not replace
third-party license terms.

## Bundled command-line tools

The five platform packages (`seekbrain-tools-{linux,darwin}-{x64,arm64}` and
`seekbrain-tools-win32-x64`) include
unmodified upstream binaries. The main package depends on them optionally;
npm selects the package matching the user's OS and architecture. Source checkouts
retain verified binaries under `packages/` while GitHub Release packaging is
being prepared:

| Tool | Version | Upstream license options | Option used |
| --- | --- | --- | --- |
| fd | 10.3.0 | MIT OR Apache-2.0 | MIT |
| ripgrep | 14.1.1 | MIT OR Unlicense | MIT |

Sources: https://github.com/sharkdp/fd/tree/v10.3.0 and
https://github.com/BurntSushi/ripgrep/tree/14.1.1.
Each platform package retains copyright and license texts under `licenses/fd/`
and `licenses/rg/`. Its `manifest.json` records upstream archive URLs, archive
SHA-256 values, and checksums of bundled files. Keep these
notices with redistributed copies. The standalone installer's full Node
distribution also retains Node's license and third-party notices in
`runtime/LICENSE`.

## Bundled zebrafish example data

The files under `examples/zebrafish-sc-network-modules/dataset/` are an
unchanged, focused subset of the processed data accompanying:

Antoine Légaré, Mado Lemieux, Vincent Boily, Sandrine Poulin, Arthur Légaré,
Patrick Desrosiers, and Paul De Koninck, “Structural and genetic determinants
of zebrafish functional brain networks,” *Science Advances* (2025).

The source dataset is distributed under the Creative Commons Attribution 4.0
International License (CC BY 4.0):
https://creativecommons.org/licenses/by/4.0/

Dataset: https://doi.org/10.5683/SP3/IIVGOB

Associated code: https://github.com/pdesrosiers/Legare-zebrafish-brain-networks

See `examples/zebrafish-sc-network-modules/dataset/LICENSE_DATA.md` for the
file-level attribution included with the example.

## Pi Web Access

The optional-on-use web tools reuse the host-neutral core of `pi-web-access`
version 0.42.0, by Nico Bailon, under the MIT license.
Source: https://github.com/nicobailon/pi-web-access
The upstream package and its dependencies retain their own licenses. SeekBrain
does not load the upstream UI extension or its curator/summary workflow.

## pi-web WebUI

The WebUI under `web/` is based on agegr/pi-web 0.12.2
(commit `e533d9b3975f8a74b378d5007c92fdf4d15d3fba`), copyright 2026 agegr, licensed under MIT.
The upstream license is retained at `web/LICENSE`; upstream provenance is recorded
in `web/upstream.json`. Compiled WebUI assets are included in the main npm package.


## Planning and report skill guidance

The six Plan skills and fourteen Report skills contain authored reading and
reasoning guidance. Bibliographic references do not redistribute textbook
chapters. Textbook excerpts and scanned pages from local research materials are
not included in this source version or its distribution files.
