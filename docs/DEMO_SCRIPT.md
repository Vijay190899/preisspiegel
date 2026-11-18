# Demo Script — 2 minutes

Verified end to end at the M3 gate in Chrome at 1440 px, on the local deployment, with an assertion for each step and no console errors. Times are the pace to aim for, not measured.

| Time | Screen                                | Do                         | Say                                                                                                                                                     |
| ---- | ------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Overview                              | Let the lights come on     | "One tender, 1,170 positions, three supplier offers. Every window is a position. This is what an estimator spends days on."                             |
| 0:12 | Overview, the sentence                | Point at the red windows   | "1,078 are priced. 92 wait for a decision, and 19,621.76 € rest on them. Red means a person decides; nothing else is red."                              |
| 0:25 | The costliest decisions, `01.01.0020` | Open the cabinet           | "The tender asks for 250 A. One supplier offers 138 kVA. At 400 V that is 199 A, and the page shows the arithmetic. Code found it, not the model."      |
| 0:45 | The same position, the offers         | Point at the three columns | "The three suppliers side by side, each price on one scale, and what was found on each."                                                                |
| 0:55 | Source                                | Click the price            | "Every underlined number opens the document it was read from, at the place."                                                                            |
| 1:05 | Deciding                              | Press 3, then U            | "The estimator takes the clean offer with one key; the window goes from red to lit and the sums follow. U takes it back."                               |
| 1:15 | Labor, on the same position           | Scroll to Montage          | "Labor comes from the contractor's own time table. The model names the kind of work; code checks the size and takes the minutes from the table."        |
| 1:25 | Kalkulation                           | Move the copper control    | "Material, labor and the copper surcharge. Cable is quoted on a copper base: move the day's notation and the bid moves by five figures."                |
| 1:40 | Overview, "Noch einmal lesen"         | Press it                   | "The house goes dark and is read again from the stored answers, each checked against its source again. No model is called; a live run needs a code."    |
| 1:50 | Messung                               | Point at the first column  | "Measured against ground truth on a tender it had never seen: what was priced without a person, how often rightly, which traps were caught, and labor." |

## Likely questions

**Is the data real?** No. It is generated, with planted traps and ground truth. [DATA.md](DATA.md) says exactly what is synthetic and why the numbers are easier than real documents.

**Why does the model not decide?** Because a wrong match that looks confident is the failure that costs money. The model reads and quotes; code verifies the quotes and runs the checks.

**Why the smallest model?** Cost per tender is a product number. Bulk work runs on the cheapest model, and a larger one is switched on only where a benchmark shows it helps. Every role is an environment variable.

**What breaks on real documents?** Scans without a text layer, layouts the row builder has not seen, and catalogues with thousands of near-identical articles. [ARCHITECTURE §9](ARCHITECTURE.md#9-how-this-maps-to-a-production-system) lists what a production version needs.

**What would you build next?** Estimator decisions as training labels, real catalogue imports, and reading the plans that the tender refers to.
