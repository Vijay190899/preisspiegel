# Data Sources and Honesty Notes

Preisspiegel uses **synthetic data only**. Nothing is collected from, or copied from, a real contractor, supplier, manufacturer or tender. Every synthetic element is labelled here and in the UI.

Status: the generator arrives with milestone M1. This file states the rules it follows and is filled in as each dataset lands.

| Dataset                                                                                                       | Source                                  | Use                                     | Status |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------- | ------ |
| Product catalogue: about 300 products in about 12 electrical classes, with typed attributes and labor minutes | Generated (`data/`)                     | What positions and offer lines refer to | M1     |
| Leistungsverzeichnis: 1,170 positions, GAEB DA XML X83                                                        | Generated from the catalogue            | The tender                              | M1     |
| Supplier offers: two PDF layouts and one GAEB X84                                                             | Generated from the catalogue, reworded  | What positions are matched against      | M1     |
| Planted traps: about 60, of eight kinds                                                                       | Generated, recorded in the ground truth | What the checks must catch              | M1     |
| Ground truth                                                                                                  | Written by the generator                | Scoring B1–B3                           | M1     |

## Honesty notes

- **The tender is not real.** Texts are written to read like an electrical LV, but the building, the contractor and the suppliers do not exist.
- **Labor minutes and prices are invented.** They are plausible, not sourced from any published time-value table or price list.
- **The benchmarks score the pipeline against the generator that wrote the data.** The generator and the matcher share the catalogue and nothing else: offer texts are reworded with abbreviations, article numbers and packaging units, and some lines are missing or substituted. That is still easier than real documents, and the README says so next to the numbers.
- **No scanned documents.** Every PDF has a text layer.

## Pipeline

`pnpm seed` (M1) is idempotent and seeded. The same seed produces byte-identical files, which are committed under `data/seed/` so the demo never depends on a generation step at deploy time.
