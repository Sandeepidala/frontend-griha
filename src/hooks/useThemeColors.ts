import { useEffect, useState } from 'react'

const COLOR_KEYS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-2',
  '--color-border',
  '--color-border-strong',
  '--color-text',
  '--color-text-muted',
  '--color-text-faint',
  '--color-primary',
  '--color-primary-soft',
  '--color-on-primary',
  '--color-accent',
  '--color-accent-soft',
  '--color-success',
  '--color-success-soft',
  '--color-warning',
  '--color-warning-soft',
  '--color-danger',
  '--color-danger-soft',
  '--color-info',
  '--color-info-soft',
] as const

type ColorKey = (typeof COLOR_KEYS)[number]
export type ThemeColors = Record<ColorKey, string>

function readColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement)
  const result = {} as ThemeColors
  for (const key of COLOR_KEYS) {
    result[key] = styles.getPropertyValue(key).trim()
  }
  return result
}

/** Canvas (Konva/Three) can't read CSS custom properties directly, so this
 * resolves them to real color strings and stays in sync when the theme toggles. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(() =>
    typeof document === 'undefined' ? ({} as ThemeColors) : readColors(),
  )

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readColors()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return colors
}
