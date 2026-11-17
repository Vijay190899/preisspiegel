# Data Sources and Honesty Notes

Preisspiegel uses **synthetic data only**. Nothing is collected from, or copied from, a real contractor, supplier, manufacturer or tender. Every synthetic element is labelled here and in the UI.

Everything below is generated from one seed by `data/src/` and committed under `data/seed/`.

| File                     | What it is                                                                                                                                                                        | Size   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `tender.x83`             | The Leistungsverzeichnis as GAEB DA XML, phase 83: 11 titles, 62 subtitles, 1,170 positions                                                                                       | 1.2 MB |
| `angebot-rheinbogen.pdf` | A full-range wholesaler's offer: 806 lines on 16 pages in shorthand, priced per price unit. 758 lines name their position; 48 quote bulk material by article and name no position | 0.3 MB |
| `angebot-kesselried.pdf` | A lighting and device specialist's offer: 79 lines on 4 pages, one line per article with the quantity added up across floors, list price and discount, no position references     | 37 KB  |
| `angebot-osterholt.x84`  | A third supplier's answer as GAEB phase 84: the tender's own positions with a unit price on 826 of them                                                                           | 1.3 MB |
| `zeitwerte.json`         | The contractor's labor time table: 44 entries in minutes per unit                                                                                                                 | 6 KB   |
| `truth.json`             | Ground truth for the benchmarks. The pipeline never reads it and it is not loaded into the database                                                                               | 0.8 MB |

## What the generator builds

- **A catalogue of 254 products** in 29 groups: circuit breakers, residual-current devices, switchgear, cabinets, cables, trays and conduits, switches and sockets, luminaires, emergency lighting, data network, earthing and surge protection, plus 7 items of the contractor's own work that no supplier quotes. Each product has typed attributes and three wordings: the planner's, the wholesaler's shorthand and the manufacturer's listing.
- **The tender.** An office building with seven floors. Most subtitles repeat per floor, so the same article is asked for several times with different quantities. The long text of a position also says where it is installed, so two positions for the same article do not read identically.
- **Three offers** that cover the tender only partly. 41 positions have no offer at all, 247 have one, 603 have two and 279 have three.
- **One price per article per supplier.** A supplier is a little above or below its usual level for a kind of product, article by article, so which supplier is cheapest changes from position to position.
- **Lines that name no position.** The specialist quotes by article. So does the wholesaler for trays, conduits, switches and sockets. Such a line carries the quantities of every position that asks for the article, added up. 127 of the 1,711 offer lines are of this kind, and 134 positions are named by no line at all.
- **Sixty traps**, each a line altered the way real offers go wrong:

| Trap                  | Count | What was done                                                                                                                                                         | Supplier                           |
| --------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `SPEC_MISMATCH`       | 12    | An article that differs in one attribute that matters: rated current (6), protection class (2), luminous flux (2), and one each of cross-section and number of fibres | Wholesaler 10, specialist 2        |
| `UNIT_BASIS`          | 8     | Quoted in rings or packs where the tender counts metres or pieces, with nothing to say how much one holds                                                             | Wholesaler                         |
| `PRICE_OUTLIER`       | 8     | The decimal point one place off                                                                                                                                       | Wholesaler 4, specialist 1, GAEB 3 |
| `QTY_MISMATCH`        | 8     | Priced for a tenth, half, three times or ten times the quantity asked                                                                                                 | Wholesaler 4, GAEB 4               |
| `ALTERNATIVE_PRODUCT` | 8     | Another make, a little cheaper, marked as such in one of three ways (`Alternativ:`, `Alt.:`, `abweichend:`)                                                           | Wholesaler 6, specialist 2         |
| `NO_OFFER`            | 8     | Removed from every supplier                                                                                                                                           | —                                  |
| `AMBIGUOUS`           | 4     | Two lines for one position at different prices, neither marked as an alternative                                                                                      | Wholesaler                         |
| `ARITHMETIC`          | 4     | Quantity times price is not the printed total, by a tenth or more                                                                                                     | One or two per supplier            |

Altered lines per offer: 38 of the wholesaler's 806 (4.7%), 6 of the specialist's 79 (7.6%) and 8 of the 826 priced GAEB positions (1.0%). A line that names no position answers several, so one altered line there affects all of them.

- **Clean lines that look like traps.** 107 lines carry the surface of a trap with nothing wrong underneath, so that no trap can be told from a clean line by its looks:

| Oddity    | Lines | What it looks like                                                                                              | Shares its surface with |
| --------- | ----- | --------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `PACK`    | 16    | Quoted per ring or pack, with the size in the text in one of six wordings (`Ring 100m`, `VE=10`, `10er-Pack` …) | `UNIT_BASIS`            |
| `SPLIT`   | 24    | One position on two lines of the same article and price whose quantities add up (12 positions)                  | `AMBIGUOUS`             |
| `ROUNDED` | 20    | A quantity rounded up to a round number, by at most 30%                                                         | `QTY_MISMATCH`          |
| `CENTS`   | 37    | A line total a cent or two off quantity times price                                                             | `ARITHMETIC`            |
| `PE1000`  | 10    | Priced per 1000 where the supplier usually prices per 100                                                       | `UNIT_BASIS`            |

**The featured position** is `01.01.0020`: the tender asks for a site distribution cabinet rated 250 A, and the wholesaler's first line offers one stated as 138 kVA. Site cabinets are sold by apparent power, and 138 kVA is the 200 A size. It is the cheaper of two offers by 391.49 €, which is what makes it a decision.

## What the ground truth says

For every position: the product it asks for, the labor minutes per unit, every offer line that answers it with its price per tender unit, and what a careful estimator would conclude.

**The rule, in one sentence: a position needs a person exactly when its cheapest offer is not a clean one.**

- An offer is _clean_ when it is for the product that was asked for and carries no trap.
- A line that names a position is an offer for that position. A line that names none offers its article to every position that asks for it, and is also an offer, of the wrong product, for the positions it was quoted against where an article was substituted.
- A trapped offer that is dearer than a clean one changes nothing about the price that goes into the bid. It is _noted_ and nobody is asked.
- A trapped offer is a decision when it is cheaper than every clean one, when its price per unit cannot be worked out (a pack of unknown size), or when there is no clean offer.
- A price far off the only other one is a decision whichever of the two is the dearer: with two suppliers nobody can say which is wrong.

That gives, for this tender:

- **1,078 positions (92.1%) price without a person**, at the cheapest clean offer.
- **92 positions (7.9%) need a decision:** 51 because of a trapped offer, 41 because nobody quoted them (8 planted, 7 the contractor's own work, 26 that fell through every supplier's coverage).
- **21 positions** carry a trap that is only noted.

## What the benchmarks show

`pnpm bench` scores a run against this ground truth. The results are in [`bench/results/`](../bench/results), the first run ever scored is kept in `bench/results/baseline/`, and the same benchmarks on a tender the pipeline had never seen are in `bench/results/heldout-119/`.

| Measure                                   | No reader     | First run          | Demo tender, now | Unseen tender (seed 119) | Perfect reader, unseen |
| ----------------------------------------- | ------------- | ------------------ | ---------------- | ------------------------ | ---------------------- |
| Priced without a person (expected)        | 84.9% (92.1%) | 85.6% (91.4%)      | 92.1% (92.1%)    | 91.6% (92.3%)            | 91.7% (92.3%)          |
| B1 of those, rightly so                   | 97.5%         | 99.8%              | 100%             | **99.4%**                | 100%                   |
| B1 euro error over the auto-priced part   | 53,218 €      | 196 € of 665,815 € | 0 €              | **0 €** of 786,171 €     | 0 €                    |
| B2 planted traps found on their line      | 39 of 60      | 54 of 60           | 60 of 60         | **57 of 60**             | 59 of 60               |
| B2 expected reviews found (recall)        | 72.8%         | 99 of 101 (98.0%)  | 92 of 92         | **84 of 90 (93.3%)**     | 100%                   |
| B2 reviews raised that belong (precision) | 37.9%         | 99 of 168 (58.9%)  | 92 of 92         | **84 of 98 (85.7%)**     | 92.8%                  |
| B3 shown numbers found at their source    | —             | 6,567 of 6,577     | 6,604 of 6,604   | 6,583 of 6,583           | —                      |
| Model calls, cost, time                   | 0             | 787, $0.37, 7 min  | 880, $0.38       | 731, $0.34, 7 min        | 0                      |

- **No reader** reads no text: a line is for the position it names and for nothing else. That is what a few plain rules amount to, and it is the floor. **Perfect reader** answers every question from the ground truth and is the ceiling the checks and the triage can reach; it is a measuring device, never a pipeline step.
- **First run** is the first full run on `claude-haiku-5-5`, before anything was changed in response to a result. It ran on an earlier state of the generator, which expected 1,069 and 101.
- **Demo tender, now** is the tender in `data/seed/`, after the changes below. Its answers were bought once (880 calls) and are replayed from the answer cache.
- **Unseen tender** is the one to judge by. See the next section.

### What changed after the first run, and why the demo tender's score is not the headline

The first run was too cautious (168 reviews raised, 101 expected). Looking at why led to changes in four places, all made while looking at this tender's ground truth:

1. **A check of mine overruled the model wrongly.** It compared `3000 K` with the lamp code `830` as two numbers and called the luminaire a different product, 25 times. Code now decides between a bare number and a measure only when they are equal; otherwise the reading stands.
2. **The model exposed a bug in the generator.** Five "missed" pack traps were lines whose article name already says `RG100`. The model read the ring size from it, correctly; the generator had not meant it as one and had priced some as rings of 50. The generator no longer quotes such an article in rings of another or unknown size.
3. **The model does not answer the same question the same way every time.** The long text of a position ends with where it is installed, so two positions for one article are two slightly different questions, and for a few of them the model left a line open, or called it a different product for a reason that made no sense (`Montageart: Aufputz` against the brand name `Tastwerk`). A line that names no position carries the quantities of all its positions added up, so its quantity can settle this: if whole groups of positions with the same short text add up to it, and only one choice of groups does, those are the line's positions. A difference found by arithmetic is never overruled this way.
4. **The prompt** gained three sentences: lamp colour codes, near-identical variants to check before answering "same", and what counts as a pack size.

With those, the demo tender agrees with its ground truth on every position. That says the pipeline _can be brought to_ agree with a tender it was worked on, not what it does unprepared. So a second tender was generated from another seed (119: other quantities, other lines trapped, other gaps in coverage), loaded, run once and scored, with nothing changed in between (`pnpm bench:heldout`). Its numbers are the bold column.

### Where it fails on the unseen tender

All 20 disagreements are in one title, lighting, and have one cause.

- The specialist quoted one luminaire in place of another on three lines. A substituted line names no position, so it is recognised by its quantity: it has to equal what the positions it nearly matches add up to. Luminaires come in variants that share a short text (the same downlight in IP 20 and IP 44), and for these the quantities did not single out one group. Three substitutions went unnoticed, on 6 positions. Those positions are still priced at the valid offer, which is why the euro error is zero; what is lost is the question whether the cheaper, different luminaire would do.
- The same lines then had quantities nothing accounted for, and 14 positions that ask for the article they do offer were sent to review with `QTY_MISMATCH`, needlessly.
- A perfect reader on that tender still raises 7 needless reviews and misses one of the three. So this is a limit of attributing by quantity, not only of the model's reading. Telling such variants apart needs the long text compared attribute by attribute per position, which the answers already contain; using them for the grouping is the next thing to do here.

### Other limits of these numbers

- **The unseen tender is unseen in its numbers, not in its language.** It comes from the same generator and catalogue, so the model had seen the same articles and the same ways of abbreviating them. Real offers vary far more.
- **The benchmarks score the pipeline against the generator that wrote the data.** They share no code beyond the file readers, and the pipeline never reads `truth.json`, but the notion of what a trap is comes from one head.
- **The search was set by measuring it here.** How many lines without a reference are put to the model per supplier (3), and the rule that drops a result scoring under half of what its line reaches elsewhere, were chosen because they kept every true offer on this tender (722 of 722) while dropping two thirds of the rest.
- **B3 is exact match now.** A rectangle has to hold the number and nothing else, for quantity, price, price unit, list price, discount and total of every offer line, and for every position's quantity. It says the number is where the interface points; it does not say the number is right.
- **Labor is not priced yet.** The run prices material. The labor time table is loaded and waits for M3.

## Honesty notes

- **The tender is not real.** Texts are written to read like an electrical LV, but the building, the contractor, the suppliers and the brands do not exist. Each invented name was put through a web search on 2026-11-16, and three were replaced because they came too close to a real business. No business was found under the exact names used; a common surname such as Osterholt will have namesakes. Any resemblance is coincidental.
- **Labor minutes and prices are invented.** They are plausible, not taken from any published time-value table or price list.
- **The split was chosen, not discovered.** How many positions need a decision follows from how many traps were planted, how patchy the suppliers' coverage is, and the rule above. The 92.1% is what this tender expects, not a claim about tenders in general.
- **No scanned documents.** Every PDF has a text layer.
- **The GAEB files follow the DA XML 3.2 structure for the elements they use** (project info, ordinal-number breakdown, categories, items, quantities, texts, and unit price and total in phase 84). The element names were checked against a publicly available export. The files have not been run through the official GAEB checker.
- **The readers are tested on files they were not written alongside, a little.** The GAEB reader is tested on a hand-written file with styled paragraphs, mixed text and markup, line breaks, entities, namespace prefixes and a missing quantity. The PDF reader is tested on nineteen hand-typed tables and on one offer printed to PDF by Chrome from an HTML table (`data/fixtures/`), which it reads line for line. That is one foreign layout, not a survey of what ERP systems print.

## Pipeline

```bash
pnpm seed generate   # writes data/seed/ from the seed; same seed, same bytes
pnpm seed load       # parses data/seed/ and loads the rows into Convex
pnpm seed            # both
```

- A test regenerates every file and compares it byte for byte with what is committed, so the committed files cannot drift from the generator.
- `load` reads the files with the same parsers an upload would go through, then replaces four tables: `tenders`, `documents`, `positions`, `offerLines`. Every offer line carries the page and rectangle, or the GAEB element, each of its fields was read from. It then clears every run of the tender, since their decisions would point at lines that are gone. The answer cache stays: it is keyed by what was asked.
- A local Convex deployment only runs while `pnpm dev` does, so `load` needs it running. Add `--prod` to load a production deployment.
