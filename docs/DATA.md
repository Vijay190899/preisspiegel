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

`pnpm bench` scores a run against this ground truth. The results are in [`bench/results/`](../bench/results). The first run ever scored is kept in `bench/results/baseline/`. The same benchmarks on two tenders the pipeline had never seen are in `bench/results/heldout-119/` and `bench/results/heldout-501/`.

| Measure                                     | No reader     | First run          | Demo tender, now | Unseen, seed 119  | Unseen, seed 501 (newest) |
| ------------------------------------------- | ------------- | ------------------ | ---------------- | ----------------- | ------------------------- |
| Priced without a person (expected)          | 84.9% (92.1%) | 85.6% (91.4%)      | 92.1% (92.1%)    | 91.6% (92.3%)     | **91.9%** (92.3%)         |
| B1 of those, rightly so                     | 97.5%         | 99.8%              | 100%             | 99.4%             | **100%**                  |
| B1 euro error over the auto-priced part     | 53,218 €      | 196 € of 665,815 € | 0 €              | 0 € of 786,171 €  | **1,417 €** of 781,237 €  |
| B2 planted traps found on their line        | 39 of 60      | 54 of 60           | 60 of 60         | 57 of 60          | **58 of 60**              |
| B2 expected reviews found (recall)          | 72.8%         | 99 of 101 (98.0%)  | 92 of 92         | 84 of 90 (93.3%)  | **90 of 90**              |
| B2 reviews raised that belong (precision)   | 37.9%         | 99 of 168 (58.9%)  | 92 of 92         | 84 of 98 (85.7%)  | **90 of 95 (94.7%)**      |
| B3 numbers the readers took, at their place | —             | 6,567 of 6,577     | 6,604 of 6,604   | 6,583 of 6,583    | 6,676 of 6,676            |
| Model calls, cost, time                     | 0             | 787, $0.37, 7 min  | replayed         | 731, $0.34, 7 min | 642, $0.29, 6 min         |

- **No reader** reads no text: a line is for the position it names and for nothing else. That is what a few plain rules amount to, and it is the floor.
- **First run** is the first full run on `claude-haiku-5-5`, before anything was changed in response to a result. It ran on an earlier state of the generator, which expected 1,069 and 101.
- **Demo tender, now** is the tender in `data/seed/`, after the changes below. Its answers were bought in earlier runs and are replayed from the answer cache, so `bench/results/b1_auto_pricing.json` shows a run with no calls. No file records what buying them cost; at the per-call cost of the recorded runs it is about 40 cents.
- **Unseen, seed 119** was run once before the search was fixed (see below). **Unseen, seed 501** was run once after it, and is the column to judge by.
- Both unseen runs took some answers from the cache: a question that reads the same on two tenders is asked once (382 of 1,113 answers on seed 119, 480 of 1,122 on seed 501). The same article in the same wording is the same question, so this is the cache working as designed, but it does mean the model answered fewer new questions than the tender has.

### What changed after the first run, and why the demo tender's score is not the headline

The first run was too cautious (168 reviews raised, 101 expected). Looking at why led to changes in four places, all made while looking at this tender's ground truth:

1. **A check of mine overruled the model wrongly.** It compared `3000 K` with the lamp code `830` as two numbers and called the luminaire a different product, 25 times. Code now decides between a bare number and a measure only when they are equal; otherwise the reading stands.
2. **The model exposed a bug in the generator.** Five "missed" pack traps were lines whose article name already says `RG100`. The model read the ring size from it, correctly; the generator had not meant it as one and had priced some as rings of 50. The generator no longer quotes such an article in rings of another or unknown size.
3. **The model does not answer the same question the same way every time.** The long text of a position ends with where it is installed, so two positions for one article are two slightly different questions, and for a few of them the model left a line open, or called it a different product for a reason that made no sense (`Montageart: Aufputz` against the brand name `Tastwerk`). A line that names no position carries the quantities of all its positions added up, so its quantity can settle this: if whole groups of positions with the same short text add up to it, and only one choice of groups does, those are the line's positions. A difference found by arithmetic is never overruled this way.
4. **The prompt** gained three sentences: lamp colour codes, near-identical variants to check before answering "same", and what counts as a pack size.

With those, the demo tender agrees with its ground truth on every position. That says the pipeline _can be brought to_ agree with a tender it was worked on, not what it does unprepared. So a second tender was generated from another seed (119: other quantities, other lines trapped, other gaps in coverage), loaded, run once and scored (`pnpm bench:heldout`).

The order of these steps rests on file times, not on git: the M2 work was committed in three commits within one second, and the result files carry the id of a commit that does not contain the pipeline. The prompt file was also saved once more after the seed-119 run. The answer cache is keyed by a prompt version kept by hand, so nothing but that version number shows that the committed prompt is the one that answered.

### What the audit of M2 found in the search, and the fix

The first write-up of the seed-119 run named one cause for every miss: luminaire variants that share a short text. The independent audit of M2 showed that this was wrong for the misses that matter.

- **The real cause.** Where a supplier quotes one article in place of another, by article and with the quantities of all positions added up, the line's text leads to its own product and not to the positions it was quoted for. The search put only its three best lines per supplier to the model, and such a line was not among them. On seed 119 the specialist's 1500 mm pendant, quoted in place of a 625 mm panel on 7 positions, ranked seventh or eighth. No reader ever saw it, so no reader could have caught it.
- **How general it was.** The search had been set by measuring it on the demo tender, where it happened to keep every true offer (722 of 722). On six other tenders it lost 6 to 11 of them each, and a perfect reader agreed with the ground truth on none of the six.
- **The fix (ADR-45).** A line's quantity still says what it was quoted for: it is the total of exactly those positions. A line whose quantity is the total of one kind of position, and of at most two kinds in the whole tender, is now put to the model for that kind as well. Whether it is the right product is still read by the model and decided by the checks.
- **What it did.** On those six tenders no true offer is lost any more, and a perfect reader agrees with the truth on every position of five. The sixth has a line quoted for part of a kind beside another line of the same supplier, which the rule that a kind stands or falls together cannot resolve.

`pnpm bench:seeds` runs the two model-free readers on other tenders, without writing anything and without a model. On eight tenders nobody had looked at (seeds 431 to 438), after the fix:

| Perfect reader, eight unseen tenders                            | Result                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| True offers the search never showed to a reader                 | 0 on all eight                                                |
| Tenders where it agrees with the ground truth on every position | 6 of 8                                                        |
| Seed 432                                                        | prices 7 positions that needed a person, finds 59 of 60 traps |
| Seed 437                                                        | raises 5 needless reviews, finds 59 of 60 traps               |

So the checks and the attribution still fail on some tenders even when the reading is flawless. Seeds 432 and 437 have not been looked into; whoever does should measure the next change on other seeds.

Three of the audited seeds are now a test in `pnpm check` (`bench/src/seeds.test.ts`): the search must show every true offer to a reader, and a perfect reader must price nothing that needed a person.

### Where it fails on the newest unseen tender (seed 501)

Every position it priced by itself was one the truth also prices without a person, and every expected review was raised. What went wrong:

- **Seven positions are priced at a clean offer that is not the cheapest: 1,417 € too high.** Six of them ask for a 1500 mm light-band carrier with DALI. The specialist quoted it by article; the same carrier without DALI is tendered too, with the same wording up to the last word. The line was attributed to the positions without DALI, where it counted as a second, valid offer, and the positions with DALI lost their cheapest offer and were priced with the next one. The seventh is a bollard luminaire whose by-article line was not recognised.
- **Two traps were missed for the same reason:** the DALI carrier was planted as a substitution on two positions without DALI, and was taken for the right product there.
- **Five needless reviews.** Two follow from the same lines (`QTY_MISMATCH`: the quantities no longer add up once a line sits with the wrong kind). Three are the model leaving a line open that names its position: two circuit breakers and a cable quoted in two part quantities.

So luminaire variants that differ in one word remain the weak spot, as the first write-up said; it was just not the cause of what that write-up blamed on it. The error is on the safe side in money (a dearer clean offer, never an unclean one), but it is an error.

### Other limits of these numbers

- **The unseen tenders are unseen in their numbers, not in their language.** They come from the same generator and catalogue, so the model had seen the same articles and the same ways of abbreviating them. Real offers vary far more.
- **The benchmarks score the pipeline against the generator that wrote the data.** They share no code beyond the file readers, and the pipeline never reads `truth.json`, but the notion of what a trap is comes from one head.
- **The attribution leans on how the generator writes by-article lines** (audit, D2): their quantities are exact totals, rounded quantities are planted only on lines for a single position, and the pipeline's allowance for rounding (30%) is the generator's. A supplier who rounds a by-article total would defeat it.
- **Quotes and values are checked by substring** (audit, D3). A pack size "10" is accepted with the quote "(100 m/Ring)", and "50 A" with the quote "250 A". The planted cases are caught by other checks; the path is open.
- **A review counts as found whatever its reason,** and a position priced where a person should have looked adds only the price difference to the euro error (audit, D7).
- **B3 covers what the readers took from the files:** quantity, price, price unit, list price, discount and total of every offer line, and every position's quantity. A rectangle has to hold the number and nothing else. It is the same for any run. Figures worked out from those (a price per metre from a price per 100 m, a total for the tender's quantity, the euros at stake) are not covered, and neither are the values the model compared.
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
