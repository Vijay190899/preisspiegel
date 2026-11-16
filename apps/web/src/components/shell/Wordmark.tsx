/**
 * Three columns of unequal height: three supplier prices side by side, with
 * the one that was chosen in copper. That comparison is a Preisspiegel.
 */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="1" y="6" width="4.5" height="13" className="fill-ink" />
        <rect x="7.75" y="10" width="4.5" height="9" className="fill-accent" />
        <rect x="14.5" y="1" width="4.5" height="18" className="fill-ink" />
      </svg>
      <span className="hidden text-[1.07rem] font-semibold tracking-[-0.01em] text-ink sm:inline">
        Preisspiegel
      </span>
    </span>
  )
}
