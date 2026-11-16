# Data Sources and Honesty Notes

Preisspiegel uses **synthetic data only**. Nothing is collected from, or copied from, a real contractor, supplier, manufacturer or tender. Every synthetic element is labelled here and in the UI.

Everything below is generated from one seed by `data/src/` and committed under `data/seed/`.

| File                     | What it is                                                                                                                                                                  | Size   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `tender.x83`             | The Leistungsverzeichnis as GAEB DA XML, phase 83: 11 titles, 62 subtitles, 1,170 positions                                                                                 | 1.2 MB |
| `angebot-rheinbogen.pdf` | A full-range wholesaler's offer: 994 lines on 19 pages, one line per position, in shorthand, priced per price unit                                                          | 0.4 MB |
| `angebot-kesselried.pdf` | A lighting and device specialist's offer: 80 lines on 4 pages, one line per article with the quantity summed across floors, list price and discount, no position references | 37 KB  |
| `angebot-osterholt.x84`  | A third supplier's answer as GAEB phase 84: the tender's own positions with a unit price on 847 of them                                                                     | 1.3 MB |
| `zeitwerte.json`         | The contractor's labor time table: 44 entries in minutes per unit                                                                                                           | 6 KB   |
| `truth.json`             | Ground truth for the benchmarks. The pipeline never reads it and it is not loaded into the database                                                                         | 0.8 MB |

## What the generator builds

- **A catalogue of 254 products** in 29 groups: circuit breakers, residual-current devices, switchgear, cabinets, cables, trays and conduits, switches and sockets, luminaires, emergency lighting, data network, earthing and surge protection, plus 7 items of the contractor's own work that no supplier quotes. Each product has typed attributes and three wordings: the planner's, the wholesaler's shorthand and the manufacturer's listing.
- **The tender.** An office building with seven floors. Most subtitles repeat per floor, so the same article is asked for several times with different quantities.
- **Three offers** that cover the tender only partly. 46 positions have no offer at all, 228 have one, 611 have two and 285 have three.
- **Sixty traps**, each a line altered the way real offers go wrong:

| Trap                  | Count | What was done                                                                                                                                                   | Supplier                           |
| --------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `SPEC_MISMATCH`       | 12    | An article that differs in one attribute that matters: rated current, characteristic, poles, protection class, colour temperature                               | Wholesaler 10, specialist 2        |
| `UNIT_BASIS`          | 8     | Four priced per 1000 where the supplier normally prices per 100 (still exact). Four quoted in rings or packs where the tender counts metres or pieces (unclear) | Wholesaler                         |
| `PRICE_OUTLIER`       | 8     | The decimal point one place off                                                                                                                                 | Wholesaler 4, specialist 1, GAEB 3 |
| `QTY_MISMATCH`        | 8     | Priced for a different quantity than asked                                                                                                                      | Wholesaler 4, GAEB 4               |
| `ALTERNATIVE_PRODUCT` | 8     | Another make, marked "Alternativ", a little cheaper                                                                                                             | Wholesaler 6, specialist 2         |
| `NO_OFFER`            | 8     | Removed from every supplier                                                                                                                                     | —                                  |
| `AMBIGUOUS`           | 4     | Two lines for one position at different prices, neither marked as an alternative                                                                                | Wholesaler                         |
| `ARITHMETIC`          | 4     | Quantity times price is not the printed total                                                                                                                   | One or two per supplier            |

About three in a hundred lines of each offer are altered. The specialist's lines each answer several positions, so it carries fewer traps; one altered line there still affects every position it answers.

**The featured position** is `01.01.0020`: the tender asks for a site distribution cabinet rated 250 A, and the wholesaler's first line offers one stated as 138 kVA. Site cabinets are sold by apparent power, and 138 kVA is the 200 A size.

## What the ground truth says

For every position: the product it asks for, the labor minutes per unit, every offer line that answers it with its true price per tender unit, and what a careful estimator would conclude.

- **1,062 positions (90.8%) are expected to price automatically**, at the cheapest offer that is valid and unflagged.
- **108 positions (9.2%) are expected to go to review:** 62 because an offer on them carries a trap that needs a person, and 46 because nobody quoted them (8 planted, 7 the contractor's own work, 31 that simply fell through every supplier's coverage).
- The four `UNIT_BASIS` lines priced per 1000 are expected to be priced correctly without review. They are a trap for a reader that ignores the price unit, not for an estimator.

## Honesty notes

- **The tender is not real.** Texts are written to read like an electrical LV, but the building, the contractor, the suppliers and the brands do not exist. Each invented name was searched for before it was committed, and three were replaced because they came too close to a real business. Any remaining resemblance is coincidental.
- **Labor minutes and prices are invented.** They are plausible, not taken from any published time-value table or price list.
- **The benchmarks score the pipeline against the generator that wrote the data.** The generator and the pipeline share no code beyond the file readers. Offer texts are reworded with abbreviations, trade codes (`840` for 4000 K), article numbers and price units, one supplier gives no position references, and another gives no description of its own at all. That is still easier than real documents, and the README says so next to the numbers.
- **The split was chosen, not discovered.** How many positions need review follows from how many traps were planted and how patchy the suppliers' coverage is. The 90.8% is what this tender expects, not a claim about tenders in general.
- **No scanned documents.** Every PDF has a text layer.
- **The GAEB files follow the DA XML 3.2 structure for the elements they use** (project info, ordinal-number breakdown, categories, items, quantities, texts, and unit price and total in phase 84). The element names were checked against a publicly available export. The files have not been run through the official GAEB checker.
- **The PDF table reader knows what German offers call their columns.** It finds the header row by name and reads the table under it. A layout with unlabelled columns, or one where a PDF reader merges text across columns in ways other than runs of numbers, would need more.

## Pipeline

```bash
pnpm seed generate   # writes data/seed/ from the seed; same seed, same bytes
pnpm seed load       # parses data/seed/ and loads the rows into Convex
pnpm seed            # both
```

- A test regenerates every file and compares it byte for byte with what is committed, so the committed files cannot drift from the generator.
- `load` reads the files with the same parsers an upload would go through, then replaces four tables: `tenders`, `documents`, `positions`, `offerLines`. Every offer line carries the page and rectangle, or the GAEB element, each of its fields was read from.
- A local Convex deployment only runs while `pnpm dev` does, so `load` needs it running. Add `--prod` to load a production deployment.
