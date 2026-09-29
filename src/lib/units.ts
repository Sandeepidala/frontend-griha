import type { LengthUnit } from '@/types/design'

const FEET_PER_METER = 3.28084

/** All geometry is stored in feet; `units` only controls how it's displayed/edited. */
export function toDisplayLength(feet: number, units: LengthUnit): number {
  return units === 'm' ? feet / FEET_PER_METER : feet
}

export function fromDisplayLength(value: number, units: LengthUnit): number {
  return units === 'm' ? value * FEET_PER_METER : value
}

export function formatLength(feet: number, units: LengthUnit): string {
  const digits = units === 'm' ? 2 : 1
  const factor = 10 ** digits
  const rounded = Math.round(toDisplayLength(feet, units) * factor) / factor
  return units === 'm' ? `${rounded}m` : `${rounded}'`
}

export function unitSuffix(units: LengthUnit): string {
  return units === 'm' ? 'm' : 'ft'
}
