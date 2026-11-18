import { describe, expect, it } from 'vitest'
import {
  LABOR_RUNS,
  RUNS,
  TRAP_KINDS,
  filesOf,
  headline,
  laborFileOf,
} from './measured'

describe('the committed benchmark results', () => {
  it('are five runs over the same number of positions', () => {
    expect(RUNS.map((run) => run.key)).toEqual([
      'unseen502',
      'unseen501',
      'unseen119',
      'first',
      'now',
    ])
    for (const run of RUNS) expect(run.positions).toBe(1170)
  })

  it('lead with the newest unseen tender, never the demo tender', () => {
    const lead = headline()
    expect(lead.kind).toBe('unseen')
    expect(lead.seed).not.toBe(118)
    expect(lead.seed).toBe(
      Math.max(
        ...RUNS.filter((run) => run.kind === 'unseen').map((run) => run.seed),
      ),
    )
    expect(() =>
      headline(RUNS.filter((run) => run.kind !== 'unseen')),
    ).toThrow()
  })

  it('hold figures that agree with each other', () => {
    for (const run of RUNS) {
      expect(run.autoShare).toBeCloseTo(run.auto / run.positions, 4)
      expect(run.autoPrecision).toBeCloseTo(run.autoCorrect / run.auto, 3)
      expect(run.queueRecall).toBeCloseTo(
        run.reviewFound / run.reviewExpected,
        4,
      )
      // A raised review that belonged is an expected one that was found.
      expect(run.queuePrecision).toBeCloseTo(
        run.reviewFound / run.reviewRaised,
        4,
      )
      expect(run.autoAtRightPrice).toBeLessThanOrEqual(run.auto)
      expect(run.numbersFound).toBeLessThanOrEqual(run.numbersChecked)
      // The kinds add up to the totals the same file states.
      const kinds = TRAP_KINDS.map((kind) => run.traps[kind])
      expect(kinds.reduce((sum, kind) => sum + kind.planted, 0)).toBe(
        run.trapsPlanted,
      )
      expect(kinds.reduce((sum, kind) => sum + kind.caught, 0)).toBe(
        run.trapsCaught,
      )
    }
  })

  it('name the folder their files are in', () => {
    const folders = RUNS.map(filesOf)
    expect(folders[3]).toBe('bench/results/baseline/')
    expect(folders[4]).toBe('bench/results/')
  })
})

describe('the committed labor results', () => {
  it('lead with an unseen tender read with the current instructions', () => {
    const [lead] = LABOR_RUNS
    expect(lead?.kind).toBe('unseen')
    expect(lead?.prompt).toBe(2)
    expect(lead?.seed).not.toBe(118)
  })

  it('hold figures that agree with each other', () => {
    for (const run of LABOR_RUNS) {
      expect(run.settled + run.review).toBe(run.positions)
      expect(run.settledRight + run.wrongEntry).toBe(run.settled)
      expect(run.hoursError).toBeLessThan(run.hoursTrue)
    }
  })

  it('name their files', () => {
    expect(LABOR_RUNS.map(laborFileOf)).toContain(
      'bench/results/heldout-labor-504/b5_labor.json',
    )
  })
})
