import type { ThemeColors } from '@/hooks/useThemeColors'
import type { RoomType } from '@/types/design'

export function roomPalette(type: RoomType, colors: ThemeColors) {
  switch (type) {
    case 'bedroom':
      return { fill: colors['--color-primary-soft'], stroke: colors['--color-primary'] }
    case 'kitchen':
      return { fill: colors['--color-warning-soft'], stroke: colors['--color-warning'] }
    case 'wet':
      return { fill: colors['--color-info-soft'], stroke: colors['--color-info'] }
    case 'pooja':
      return { fill: colors['--color-accent-soft'], stroke: colors['--color-accent'] }
    case 'circulation':
      return { fill: colors['--color-surface'], stroke: colors['--color-border-strong'] }
    case 'utility':
    case 'living':
    default:
      return { fill: colors['--color-surface-2'], stroke: colors['--color-border-strong'] }
  }
}
