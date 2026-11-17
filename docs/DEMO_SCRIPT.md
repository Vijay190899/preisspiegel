# Demo Script — 2 minutes

Status: this is the target walkthrough. It is verified step by step at the M3 gate, and timings are filled in then.

| Time | Screen                      | Say                                                                                                                                                |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Overview                    | "One tender, 1,170 positions, three supplier offers. This is what an estimator spends days on."                                                    |
| 0:15 | Overview, the split         | "Most of it is priced. This smaller part needs a decision, sorted by what it costs to get wrong."                                                  |
| 0:30 | Review queue, first item    | "A supplier offered a 138 kVA cabinet where the tender asks for 250 A. At 400 V that is 199 A. The system shows the arithmetic; it did not guess." |
| 0:55 | Position detail             | "The tender text, the three offers side by side, and why each passed or failed."                                                                   |
| 1:10 | Source viewer               | "Click the price. That is the line in the supplier's PDF it came from."                                                                            |
| 1:25 | Kalkulation, copper control | "Cable is quoted on a copper base. Move the notation and the total moves by five figures."                                                         |
| 1:40 | Overview, "Read it again"   | "The house goes dark and is read again: the stored answers, each checked against its source again. No model is called; a live run needs a code."   |
| 1:50 | Benchmarks                  | "Measured against ground truth: how much was automated, how often that was right, which traps were caught."                                        |

## Likely questions

**Is the data real?** No. It is generated, with planted traps and ground truth. [DATA.md](DATA.md) says exactly what is synthetic and why the numbers are easier than real documents.

**Why does the model not decide?** Because a wrong match that looks confident is the failure that costs money. The model reads and quotes; code verifies the quotes and runs the checks.

**Why the smallest model?** Cost per tender is a product number. Bulk work runs on the cheapest model, and a larger one is switched on only where a benchmark shows it helps. Every role is an environment variable.

**What breaks on real documents?** Scans without a text layer, layouts the row builder has not seen, and catalogues with thousands of near-identical articles. [ARCHITECTURE §9](ARCHITECTURE.md#9-how-this-maps-to-a-production-system) lists what a production version needs.

**What would you build next?** Estimator decisions as training labels, real catalogue imports, and reading the plans that the tender refers to.
