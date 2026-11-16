/**
 * Electrical unit conversions used to compare what a tender position requires
 * with what a supplier offers, when the two are stated in different units.
 */

/** Nominal line-to-line voltage of a German low-voltage three-phase supply. */
export const NOMINAL_LINE_VOLTAGE = 400

/**
 * Line current drawn at a given three-phase apparent power: I = S / (√3 · U).
 *
 * A cabinet offered as 138 kVA carries about 199 A at 400 V, so it does not
 * meet a position that specifies 250 A.
 */
export function kvaToAmps(
  kva: number,
  lineVoltage: number = NOMINAL_LINE_VOLTAGE,
): number {
  return (kva * 1000) / (Math.sqrt(3) * lineVoltage)
}

/** Three-phase apparent power at a given line current: S = √3 · U · I. */
export function ampsToKva(
  amps: number,
  lineVoltage: number = NOMINAL_LINE_VOLTAGE,
): number {
  return (Math.sqrt(3) * lineVoltage * amps) / 1000
}
