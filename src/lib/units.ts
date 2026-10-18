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

/** An area given in square feet, as the units show it: "120 sq ft" or "11.1 m²". */
export function formatArea(squareFeet: number, units: LengthUnit): string {
  if (units === 'm') return `${Math.round((squareFeet / FEET_PER_METER ** 2) * 10) / 10} m²`
  return `${Math.round(squareFeet).toLocaleString('en-IN')} sq ft`
}
