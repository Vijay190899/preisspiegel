/**
 * A text value from the URL's search. The router parses `?titel=10` as the
 * number 10 and `?titel=07` as text, so a number is turned back into text;
 * anything else that is not text is dropped.
 */
export function searchText(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}
