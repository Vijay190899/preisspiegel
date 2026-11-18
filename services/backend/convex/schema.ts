import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/** Where a value was read from. Mirrors `SourceRef` in `@preisspiegel/core`. */
export const sourceRef = v.union(
  v.object({
    kind: v.literal('pdf'),
    page: v.number(),
    x: v.number(),
    y: v.number(),
    w: v.number(),
    h: v.number(),
  }),
  v.object({
    kind: v.literal('gaeb'),
    itemId: v.string(),
    element: v.string(),
  }),
)

export const reasonCode = v.union(
  v.literal('SPEC_MISMATCH'),
  v.literal('UNIT_BASIS'),
  v.literal('PRICE_OUTLIER'),
  v.literal('QTY_MISMATCH'),
  v.literal('ALTERNATIVE_PRODUCT'),
  v.literal('NO_OFFER'),
  v.literal('AMBIGUOUS'),
  v.literal('ARITHMETIC'),
)

/** A line put to the model for one position. Mirrors `Candidate` in core. */
export const candidate = v.object({
  id: v.string(),
  referenced: v.boolean(),
  text: v.string(),
  articleNo: v.union(v.string(), v.null()),
  unit: v.union(v.string(), v.null()),
})

/** One attribute as the model compared it, before any check. Mirrors `RawPair`. */
const rawPair = v.object({
  attribute: v.string(),
  tenderValue: v.string(),
  tenderQuote: v.string(),
  offerValue: v.string(),
  offerQuote: v.string(),
  agrees: v.boolean(),
})

/** What the model answered for one line. Mirrors `RawJudgement`. */
export const rawJudgement = v.object({
  id: v.string(),
  verdict: v.union(
    v.literal('same'),
    v.literal('different'),
    v.literal('unrelated'),
    v.literal('unsure'),
  ),
  pairs: v.array(rawPair),
  packSize: v.union(v.string(), v.null()),
  packQuote: v.union(v.string(), v.null()),
  alternativeQuote: v.union(v.string(), v.null()),
})

/** A compared attribute whose quotes were found in their sources. Mirrors `Pair`. */
const pair = v.object({
  attribute: v.string(),
  tender: v.object({ value: v.string(), quote: v.string() }),
  offer: v.object({ value: v.string(), quote: v.string() }),
  agrees: v.boolean(),
  decidedBy: v.union(v.literal('code'), v.literal('model')),
  arithmetic: v.optional(v.string()),
  scale: v.optional(
    v.object({ asked: v.number(), offered: v.number(), unit: v.string() }),
  ),
})

const verdict = v.union(
  v.literal('confirmed'),
  v.literal('mismatch'),
  v.literal('unrelated'),
  v.literal('unconfirmed'),
)
const decidedBy = v.union(v.literal('code'), v.literal('model'))
const pack = v.union(
  v.object({ size: v.number(), quote: v.string() }),
  v.null(),
)

/** A verified answer for one line. Mirrors `Judgement`. */
export const judgement = v.object({
  id: v.string(),
  verdict,
  by: decidedBy,
  /** What the model itself called the line. `null` where code decided alone. */
  said: v.union(
    v.literal('same'),
    v.literal('different'),
    v.literal('unrelated'),
    v.literal('unsure'),
    v.null(),
  ),
  pairs: v.array(pair),
  rejected: v.number(),
  pack,
  alternative: v.union(v.string(), v.null()),
})

/** One offer for a position, checked. Mirrors `Offer`. */
export const offer = v.object({
  id: v.string(),
  supplierKey: v.string(),
  seq: v.number(),
  referenced: v.boolean(),
  verdict,
  by: decidedBy,
  pairs: v.array(pair),
  pack,
  unitPrice: v.union(v.number(), v.null()),
  quantity: v.union(v.number(), v.null()),
  findings: v.array(
    v.object({
      code: reasonCode,
      detail: v.record(v.string(), v.union(v.string(), v.number())),
    }),
  ),
})

const eventData = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null()),
)

export default defineSchema({
  // --- The tender and its documents, loaded by `pnpm seed` ----------------
  //
  // Rows refer to their tender by slug, not by document id, so a tender can
  // be reloaded without its address changing.

  tenders: defineTable({
    slug: v.string(),
    projectNo: v.string(),
    project: v.string(),
    lot: v.string(),
    client: v.string(),
    contractor: v.string(),
    currency: v.string(),
    positionCount: v.number(),
    /** Positions that at least one offer line names by ordinal number. */
    referencedPositionCount: v.number(),
    /** The top level of the Leistungsverzeichnis, in document order. */
    titles: v.array(
      v.object({
        rno: v.string(),
        label: v.string(),
        positionCount: v.number(),
      }),
    ),
    /**
     * The storeys the tender is cut by, from the ground up, and for every
     * position which one it belongs to: one character each, the storey's
     * index in base 36, or `-` for a position that serves the whole building.
     */
    storeys: v.optional(v.array(v.string())),
    storeyByPosition: v.optional(v.string()),
    /** What the contractor charges for an hour of labor, in the tender's currency. */
    laborRate: v.optional(v.number()),
  }).index('by_slug', ['slug']),

  // --- Labor ---------------------------------------------------------------

  // The contractor's labor time table: minutes per unit for a kind of work.
  laborTimes: defineTable({
    tenderSlug: v.string(),
    key: v.string(),
    label: v.string(),
    unit: v.string(),
    minutes: v.number(),
  }).index('by_tenderSlug_and_key', ['tenderSlug', 'key']),

  // One pass over a tender that ties each position to an entry of the table.
  laborJobs: defineTable({
    tenderSlug: v.string(),
    status: v.union(
      v.literal('reading'),
      v.literal('done'),
      v.literal('stopped'),
      v.literal('failed'),
    ),
    /** `replay`: only stored answers are used and no model is called. */
    mode: v.union(v.literal('live'), v.literal('replay')),
    model: v.string(),
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    positions: v.number(),
    cursor: v.number(),
    calls: v.number(),
    cached: v.number(),
    failed: v.number(),
    usd: v.number(),
    note: v.union(v.string(), v.null()),
  }).index('by_tenderSlug_and_startedAt', ['tenderSlug', 'startedAt']),

  // What was decided about the labor of one position.
  laborMatches: defineTable({
    tenderSlug: v.string(),
    oz: v.string(),
    seq: v.number(),
    qty: v.number(),
    unit: v.string(),
    /** `set`: an entry was taken. `none`: no entry describes the work. `review`: a person decides. */
    status: v.union(v.literal('set'), v.literal('none'), v.literal('review')),
    entryKey: v.union(v.string(), v.null()),
    /** Minutes per unit, from the table; never from the model. */
    minutes: v.union(v.number(), v.null()),
    /** The position's words the choice rests on. */
    quote: v.union(v.string(), v.null()),
    limitQuote: v.union(v.string(), v.null()),
    /** Why a person decides, and what was compared. */
    reason: v.union(v.string(), v.null()),
    detail: v.union(v.string(), v.null()),
    source: v.union(
      v.literal('model'),
      v.literal('cache'),
      v.literal('failed'),
    ),
  })
    .index('by_tenderSlug_and_seq', ['tenderSlug', 'seq'])
    .index('by_tenderSlug_and_oz', ['tenderSlug', 'oz']),

  // What the model answered to a labor question, keyed by what was asked.
  laborCache: defineTable({
    key: v.string(),
    model: v.string(),
    at: v.number(),
    answer: v.object({
      entry: v.union(v.string(), v.null()),
      quote: v.string(),
      limitQuote: v.union(v.string(), v.null()),
    }),
  }).index('by_key', ['key']),

  documents: defineTable({
    tenderSlug: v.string(),
    /** `tender`, or the supplier's key. */
    key: v.string(),
    kind: v.union(v.literal('tender'), v.literal('offer')),
    supplierName: v.union(v.string(), v.null()),
    format: v.union(v.literal('x83'), v.literal('x84'), v.literal('pdf')),
    fileName: v.string(),
    date: v.string(),
    pageCount: v.union(v.number(), v.null()),
    /** Positions in a tender, offer lines in an offer. */
    lineCount: v.number(),
    /** Offer lines that name a tender position by its ordinal number. */
    referenceCount: v.number(),
  }).index('by_tenderSlug_and_key', ['tenderSlug', 'key']),

  // One position of the Leistungsverzeichnis.
  positions: defineTable({
    tenderSlug: v.string(),
    /** Ordinal number, e.g. `03.02.0040`. */
    oz: v.string(),
    seq: v.number(),
    path: v.array(v.object({ rno: v.string(), label: v.string() })),
    shortText: v.string(),
    longText: v.string(),
    qty: v.number(),
    unit: v.string(),
    gaebId: v.string(),
  })
    .index('by_tenderSlug_and_seq', ['tenderSlug', 'seq'])
    .index('by_tenderSlug_and_oz', ['tenderSlug', 'oz']),

  // One line of a supplier's offer, as read from the document. Every number
  // here was parsed by code, and `sources` says where each field was found.
  offerLines: defineTable({
    tenderSlug: v.string(),
    supplierKey: v.string(),
    seq: v.number(),
    posRef: v.union(v.string(), v.null()),
    articleNo: v.union(v.string(), v.null()),
    text: v.string(),
    qty: v.union(v.number(), v.null()),
    unit: v.union(v.string(), v.null()),
    unitPrice: v.union(v.number(), v.null()),
    priceBasis: v.number(),
    listPrice: v.union(v.number(), v.null()),
    discountPct: v.union(v.number(), v.null()),
    total: v.union(v.number(), v.null()),
    alternative: v.boolean(),
    sources: v.record(v.string(), sourceRef),
  })
    .index('by_tenderSlug_and_supplierKey_and_seq', [
      'tenderSlug',
      'supplierKey',
      'seq',
    ])
    .index('by_tenderSlug_and_posRef', ['tenderSlug', 'posRef']),

  // --- Runs ------------------------------------------------------------------
  //
  // A run takes a tender from positions and offer lines to a decision per
  // position. Its steps write here; nothing else does.

  runs: defineTable({
    tenderSlug: v.string(),
    status: v.union(
      v.literal('preparing'),
      v.literal('reading'),
      v.literal('deciding'),
      v.literal('done'),
      v.literal('stopped'),
      v.literal('failed'),
    ),
    /** Canonical ID of the model that reads, or `null` for a run without one. */
    model: v.union(v.string(), v.null()),
    /**
     * `replay`: stored answers are read back and no model is called. Absent
     * on runs from before the interface could start one; those were live.
     */
    mode: v.optional(v.union(v.literal('live'), v.literal('replay'))),
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    /** Positions in this run. Fewer than the tender has for a trial run. */
    positions: v.number(),
    /** Positions read so far: the next one to read has this `seq`. */
    cursor: v.number(),
    /** Number of the next event. */
    nextEvent: v.number(),
    /** Questions answered by a model call, from the cache, or not at all. */
    calls: v.number(),
    cached: v.number(),
    failed: v.number(),
    usd: v.number(),
    /** Set when the run is done. */
    auto: v.union(v.number(), v.null()),
    review: v.union(v.number(), v.null()),
    materialTotal: v.union(v.number(), v.null()),
    atRisk: v.union(v.number(), v.null()),
    /**
     * The decision for every position, one letter each in document order:
     * `a` priced without asking, `r` needs a person. Lets a list of a
     * thousand positions show its state from one small document.
     */
    statuses: v.union(v.string(), v.null()),
    /** How many positions each supplier is the cheapest clean offer for. */
    wins: v.optional(v.record(v.string(), v.number())),
    /** Why a run stopped or failed. */
    note: v.union(v.string(), v.null()),
  }).index('by_tenderSlug_and_startedAt', ['tenderSlug', 'startedAt']),

  // What happened in a run, in order. Append-only. The interface shows a run
  // from this log, and a replay is this log read back.
  runEvents: defineTable({
    runId: v.id('runs'),
    seq: v.number(),
    at: v.number(),
    kind: v.string(),
    data: eventData,
  }).index('by_runId_and_seq', ['runId', 'seq']),

  // What is asked about each position: the lines that could answer it.
  questions: defineTable({
    runId: v.id('runs'),
    oz: v.string(),
    seq: v.number(),
    shortText: v.string(),
    longText: v.string(),
    unit: v.string(),
    candidates: v.array(candidate),
    echoes: v.array(v.string()),
    /** Hash of everything the model is shown. Equal questions share an answer. */
    key: v.string(),
  }).index('by_runId_and_seq', ['runId', 'seq']),

  // The verified answers for one position.
  judgements: defineTable({
    runId: v.id('runs'),
    oz: v.string(),
    seq: v.number(),
    /** Where the answer came from. */
    source: v.union(
      v.literal('model'),
      v.literal('cache'),
      v.literal('code'),
      v.literal('failed'),
    ),
    judgements: v.array(judgement),
  }).index('by_runId_and_seq', ['runId', 'seq']),

  // The decision for one position, with every offer and what was found on it.
  matches: defineTable({
    runId: v.id('runs'),
    oz: v.string(),
    seq: v.number(),
    status: v.union(v.literal('auto'), v.literal('review')),
    reasons: v.array(reasonCode),
    noted: v.array(reasonCode),
    best: v.union(
      v.object({
        id: v.string(),
        supplierKey: v.string(),
        unitPrice: v.number(),
      }),
      v.null(),
    ),
    materialTotal: v.union(v.number(), v.null()),
    atRisk: v.union(v.number(), v.null()),
    /** For ordering the review queue: `atRisk`, or 0 where it has no figure. */
    weight: v.number(),
    offers: v.array(offer),
  })
    .index('by_runId_and_seq', ['runId', 'seq'])
    .index('by_runId_and_oz', ['runId', 'oz'])
    .index('by_runId_and_status_and_weight', ['runId', 'status', 'weight']),

  // What an estimator settled for a position that needed a person: one of
  // the offers as it stands, or a price of their own. There are no accounts
  // in the demo, so a decision belongs to the browser that made it, named
  // by an id it keeps; two visitors do not see each other's.
  decisions: defineTable({
    tenderSlug: v.string(),
    session: v.string(),
    oz: v.string(),
    seq: v.number(),
    /** The offer taken, or `null` where the estimator set a price. */
    offerId: v.union(v.string(), v.null()),
    supplierKey: v.union(v.string(), v.null()),
    /** For one unit of the tender. Read from the offer, or typed in. */
    unitPrice: v.number(),
    at: v.number(),
  })
    .index('by_tenderSlug_and_session_and_oz', ['tenderSlug', 'session', 'oz'])
    .index('by_at', ['at']),

  // What a model answered to a question, kept by the question's hash. The
  // same position text against the same lines is read once, ever.
  matchCache: defineTable({
    key: v.string(),
    model: v.string(),
    at: v.number(),
    answer: v.array(rawJudgement),
  }).index('by_key', ['key']),

  // --- The cost meter ------------------------------------------------------

  // One row per model call. Append-only.
  llmLedger: defineTable({
    /** UTC day, `YYYY-MM-DD`. */
    day: v.string(),
    at: v.number(),
    provider: v.string(),
    role: v.string(),
    /** Canonical model ID. */
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
    usd: v.number(),
    stopReason: v.union(v.string(), v.null()),
    /** The run the call belonged to, when it was made inside one. */
    runId: v.optional(v.string()),
  })
    .index('by_day', ['day'])
    .index('by_runId', ['runId']),

  // Running total per day, so the budget guard reads one document instead of
  // summing the ledger. Written in the same mutation as each ledger row.
  llmSpend: defineTable({
    day: v.string(),
    usd: v.number(),
    calls: v.number(),
  }).index('by_day', ['day']),
})
