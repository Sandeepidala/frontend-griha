import { useId } from 'react'
import type { Palette, StyleKit } from '@/lib/style/kits'

const GLASS = '#a9c8df'

/**
 * A small front elevation of a two-storey house in a style and colour scheme: its roof or parapet,
 * sunshades, sit-out, cladding and terrace features, drawn from the same style definition as the 3D
 * model so the picture always matches what the user gets.
 */
export function StyleThumbnail({ kit, palette, className }: { kit: StyleKit; palette: Palette; className?: string }) {
  const id = useId().replace(/:/g, '')
  const upper = kit.upperVolume ? palette.wallAlt : palette.wall
  const groundWall = kit.cladding === 'brick' ? palette.stone : palette.wall
  const windows = { ground: [30, 76], first: [30, 54, 76] }
  const shade = (x: number, top: number, w = 12) => {
    if (kit.tiledBands) return null
    if (kit.shades === 'tiled') return <polygon key={`h${x}${top}`} points={`${x - 3},${top - 0.6} ${x + w + 3},${top - 0.6} ${x + w + 1},${top - 3.6} ${x - 1},${top - 3.6}`} fill={palette.roof} />
    return <rect key={`h${x}${top}`} x={x - 2} y={top - 3} width={w + 4} height={1.4} fill={palette.trim} />
  }
  const window = (x: number, y: number, w = 12, h = 12) => (
    <g key={`w${x}${y}`}>
      <rect x={x} y={y} width={w} height={h} fill={GLASS} stroke={palette.frame} strokeWidth={0.8} />
      <line x1={x + w / 2} x2={x + w / 2} y1={y} y2={y + h} stroke={palette.frame} strokeWidth={0.5} />
      <rect x={x - 1} y={y + h} width={w + 2} height={1} fill={palette.trim} />
    </g>
  )
  const tiledBand = (y: number) => <polygon points={`17,${y + 3} 103,${y + 3} 99,${y - 1} 21,${y - 1}`} fill={palette.roof} />

  return (
    <svg viewBox="0 0 120 84" className={className} role="img" aria-label={`${kit.name}, ${palette.name}`}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e7f0f8" />
          <stop offset="1" stopColor="#f6f8fa" />
        </linearGradient>
      </defs>
      <rect width="120" height="84" fill={`url(#sky${id})`} />
      <rect y="76" width="120" height="8" fill="#cddfc0" />

      {/* Terrace features behind the parapet. */}
      {kit.pergola && (
        <g fill={palette.frame}>
          <rect x="66" y="6" width="1.6" height="9" />
          <rect x="92" y="6" width="1.6" height="9" />
          <rect x="64" y="5.5" width="32" height="1.6" fill={palette.wood} />
          {[68, 72, 76, 80, 84, 88].map((x) => (
            <rect key={x} x={x} y="4" width="1" height="2" fill={palette.wood} />
          ))}
        </g>
      )}
      {kit.domes === 'chhatri' && kit.roof === 'flat' && (
        <g>
          <rect x="31" y="9" width="1.4" height="6" fill={palette.stone} />
          <rect x="41" y="9" width="1.4" height="6" fill={palette.stone} />
          <rect x="29.5" y="8" width="14.5" height="1.4" fill={palette.trim} />
          <path d="M 31 8 A 5.6 5.4 0 0 1 42.4 8 Z" fill={palette.stone} />
          <rect x="36.3" y="1.2" width="0.8" height="2.2" fill={palette.trim} />
        </g>
      )}

      {/* Plinth, then the two floors. */}
      <rect x="22" y="72" width="76" height="4" fill={palette.base} />
      <rect x="24" y="46" width="72" height="26" fill={groundWall} />
      {kit.cladding === 'brick' && [50, 54, 58, 62, 66, 70].map((y) => <line key={y} x1="24" x2="96" y1={y} y2={y} stroke="#00000026" strokeWidth="0.4" />)}
      {kit.cladding === 'stone' && <rect x="24" y="66" width="72" height="6" fill={palette.stone} />}
      <rect x="24" y="21" width="72" height="25" fill={upper} />
      {kit.bands ? <rect x="22" y="44.6" width="76" height="2.6" fill={palette.trim} /> : <rect x="23" y="45" width="74" height="1.6" fill={palette.wall} stroke="#00000014" strokeWidth="0.3" />}
      {kit.tiledBands && tiledBand(46)}

      {/* Windows and what shades them. */}
      {windows.first.map((x) =>
        kit.shades === 'jharokha' ? (
          <g key={`j${x}`}>
            <polygon points={`${x - 1},${41} ${x + 13},${41} ${x + 11},${43.5} ${x + 1},${43.5}`} fill={palette.stone} />
            <rect x={x - 3} y={25} width={18} height={16} fill={palette.stone} />
            {window(x, 27, 12, 10)}
            <rect x={x - 3} y={36.5} width={18} height={4.5} fill={palette.wallAlt} />
            <path d={`M ${x - 3.5} 25 A 9.5 5 0 0 1 ${x + 15.5} 25 Z`} fill={palette.stone} />
          </g>
        ) : (
          <g key={`f${x}`}>
            {window(x, 27)}
            {shade(x, 27)}
          </g>
        ),
      )}
      {kit.cladding === 'wood' && <rect x="50" y="46" width="22" height="26" fill={palette.wood} />}
      {kit.cladding === 'wood' && [54, 58, 64, 68].map((x) => <line key={x} x1={x} x2={x} y1="46" y2="72" stroke="#00000026" strokeWidth="0.4" />)}
      {windows.ground.map((x) => (
        <g key={`g${x}`}>
          {window(x, 54)}
          {shade(x, 54)}
        </g>
      ))}
      <rect x="56" y="54" width="10" height="18" fill={palette.wood} />
      <rect x="57.3" y="56" width="3.2" height="7" fill="none" stroke="#00000033" strokeWidth="0.4" />
      <rect x="61.5" y="56" width="3.2" height="7" fill="none" stroke="#00000033" strokeWidth="0.4" />
      {!kit.porch && !kit.tiledBands && <rect x="53" y="51" width="16" height="1.6" fill={palette.trim} />}

      {/* The sit-out in front of the door. */}
      {kit.porch && (
        <g>
          <rect x="45" y="71" width="32" height="2" fill={palette.stone} />
          {[48, 72].map((x) =>
            kit.porch!.pillars === 'square' ? (
              <rect key={x} x={x - 0.4} y={51} width={3.2} height={20} fill={palette.wall} stroke="#0000001f" strokeWidth="0.3" />
            ) : (
              <g key={x}>
                <rect x={x} y={52} width={2.4} height={18} rx={1.1} fill={kit.porch!.pillars === 'round-wood' ? palette.wood : palette.stone} />
                <rect x={x - 0.6} y={69.4} width={3.6} height={1.6} fill={palette.stone} />
                <rect x={x - 0.5} y={51.2} width={3.4} height={1.2} fill={palette.trim} />
              </g>
            ),
          )}
          {kit.porch.roof === 'tiled' ? (
            <polygon points="42,52 80,52 76,46.5 46,46.5" fill={palette.roof} />
          ) : (
            <g>
              <rect x="44" y="47.5" width="34" height="3.5" fill={palette.trim} />
              <rect x="45" y="44" width="32" height="3.5" fill={palette.wallAlt} />
            </g>
          )}
        </g>
      )}

      {/* The top: a hip roof, or the style's parapet. */}
      {kit.roof === 'hip' ? (
        <g>
          <polygon points="12,22.5 108,22.5 80,5 40,5" fill={palette.roof} />
          <polygon points="12,22.5 40,5 44,5 18,22.5" fill="#00000014" />
          <rect x="12" y="22" width="96" height="1.6" fill={palette.wood} />
        </g>
      ) : (
        <Parapet kit={kit} palette={palette} upper={upper} />
      )}
      {kit.tiledBands && kit.roof === 'flat' && tiledBand(21)}
      {kit.domes === 'corners' && kit.roof === 'flat' && (
        <g>
          {[22, 92].map((x) => (
            <g key={x}>
              <rect x={x} y={11} width={6} height={10} fill={palette.wall} stroke="#0000001f" strokeWidth="0.3" />
              <rect x={x - 0.5} y={10.2} width={7} height={1.2} fill={palette.trim} />
              <path d={`M ${x + 0.4} 10.2 A 2.6 3.4 0 0 1 ${x + 5.6} 10.2 Z`} fill={palette.trim} />
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

function Parapet({ kit, palette, upper }: { kit: StyleKit; palette: Palette; upper: string }) {
  switch (kit.parapet) {
    case 'glass':
      return (
        <g>
          <rect x="24" y="19" width="72" height="2" fill={upper} />
          <rect x="25" y="13" width="70" height="6" fill="#bcd8e8" opacity="0.75" />
          <rect x="24" y="12.4" width="72" height="0.9" fill={palette.frame} />
        </g>
      )
    case 'crenellated':
      return (
        <g>
          <rect x="24" y="16.5" width="72" height="4.5" fill={upper} />
          <rect x="23" y="15.6" width="74" height="1.2" fill={palette.trim} />
          {[24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 92.5].map((x) => (
            <rect key={x} x={x} y="12" width="3.5" height="3.8" fill={upper} />
          ))}
        </g>
      )
    case 'balustrade':
      return (
        <g>
          <rect x="24" y="19" width="72" height="2" fill={upper} />
          <rect x="24" y="15" width="72" height="4" fill={palette.wallAlt} />
          <rect x="23.5" y="14" width="73" height="1.2" fill={palette.trim} />
          {[24, 41.5, 59, 76.5, 93].map((x) => (
            <g key={x}>
              <rect x={x} y="12.6" width="3" height="8.4" fill={upper} />
              <rect x={x - 0.4} y="12" width="3.8" height="1" fill={palette.trim} />
            </g>
          ))}
        </g>
      )
    case 'slim':
      return (
        <g>
          <rect x="24" y="16" width="72" height="5" fill={upper} />
          <rect x="23.5" y="15.3" width="73" height="0.9" fill={palette.trim} />
        </g>
      )
    default:
      return (
        <g>
          <rect x="24" y="15" width="72" height="6" fill={upper} />
          <rect x="23" y="14" width="74" height="1.4" fill={kit.bands ? palette.trim : '#cfc7bb'} />
        </g>
      )
  }
}
