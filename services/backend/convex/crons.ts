/**
 * Housekeeping. Decisions are kept per browser and nobody signs in, so a
 * decision nobody has touched for a month is let go; without this the table
 * would grow with every visitor for as long as the demo is up.
 */
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'forget old decisions',
  { hours: 6 },
  internal.decisions.forgetOld,
  {},
)

export default crons
