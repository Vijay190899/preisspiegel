# Preisspiegel — Product Requirements

This document describes the target. [HANDOVER](HANDOVER.md) says what exists today.

## 1. Why this exists

An electrical contractor receives a tender for an office building: a Leistungsverzeichnis (LV) with around 1,170 positions, plus offers from several suppliers as PDF and GAEB files. Before bidding, an estimator matches every position to a product, a supplier price and a labor time, mostly by hand in a spreadsheet. It takes days.

The risk sits in a few lines. A supplier quietly offers a cabinet rated in kVA where the tender specifies amps, and the offered unit turns out too small. A cable price is quoted per 100 m and read as per metre. One such line can cost five figures.

Most positions are routine. A handful need a person. The job of this product is to tell the two apart, do the routine ones, and make every number it produces checkable in one click.

## 2. Goals and non-goals

**Goals**

1. Take a GAEB X83 tender and three supplier offers and produce a priced offer.
2. Decide the routine positions automatically and send the rest to a review queue with a stated reason.
3. Let the estimator click any number and see the place in the source document it came from.
4. Measure it: how much was automated, how often that was right, which traps were caught, what a run cost.

**Non-goals for the demo**

- Scanned PDFs and OCR.
- Reading construction plans.
- Real product catalogues (Datanorm, ETIM, BMEcat) or wholesaler integrations.
- Accounts, permissions, multi-tenant data.
- Every GAEB exchange phase. X83 in, X84 for one supplier.

## 3. The world we simulate

One fictional mid-size electrical contractor bidding on the electrical lot of a new office building, and three fictional suppliers who answered the request for prices. Names, catalogue, tender and offers are generated and documented in [DATA.md](DATA.md). Nothing is taken from a real company.

## 4. Users and jobs to be done

**The estimator** (Kalkulator). Knows the trade, is short of time, and is personally accountable for the number on the bid. Wants to spend attention where judgment is needed and to be able to defend every figure.

## 5. Core flows

**F1 Overview.** Opening a tender shows how many positions were priced automatically, how many need a decision, and the euros at risk in the open ones.
_Accepted when:_ the split, the count and the sum match the underlying rows.

**F2 Review queue.** Open positions are listed by euros at risk. Each shows its reason code and the evidence. The estimator moves and decides from the keyboard.
_Accepted when:_ a decision updates the overview without a reload, and every reason code has a plain-language explanation with the numbers shown.

**F3 Position detail.** The LV text with the extracted attributes highlighted, the supplier comparison (the Preisspiegel), and the source viewer.
_Accepted when:_ clicking a price, quantity or labor time opens the source at the right page with the right region outlined.

**F4 Kalkulation.** Unit price as material plus labor plus surcharge. A control for the copper notation shows what the surcharge does to the total.
_Accepted when:_ every component is clickable to its source and the total is the sum of its parts.

**F5 Run.** Processing is visible as it happens, position by position, with the cost so far.
_Accepted when:_ a recorded run replays with no model calls, and a live run stays inside its budget.

## 6. Prioritisation

**Must:** F1, F2, F3, the benchmarks B1–B3, the public URL, the swappable model layer.

**Should:** F4 with the copper control, F5 replay, the English toggle, a `/bench` page.

**Cut first, in this order:** upload your own X83, X84 export, the investigator agent, B4, the showcase animation, the English toggle, the `/bench` page, the copper control, the third supplier format.

## 7. UX principles and design direction

**Principles**

- **Attention is the scarce resource.** The default view is what needs a decision, sorted by what it costs to get wrong.
- **Show the arithmetic.** A flag without its numbers is an opinion.
- **One click to the source.** If a figure cannot be traced, it is not shown.
- **Calm first.** One headline, one sentence and one action per view. Detail opens when it is asked for: an offer row unfolds, a long description reads on, the source appears beside the number that was clicked.
- **German first.** Domain terms stay as the trade uses them.

**Direction: "Schaltplan"**

The people this is for read single-line diagrams and stand in front of switch cabinets, so the interface borrows from both. It replaces an earlier drawing-sheet direction that read as plain and crowded (ADR-26).

| Element             | What it borrows                                                  | Where                                                                                                                       |
| ------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Single-line diagram | Incomers feed a busbar; feeders go out below it through switches | The overview: the offers feed the Leistungsverzeichnis, and each title is a feeder whose bar is as long as it has positions |
| Mounting plate      | The perforated plate a cabinet's modules are fixed to            | The background, lit from above                                                                                              |
| Modules             | The units mounted on the plate                                   | The offers of a position, a document excerpt                                                                                |
| Pilot lamps         | The small lamps that show a panel's state                        | An offer that was read in, a caution; later the status of every position                                                    |
| Conductor           | Copper carries the current                                       | The open position in the list, the one primary action, an energised feeder                                                  |
| Checker's mark      | A box drawn round a value on a document                          | Where a number was read: on the page, on the number that was clicked, and beside the panel's label                          |

- **Themes:** light is the grey switch cabinets are painted in, with graphite text; dark is graphite with brighter copper. Both are designed, neither is an inversion of the other. A PDF page is shown as dark paper in the dark theme.
- **Colour:** graphite does the work. Copper appears only where something is energised or is the next thing to do. Green means a person signed it off, blue means the system settled it, red means it needs a decision, amber is a caution. Side by side they sit in the order green, blue, red, which passes the colour-blindness check; green beside red does not (ADR-22).
- **Type:** Archivo, one variable family whose width is the expressive axis: wide for a headline, narrow for a caption. IBM Plex Mono for codes only: ordinal numbers, article numbers, file contents. Labels are never set in capitals.
- **Motion:** one sequence, on the overview: the diagram switches on (incomers, busbar, feeders, about two seconds) and then stays still. Everywhere else motion answers an action. The list's marker glides to the position that was opened. When a number is traced, the list gives its room to the document, a light passes down the page, and the mark draws itself where the light reaches the value. Transitions take 140 to 460 ms; the switching-on sequence and the page scan are longer on purpose. With `prefers-reduced-motion` every view is in its final state at once.
- **Keyboard:** ⌘K jumps to a position by ordinal number or text. J and K step through the list. The list is one Tab stop with the arrow keys inside it. Esc closes the source. The review queue will be fully keyboard-driven.
- **Accessibility:** a test checks the contrast of every colour pair in use, in both themes (`apps/web/src/styles/tokens.test.ts`). Visible focus, no meaning by colour alone, no horizontal overflow at 390 px.

Tokens live in `apps/web/src/styles/tokens.css`. `pnpm shots` checks every route at 390, 1024, 1280 and 1440 px in both themes. `pnpm probe:ui` checks what a screenshot cannot: keyboard access, focus, hand-typed addresses, units and reduced motion.

## 8. Functional requirements

1. Parse GAEB DA XML X83 into positions with hierarchy, short text, long text, quantity and unit.
2. Parse supplier offers from PDF (two layouts) and GAEB X84 into lines, keeping the location of each field.
3. For each position, find candidate offer lines, extract typed attributes with verbatim quotes, and propose a match.
4. Verify every quote against the source text. Drop attributes that fail and flag the position.
5. Run deterministic checks and assign reason codes. Auto-accept only when all pass.
6. Price each position and keep the breakdown and its evidence.
7. Record every model call with tokens and cost. Enforce a daily and a per-run budget.
8. Record a run as an event log that can be replayed.

## 9. Benchmarks

| ID  | Measures                                                                         |
| --- | -------------------------------------------------------------------------------- |
| B1  | Auto-priced share, auto-accept precision, euro error in auto-accepted lines      |
| B2  | Trap recall per trap type, review-queue precision                                |
| B3  | Share of displayed numbers that resolve to a source region containing that value |
| B4  | Matcher alone vs matcher plus escalation: queue size, precision, cost and time   |

Ground truth comes from the generator. Results are committed with provider, model IDs, seeds, n and git SHA.

## 10. Success criteria

A visitor can, in two minutes and without instructions: see the split, open the undersized cabinet, read why it was flagged, click a price through to the supplier's PDF, and find the measured results.

## 11. Risks

| Risk                                                   | Mitigation                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Synthetic offers are too clean and inflate the numbers | The generator adds abbreviations, packaging units, missing lines and alternatives; DATA.md says what is synthetic |
| The small model struggles with technical German        | Better candidates and prompt first, then more positions to the queue, then escalation if a benchmark supports it  |
| PDF coordinates are unreliable                         | Rebuild rows from text positions; fall back to a known layout map                                                 |
| A public demo spends the API budget                    | Replay mode by default, access code for live runs, budget guards                                                  |
