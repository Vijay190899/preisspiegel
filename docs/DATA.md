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

Altered lines per offer: 42 of the wholesaler's 806 (5.2%), 6 of the specialist's 79 (7.6%) and 8 of the 826 priced GAEB positions (1.0%). A line that names no position answers several, so one altered line there affects all of them.

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

`pnpm bench` scores a run against this ground truth. The results are in [`bench/results/`](../bench/results). The first run ever scored is kept in `bench/results/baseline/`. The same benchmarks on three tenders the pipeline had never seen are in `bench/results/heldout-119/`, `heldout-501/` and `heldout-502/`.

| Measure                                     | No reader     | First run          | Demo tender, now | Unseen, seed 119  | Unseen, seed 501     | Unseen, seed 502 (newest) |
| ------------------------------------------- | ------------- | ------------------ | ---------------- | ----------------- | -------------------- | ------------------------- |
| Priced without a person (expected)          | 84.9% (92.1%) | 85.6% (91.4%)      | 92.1% (92.1%)    | 91.6% (92.3%)     | 91.9% (92.3%)        | **91.6%** (91.8%)         |
| B1 of those, rightly so                     | 97.5%         | 99.8%              | 100%             | 99.4%             | 100%                 | **100%**                  |
| B1 euro error over the auto-priced part     | 53,218 €      | 196 € of 665,815 € | 0 €              | 0 € of 786,171 €  | 1,417 € of 781,237 € | **170 €** of 770,755 €    |
| B2 planted traps found on their line        | 39 of 60      | 54 of 60           | 60 of 60         | 57 of 60          | 58 of 60             | **60 of 60**              |
| B2 expected reviews found (recall)          | 72.8%         | 99 of 101 (98.0%)  | 92 of 92         | 84 of 90 (93.3%)  | 90 of 90             | **96 of 96**              |
| B2 reviews raised that belong (precision)   | 37.9%         | 99 of 168 (58.9%)  | 92 of 92         | 84 of 98 (85.7%)  | 90 of 95 (94.7%)     | **96 of 98 (98.0%)**      |
| B3 numbers the readers took, at their place | —             | 6,567 of 6,577     | 6,604 of 6,604   | 6,583 of 6,583    | 6,676 of 6,676       | 6,559 of 6,559            |
| Model calls, cost, time                     | 0             | 787, $0.37, 7 min  | replayed         | 731, $0.34, 7 min | 642, $0.29, 6 min    | 503, $0.24, 5 min         |

- **No reader** reads no text: a line is for the position it names and for nothing else. That is what a few plain rules amount to, and it is the floor.
- **First run** is the first full run on `claude-haiku-5-5`, before anything was changed in response to a result. It ran on an earlier state of the generator, which expected 1,069 and 101.
- **Demo tender, now** is the tender in `data/seed/`, after the changes below. Its answers were bought in earlier runs and are replayed from the answer cache, so `bench/results/b1_auto_pricing.json` shows a run with no calls. No file records what buying them cost; at the per-call cost of the recorded runs it is about 40 cents.
- **The three unseen tenders** were each generated, run once and scored. Seed 119 was run before the search was fixed, seed 501 after the first fix, seed 502 after the second (both below). Seed 502 is the column to judge by: it is the only one run on the pipeline as it is now.
- **Each unseen run took answers from earlier tenders.** A question that reads the same on two tenders is asked once, and so is a question that comes up twice in one run. Seed 502 has 856 distinct questions and made 503 calls, so 353 of its answers were bought on earlier tenders; for seed 501 it was 224 of 866. The same article in the same wording is the same question, so this is the cache working as designed, but the model answered fewer new questions than the tender has.

### What changed after the first run, and why the demo tender's score is not the headline

The first run was too cautious (168 reviews raised, 101 expected). Looking at why led to changes in four places, all made while looking at this tender's ground truth:

1. **A check of mine overruled the model wrongly.** It compared `3000 K` with the lamp code `830` as two numbers and called the luminaire a different product, 25 times. Code now decides between a bare number and a measure only when they are equal; otherwise the reading stands.
2. **The model exposed a bug in the generator.** Five "missed" pack traps were lines whose article name already says `RG100`. The model read the ring size from it, correctly; the generator had not meant it as one and had priced some as rings of 50. The generator no longer quotes such an article in rings of another or unknown size.
3. **The model does not answer the same question the same way every time.** The long text of a position ends with where it is installed, so two positions for one article are two slightly different questions, and for a few of them the model left a line open, or called it a different product for a reason that made no sense (`Montageart: Aufputz` against the brand name `Tastwerk`). A line that names no position carries the quantities of all its positions added up, so its quantity can settle this: if whole groups of positions with the same short text add up to it, and only one choice of groups does, those are the line's positions. A difference found by arithmetic is never overruled this way.
4. **The prompt** gained three sentences: lamp colour codes, near-identical variants to check before answering "same", and what counts as a pack size.

With those, the demo tender agrees with its ground truth on every position. That says the pipeline _can be brought to_ agree with a tender it was worked on, not what it does unprepared. So a second tender was generated from another seed (119: other quantities, other lines trapped, other gaps in coverage), loaded, run once and scored (`pnpm bench:heldout`).

The order of these steps rests on file times, not on git: the M2 work was committed in three commits within one second, and the result files carry the id of a commit that does not contain the pipeline. The prompt file was also saved once more after the seed-119 run. The answer cache is keyed by a prompt version kept by hand, so nothing but that version number shows that the committed prompt is the one that answered.

### What two audits found in the search and the attribution

The first write-up of the seed-119 run named one cause for every miss: luminaire variants that share a short text. Two independent audits showed how much that left out, and that the checks had been fitted to the tenders they were worked on. Both times the audit was right.

**The M2 audit: lines that never reached a reader.** Where a supplier quotes one article in place of another, by article and with the quantities of all positions added up, the line's text leads to its own product and not to the positions it was quoted for. The search put only its three best lines per supplier to the model, and such a line was not among them: on seed 119 the specialist's 1500 mm pendant, quoted in place of a 625 mm panel on 7 positions, ranked seventh or eighth. The search had been set by measuring it on the demo tender, where it happened to keep every true offer; on six other tenders it lost 6 to 11 each. The fix (ADR-45): a line's quantity is the total of exactly the positions it was quoted for, so a line whose quantity is the total of one kind of position is put to the model for that kind as well.

**The audit of that fix: it held on the seeds it was built on.** On 136 tenders nobody had named, the search still lost true offers on 21, and a perfect reader priced positions that needed a person on 20. The fix had been reported with eight tenders as evidence. Looking at the tenders the audit used (seeds 3000 to 3149) showed four causes, each of which got its own rule (ADR-48):

1. **One short text, two things.** The same downlight is tendered in IP 20 and IP 44 under one short text. A kind of position is now its short text together with the measures and codes its long text states, however they are spaced, and without where the thing is installed.
2. **A supplier need not quote every storey.** A by-article quantity that is the total of some of the positions asking for the article is accounted for, and is no longer reported as a quantity that does not fit.
3. **Two substitutions on one supplier.** A by-article line used to count as the supplier's answer to every position it read like, which hid a second line quoted in its place. It now counts only if its quantity is the total of what it matches.
4. **A price measured against another product.** A three-pole breaker offered where a one-pole one was asked for is four times the price, and that made the valid one-pole offer beside it an "outlier". A price is now compared only with offers of the same product.

A quantity that fits many kinds of position is also no longer dropped; the kinds the line reads most like are kept.

`pnpm bench:seeds <from>-<to>` runs the two model-free readers on any range of seeds, in about half a second each, without writing anything and without a model. A perfect reader answers every question from the ground truth, so whatever it gets wrong is the search, the attribution or the decision.

| Perfect reader                                          | Seeds 3000 to 3149, before              | The same, after | Seeds 5000 to 5199, after                 | Four further ranges, after                  |
| ------------------------------------------------------- | --------------------------------------- | --------------- | ----------------------------------------- | ------------------------------------------- |
| Who ran it, and on what                                 | the builder, on seeds read while fixing | the same        | the builder, once, on seeds not looked at | a third audit, on seeds of its own choosing |
| Tenders                                                 | 150                                     | 150             | 200                                       | 597                                         |
| Agrees with the ground truth on every position          | 97                                      | 147             | 198 (99.0%)                               | 582 (97.5%)                                 |
| Tenders that lose a true offer before any reading       | 22, 104 offers                          | 2, 2 offers     | 4, 9 offers                               | 4, 14 offers                                |
| Tenders where it prices a position that needed a person | 23, 122 positions                       | 3, 7 positions  | 2, 12 positions                           | 14, 45 positions                            |
| Tenders where it raises a review nobody needs           | 47, 188 reviews                         | 2, 2 reviews    | 1, 6 reviews                              | 3, 6 reviews                                |
| Tenders where it misses a planted trap                  | 45                                      | 3               | 8                                         | 26                                          |

**The figure to quote is the pooled one: 1,021 of 1,046 unseen tenders (97.6%).** The builder's first range turned out to be the most favourable of those run (the audit's four came to 96.5%, 96.0%, 98.6% and 100%; a sixth range, seeds 13000 to 13249, run on the pipeline as it is now, came to 241 of 249, 96.8%), so "198 of 200" by itself flatters. Over all 1,046, with flawless reading: a position that needed a person is priced on 23 tenders (2.2%) and a planted trap is missed on 50 (4.8%). On the first 797 a true offer was lost before any reading on 8 (1.0%); on the sixth range on 8 of 249. The audit found no sign that the rules were fitted to the seeds they were built on: the rates on fresh ranges match those on seeds 3000 to 3149.

Most of what is left is one case the rules do not handle, which the audit named: **a tie**. Where a line's quantity is at once the total of the positions asking for its own article and the total of the positions it was quoted in place of (54 and 54 on seed 5047, 115 and 115 on seed 5143), the first reading wins, the line counts as a plain offer for its own article, and the wrong-product offer for the other positions is dropped unseen. Thirty of the 36 traps a perfect reader misses on those ranges are this. **The remedy was built and measured, and is not kept (ADR-61).** Keeping the line as a flagged offer for the other kind on every tie, on seeds 13000 to 13249: tenders that price a position that needed a person fell from 7 (18 positions) to 2, tenders that miss a trap from 16 to 8, and needless reviews rose from 8 on 2 tenders to 223 on 47, about twelve needless reviews for each wrong price prevented. Those wrong prices are at a valid, clean offer from another supplier; what is lost is the sight of a cheaper wrong product. A tie cannot be told apart by arithmetic: a quantity of 1 ties with almost anything. The one tie-breaker with a reason behind it, that a supplier who answers the line's own positions with another line did not quote this one for them, never applied on those 250 tenders.

The generator still cannot plant its plan on 3 seeds in 600 and fails there.

The same sweep over twenty of the first audit's seeds is a test in `pnpm check` (`bench/src/seeds.test.ts`). It keeps what was reached. It is blind to a change in the rate and to a missed trap, and it cannot show that the rules hold elsewhere, which is what a fresh range is for.

One change was made to the generator on the way: on 14 seeds in 150 it failed because fewer lines qualified for a harmless oddity than the plan asked for. It now plants as many as there are. The demo tender is unchanged, byte for byte.

### Where it fails on the newest unseen tender (seed 502)

Every position it priced by itself was one the truth also prices without a person, every expected review was raised, and all 60 traps were found. Three positions went wrong:

- **Two needless reviews.** The model left a line open that names its position, both times a green-yellow earthing conductor quoted by the wholesaler. The position goes to review as "not clear-cut" although the line is plainly the right one. This is the model being uneven, and nothing in the checks catches it.
- **One position priced 170 € too high.** A bollard luminaire that the specialist quotes by article for a single position: the model answered "unsure" for the line, so it was not taken as an offer and the position was priced with the next valid one. The same luminaire was missed on seed 501. The error is on the safe side in money, but it is an error, and it has shown twice.

All three start in the model's answer; a perfect reader gets them right. Whether a larger model would read them correctly has not been tried.

On seed 501, run before the second fix, seven positions were priced at a valid offer that was not the cheapest (1,417 €) and two traps were missed. Six of the seven and both traps were a light-band carrier tendered with and without DALI; the seventh was this bollard luminaire. With flawless reading that tender also raised six needless reviews at the time, which the first write-up did not say.

### Other limits of these numbers

- **What a kind is rests on the long text stating its measures, in the generator's wording.** On 947 generated tenders the key separates exactly the products that are tendered. On plain rewordings it does not: it splits one kind on `im 3. OG` against `im 4. OG`, on `3.000 K` against `3000 K` and on `Montagehöhe 2,50 m`, and it merges `Polzahl: 1` with `Polzahl: 3` and `mit DALI` with `ohne DALI`. Real long texts would split kinds and quietly lose what the quantity rules add.
- **Accepting the quantity of some positions weakens a check, and no benchmark can see by how much.** For a by-article line that matches many positions, nearly any smaller quantity is the total of some of them: for seven positions of 3 to 6 pieces, 26 of 30 wrong totals pass. Quantity traps are planted only on lines for a single position, where the check is as strict as before, so the benchmarks do not measure this.
- **The unseen tenders are unseen in their numbers, not in their language.** They come from the same generator and catalogue, so the model had seen the same articles and the same ways of abbreviating them. Real offers vary far more.
- **The benchmarks score the pipeline against the generator that wrote the data.** They share no code beyond the file readers, and the pipeline never reads `truth.json`, but the notion of what a trap is comes from one head.
- **The attribution leans on how the generator writes by-article lines** (M2 audit, D2): their quantities are exact totals, rounded quantities are planted only on lines for a single position, and the pipeline's allowance for rounding (30%) is the generator's. A supplier who rounds a by-article total would defeat it.
- **Quotes and values are checked by substring** (audit, D3). A pack size "10" is accepted with the quote "(100 m/Ring)", and "50 A" with the quote "250 A". The planted cases are caught by other checks; the path is open.
- **A review counts as found whatever its reason,** and a position priced where a person should have looked adds only the price difference to the euro error (audit, D7).
- **B3 covers what the readers took from the files:** quantity, price, price unit, list price, discount and total of every offer line, and every position's quantity. A rectangle has to hold the number and nothing else. It is the same for any run. Figures worked out from those (a price per metre from a price per 100 m, a total for the tender's quantity, the euros at stake) are not covered, and neither are the values the model compared.
- **Labor is a pass of its own** (B5, below): a run prices material, and the labor pass ties each position to an entry of the labor time table.

## B4: a larger model

Whether a larger model earns its cost on what the matcher could not settle (`pnpm bench:escalation <seed> <model>`, ADR-71). A tender nobody had read (seed 90200) was run twice: by the matcher alone, and with `claude-sonnet-5-5` at effort `medium` reading again every question on which the matcher had left a line unconfirmed. Its answer was verified against each asking position's own lines and taken only for the lines the matcher left unconfirmed. Files: `bench/results/b4-90200/`.

| Seed 90200 (1,170 positions, 111 reviews expected) | Matcher alone      | With `claude-sonnet-5-5` |
| -------------------------------------------------- | ------------------ | ------------------------ |
| Positions for a person                             | 113                | 111                      |
| Priced without a person                            | 1,057              | 1,059                    |
| of those, rightly so                               | 100%               | 100%                     |
| Euro error over what was priced without a person   | 121.56 €           | 0 €                      |
| Planted traps found                                | 60 of 60           | 60 of 60                 |
| Expected reviews found                             | 111 of 111         | 111 of 111               |
| Reviews raised that belong in the queue            | 98.2%              | 100%                     |
| Model calls, cost, time                            | 502, 0.24 $, 297 s | +84, +0.90 $, +69 s      |

- 104 positions (84 distinct questions) were unsettled after the matcher; none was cut by the cap of a fifth of the tender. The larger model answered all 84.
- On this tender it removed both needless reviews and the one wrong price the matcher left, so its column matches the ground truth on every position. Together the two readings cost 4.7 times what the matcher alone did.
- One run each on one tender: it shows what a larger model can do on the matcher's leftovers, not how often. Nothing was tuned between the two runs; the prompt is the matcher's.
- The answers were paid for in a first run on 2026-11-26 whose escalation step had a fault: it checked a shared question's answer against the first asking position's lines and copied the result to the others, which made the larger model look worse (118 for a person, 148.12 €). The audit found it; the step was fixed and both arms were scored again from the stored answers, calling no model. The file keeps the paid run's calls, cost and time under `cost`.

## Labor

Every position is tied to one entry of the contractor's labor time table (`zeitwerte.json`, 44 entries in minutes per unit, invented), or to none where the work is not timed by the table (hourly work, site setup, documentation). The model proposes the entry and quotes the position; code checks that the entry exists, that the quote stands in the position at word boundaries, that the units agree, and, where the entry's label states a size or a count ("bis 2,5 mm²", "über 250 A", "1-polig"), that the position states one that fits. The size is read by code, from the words the model quoted or, if it quoted none, from the position's short text and then its long text. The minutes come from the table; hours and money are worked out from them at an hourly rate of 62 EUR, also invented. The ground truth has the entry each catalogue item takes (`laborKey`). `pnpm bench:labor` scores a pass and writes `bench/results/b5_labor.json`.

| Measure                               | Demo, first pass     | Unseen, seed 503    | Demo, now           | Unseen, seed 504 (newest) |
| ------------------------------------- | -------------------- | ------------------- | ------------------- | ------------------------- |
| Instructions                          | first version        | first version       | after the change    | after the change          |
| Tied to an entry without a person     | 1,166 of 1,170       | 1,168 of 1,170      | 1,168 of 1,170      | **1,169 of 1,170**        |
| of those, the right entry (or "none") | 1,140 (97.8%)        | 1,140 (97.6%)       | 1,161 (99.4%)       | **1,164 (99.6%)**         |
| Hours wrong, against all hours        | 104 of 10,924 (1.0%) | 91 of 11,177 (0.8%) | 46 of 10,933 (0.4%) | **42 of 11,324 (0.4%)**   |
| Model calls, cost                     | 832, $0.07           | 546, $0.05          | replayed            | 524, $0.05                |

- **What went wrong first.** On both tenders read with the first instructions, every error but one was one of two confusions (the one: a box on seed 503 called work the table does not time): a socket (`SCHUKO-Steckdose`, `Herdanschlussdose`) timed as setting an empty box, because its name contains `Dose`, and a cable manager (`Kabelrangierpanel`) timed as a patch panel. Code cannot see either: its checks know units and sizes, not what a thing is. Offered every wrong entry in a position's unit with the position's own words, the checks let 79% through on 50 tenders; the size check stops the rest. So the kind of work is the model's call, and these figures measure it.
- **What changed, once.** Two sentences in the instructions: name the work by what is installed, not by a word inside its name; and "auflegen" is for a part cables are terminated on. The socket confusion went away; the cable manager stayed (five positions on seed 504, seven on the demo). At the same time the size check learned to read the size from the position itself when the model quoted none, because with the new instructions the model often left out the quote for `1-polig` and 16 right answers went to a person. With a reader that knows the answer and quotes no size, the checks settle every position rightly on 200 tenders nobody had read (seeds 12200 to 12399), and they stop as many wrong sizes as when the size is quoted.
- **"Demo, now" was bought in a live pass** of the demo with the changed instructions, 870 calls for $0.074, before it was replayed for the committed file; no committed file records that pass.
- **The size check was tightened after these runs** (ADR-62): the position's own size now wins over the words quoted, and `1.250 A` reads as 1,250. Replayed on the demo it changes nothing; seeds 503 and 504 were not re-scored.
- **Seed 504 is the column to judge by.** It was generated after the change and read once. Seed 503 was read before it, so it is the honest figure for the first instructions. The demo was looked at for the change.
- **What reaches a person** is what the size check stops: a 400 A breaker proposed as "bis 250 A", a 5x10 mm² cable proposed as "4 bis 6 mm²". On seed 504 the one position sent to a person had a quote that was not in its text.
- **Answers are shared across tenders.** A question that reads the same is asked once, so 646 of seed 504's answers came from earlier passes.
- **Not measured:** how the labor time table of a real contractor reads, and positions whose work no entry fits that a reader would time anyway.

## The copper surcharge

The costing page works out what the price of copper adds to the bid (ADR-55). The formula and its inputs are the ones cable suppliers publish:

- **Formula:** surcharge per km = copper number (kg/km) ÷ 100 × (notation + procurement costs − copper base), all prices in EUR per 100 kg. Lapp's explanation of metal surcharges and Letronic's of the copper surcharge both give it, and each has a worked example; both examples are tests.
- **Copper base:** the amount of copper already in the list price, commonly 150 EUR per 100 kg (Letronic: "in der Regel"). The page assumes it.
- **Procurement costs:** 1% on the notation in Lapp's version, 2% in Letronic's. The page uses 1%.
- **Copper number:** a figure agreed for the calculation, not the weight of the metal (LEONI's glossary of the metal business says so in terms). For installation cable it is cores times cross-section times 9.6 kg per km, which gives the 43 kg/km printed for a 3x1.5 mm² cable.
- **Notation:** the DEL notation was suspended on 14 February 2022; suppliers have since named their own reference, often the LME price. The control therefore says "the day's notation" and starts at 950 EUR per 100 kg, about where published indices stood in late 2025.

What is assumed and not read from any document: that the demo's offers are priced on a base of 150. They state none.

Sources: [Lapp, calculating metal surcharges](https://t3.lappcdn.com/fileadmin/DAM/Miltronic_Sweden/4_Servicecenter/1_Kunskapscenter/Tekniska_dokument_2019/T17_Calculating_metal_surcharges.pdf) · [Letronic, Berechnung vom Kupferzuschlag](https://www.letronic.de/themes/letronic/assets/pdf/Berechnung%20vom%20Kupferzuschlag.pdf) · [LEONI, Glossar Metallgeschäft](https://d3ga0yfowtcnef.cloudfront.net/fileadmin/acs/files/publications/metal_business/Glossar_Metallgeschaeft.pdf) · [Rittal on the suspended DEL listing](https://www.rittal.com/gr-en/News/Copper_listing) · [VEM, DEL quotation](https://www.vem-group.com/del-quotation)

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
