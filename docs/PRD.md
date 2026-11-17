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

**F4 Kalkulation.** Unit price as material plus labor plus surcharge. A control for the copper notation shows what the surcharge does to the total. Labor is the contractor's labor time table: each position takes one entry, its minutes times the quantity at an hourly rate.
_Accepted when:_ every component is clickable to its source and the total is the sum of its parts.

**F5 Run.** Processing is visible as it happens, position by position, with the cost so far.
_Accepted when:_ the stored answers can be read back in view with no model calls, and a live run stays inside its budget.

## 6. Prioritisation

**Must:** F1, F2, F3, the benchmarks B1–B3, the public URL, the swappable model layer.

**Should:** F4 with the copper control, F5 replay, the English toggle, a `/bench` page.

**Cut first, in this order:** upload your own X83, X84 export, the investigator agent, B4, the showcase animation, the English toggle, the `/bench` page, the copper control, the third supplier format.

## 7. UX principles and design direction

**Principles**

- **Attention is the scarce resource.** The default view is what needs a decision, sorted by what it costs to get wrong.
- **Show the arithmetic.** A flag without its numbers is an opinion.
- **One click to the source.** If a figure cannot be traced, it is not shown.
- **Calm first.** One headline, one sentence and one action per view. Detail opens when it is asked for: an offer's details unfold, a long description reads on, the source appears beside the number that was clicked.
- **German first, English throughout the interface.** German is the language of the tender and of the people this is for. In English the interface uses the English trade terms (bill of quantities, item), writes figures the English way, and names the tender's sections, storeys and items in English, with the tender's own wording beside them. An item is named in English only when the glossary covers every word of it; otherwise it stands as written, never half in each. What a document says is never rewritten: a long text and a supplier's line stay as written, marked as German. The choice is kept in a cookie, so the server sends the page in that language.

**Direction: "Weidenufer"**

The tender is for a building, so the interface is set at that building: an office block on a river bank, seen from the other side at the blue hour. It replaces two earlier directions, a drawing sheet and a single-line diagram, which the owner turned down (ADR-42).

| Element          | What it is                                                                   | Where                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| The front        | An elevation of the building. Storeys are rows, the tender's titles are bays | The overview. Every position is a window: lit when it is priced, red when it needs a person, dark until a run has read it |
| The plinth       | The base of the building                                                     | The positions that serve the whole house and have no storey: main distribution, earthing, hourly work                     |
| The river        | The building again, in the water                                             | Under the front. It is the mirror in the product's name, and it shows the same lit and red windows                        |
| Dimension lines  | The lines above an elevation that say what a bay is                          | On the band under the roof edge, one number per title; the titles are named in the key under the picture                  |
| The Preisspiegel | The estimator's own comparison sheet: suppliers side by side                 | A position: one column per supplier, always in the same order, each price as a length on one scale                        |
| The locator      | The front again, small                                                       | Beside a position's heading: two hairlines cross on its window, and it leads back to the overview                         |
| Checker's mark   | A box drawn round a value on a document                                      | Where a number was read: on the page, on the number that was clicked, and beside the panel's label                        |

- **The scene around the front:** the grid of windows is the data and is left alone; everything around it is there so it reads as a house. On the roof a storey set back from the front, plant, a mast and the house's name in letters; under the roof edge a band that carries the bay numbers; behind it the sky, with stars and a sickle moon by night and clouds and a sun by day; along the horizon the far shore; in front the quay and the sea with the house in it.
- **Themes:** night is the default; day is a choice, kept in the browser, and the sky follows it. By night the front is dark and the priced windows are lit. By day the front is still dark, a slate wall, and the glass shows the bright sky, so a priced window is the bright one in both. Both are designed; neither is the other inverted. A PDF page is shown as dark paper at night.
- **Colour:** the brightness of a window means "priced". At night that light is also the colour of the primary action and of the offer a position is priced with; by day those are ink. Red means "a person has to decide" and nothing else is red. Status never rests on colour alone: a priced and a red window differ in brightness as well as hue, and every state is said in words beside it.
- **The key is also a control:** under the picture, the reasons why windows are red and the tender's titles. Pointing at one picks its windows out on the house and lets the others step back; a reason can be held with a click, a title opens its positions.
- **Type:** Jost, light and large, for what is said once per view: the name of the building, the sentence that says how the tender stands, a price. Archivo for everything that is read. IBM Plex Mono for codes only: ordinal numbers, article numbers, arithmetic. Labels are never set in capitals, and no label sits above a heading.
- **Motion:** one sequence, on the overview: the lights come on across the front in the order the positions were read, each one catching like a tube, and the picture appears in the water. After that the red windows breathe together, the water drifts, the stars flicker faintly and the clouds move slowly. During a run the windows come on as they are read. Everywhere else motion answers an action: the list's marker glides, the list gives its room to a document, a mark draws itself on the page. With `prefers-reduced-motion` every view is in its final state at once.
- **Pointer, finger, keys:** pointing at a window says which position it is and how it stands; a click opens it. A finger first asks, then opens. The front is one Tab stop: the arrow keys walk from window to window and Enter opens. ⌘K jumps to a position by ordinal number or text. J and K step through the list. Esc closes the source.
- **Accessibility:** a test checks the contrast of every colour pair in use, in both themes (`apps/web/src/styles/tokens.test.ts`), including a lit window against the wall and against a dark one. Visible focus, no meaning by colour alone, no horizontal overflow at 390 px, where the house stands upright as a tower.

Tokens live in `apps/web/src/styles/tokens.css`. `pnpm shots` checks every route at 390, 1024, 1280 and 1440 px in both themes. `pnpm probe:ui` checks what a screenshot cannot: keyboard access, focus, hand-typed addresses, units and reduced motion.

## 8. Functional requirements

1. Parse GAEB DA XML X83 into positions with hierarchy, short text, long text, quantity and unit.
2. Parse supplier offers from PDF (two layouts) and GAEB X84 into lines, keeping the location of each field.
3. For each position, find candidate offer lines, extract typed attributes with verbatim quotes, and propose a match.
4. Verify every quote against the source text. Drop attributes that fail and flag the position.
5. Run deterministic checks and assign reason codes. Auto-accept only when all pass.
6. Price each position and keep the breakdown and its evidence.
7. Record every model call with tokens and cost. Enforce a daily and a per-run budget.
8. Record a run as an event log, and keep every answer so a run can be read back without the model.

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
