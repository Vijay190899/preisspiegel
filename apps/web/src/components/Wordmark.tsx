/**
 * Three columns of unequal height: three supplier prices side by side, with
 * the one that was chosen in copper. That comparison is a Preisspiegel.
 */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="1" y="7" width="5" height="14" rx="1" className="fill-ink-3" />
        <rect
          x="8.5"
          y="11"
          width="5"
          height="10"
          rx="1"
          className="fill-accent"
        />
        <rect
          x="16"
          y="2"
          width="5"
          height="19"
          rx="1"
          className="fill-ink-3"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        Preisspiegel
      </span>
    </span>
  )
}
