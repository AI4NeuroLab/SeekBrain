# Third-party notices

SeekBrain depends on third-party packages distributed under their own terms.
The built-in PDF renderer also redistributes the STIXGeneral font family under
the SIL Open Font License; the complete font license is included at
`assets/fonts/LICENSE_STIX.txt`.

The direct runtime dependency metadata installed for the `0.1.1` release is:

| Package | Version | Declared license |
| --- | --- | --- |
| `diff` | 8.0.4 | BSD-3-Clause |
| `typebox` | 1.1.24 | MIT |
| `yaml` | 2.9.0 | ISC |
| `marked` | 16.4.2 | MIT |
| `pdfkit` | 0.17.2 | MIT |
| `@earendil-works/pi-coding-agent` | 0.80.10 | MIT |
| `@earendil-works/pi-tui` | 0.80.10 | MIT |

Transitive dependency notices remain the responsibility of their respective
packages. Before a public binary redistribution, regenerate the dependency
inventory before release. SeekBrain's own MIT license does not replace
third-party license terms.

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
