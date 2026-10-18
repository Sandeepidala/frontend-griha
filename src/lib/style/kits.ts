import type { DesignStyle, ProjectBrief } from '@/types/brief'

/**
 * House styles: how a plan is built up into a house (roof, parapet, verandah, sunshades, details) and
 * the colour schemes it comes in. One definition here drives the 3D model, the elevations, the build
 * video, the 3D site view and the style items in the cost estimate, so they always agree.
 */

/** A colour scheme for a style. Colours are for lit 3D surfaces, so slightly deeper than paint chips. */
export interface Palette {
  id: string
  name: string
  /** Main exterior walls. */
  wall: string
  /** A second wall colour: the upper volume, or panels that set off the main walls. */
  wallAlt: string
  /** Plinth and base band. */
  base: string
  /** Bands, copings, cornices and RCC sunshades. */
  trim: string
  /** Roof tiles. */
  roof: string
  /** Window frames, railings and metalwork. */
  frame: string
  /** Doors, wooden pillars, pergolas and wood cladding. */
  wood: string
  /** Stone or brick cladding, stone pillars and domes. */
  stone: string
}

export type RoofForm = 'flat' | 'hip'
export type ParapetForm = 'plain' | 'slim' | 'glass' | 'crenellated' | 'balustrade' | 'none'
export type ShadeForm = 'none' | 'slab' | 'tiled' | 'jharokha'
export type Cladding = 'none' | 'wood' | 'brick' | 'stone'

export interface StyleKit {
  id: DesignStyle
  name: string
  /** One line for the style picker. */
  tagline: string
  /** What makes it this style, as the picker lists it. */
  features: string[]
  roof: RoofForm
  /** Hip roofs: rise per foot of run (0.75 ≈ 37°), and how far the eaves overhang the walls, ft. */
  pitch: number
  eaves: number
  parapet: ParapetForm
  /** A sloping tiled band along the outer walls at every upper floor level (and at the top, with a flat roof). */
  tiledBands: boolean
  /** Moulded bands at each floor level in the trim colour; otherwise the slab edge takes the wall colour. */
  bands: boolean
  /** Over the windows: RCC chajjas, small tiled hoods, or jharokha bays on the front (with chajjas elsewhere). */
  shades: ShadeForm
  /** A covered entrance: pillars and a tiled or flat roof in front of the main door. */
  porch: { pillars: 'round-wood' | 'round-stone' | 'square'; roof: 'tiled' | 'flat'; depth: number } | null
  /** The top floor in the second wall colour, so it reads as a separate volume. */
  upperVolume: boolean
  pergola: boolean
  cladding: Cladding
  /** A chhatri pavilion on the terrace, or small domes on the parapet corners. */
  domes: 'none' | 'chhatri' | 'corners'
  palettes: Palette[]
}

const palette = (id: string, name: string, colors: Omit<Palette, 'id' | 'name'>): Palette => ({ id, name, ...colors })

export const STYLE_KITS: Record<DesignStyle, StyleKit> = {
  modern: {
    id: 'modern',
    name: 'Modern',
    tagline: 'Clean lines, a flat roof and large windows',
    features: ['Flat roof with a slim parapet', 'Dark bands at each floor', 'Thin RCC sunshades'],
    roof: 'flat',
    pitch: 0,
    eaves: 0,
    parapet: 'slim',
    tiledBands: false,
    bands: true,
    shades: 'slab',
    porch: null,
    upperVolume: false,
    pergola: false,
    cladding: 'none',
    domes: 'none',
    palettes: [
      palette('white-charcoal', 'White & charcoal', { wall: '#f2f1ec', wallAlt: '#dcdad4', base: '#5f6266', trim: '#3c3f44', roof: '#6f7175', frame: '#2c2f33', wood: '#94643f', stone: '#b8b2a8' }),
      palette('warm-grey-teak', 'Warm grey & teak', { wall: '#e6e0d5', wallAlt: '#c9bfb0', base: '#7d746a', trim: '#57524c', roof: '#6f6a64', frame: '#38342f', wood: '#8a5733', stone: '#b3a898' }),
      palette('sand-black', 'Sand & black', { wall: '#e8dbc4', wallAlt: '#d3c1a2', base: '#5a5043', trim: '#2a2928', roof: '#4a4744', frame: '#1e1e1e', wood: '#76492b', stone: '#c2ae8c' }),
    ],
  },
  contemporary: {
    id: 'contemporary',
    name: 'Contemporary',
    tagline: 'Layered volumes, wood panels and glass',
    features: ['Upper floor as a second volume', 'Wood-panel cladding by the entrance', 'Glass terrace railing and a pergola'],
    roof: 'flat',
    pitch: 0,
    eaves: 0,
    parapet: 'glass',
    tiledBands: false,
    bands: true,
    shades: 'none',
    porch: null,
    upperVolume: true,
    pergola: true,
    cladding: 'wood',
    domes: 'none',
    palettes: [
      palette('white-grey-teak', 'White, grey & teak', { wall: '#f3f2ee', wallAlt: '#8c9197', base: '#5d6166', trim: '#474c52', roof: '#5d6166', frame: '#2b2f34', wood: '#a46a3a', stone: '#bdb7ad' }),
      palette('beige-walnut', 'Beige & walnut', { wall: '#ebe2d2', wallAlt: '#b29f85', base: '#6b5b49', trim: '#594838', roof: '#5f5246', frame: '#33291f', wood: '#6c472b', stone: '#c4b49a' }),
      palette('slate-oak', 'Slate & oak', { wall: '#e8ebed', wallAlt: '#57626d', base: '#47505a', trim: '#363e47', roof: '#47505a', frame: '#22282e', wood: '#bd8752', stone: '#aeb4ba' }),
    ],
  },
  traditional: {
    id: 'traditional',
    name: 'Traditional',
    tagline: 'Warm colours, tiled sunshades and a pillared sit-out',
    features: ['Pillared sit-out with a tiled roof', 'Tiled hoods over the windows', 'Balustrade parapet and moulded bands'],
    roof: 'flat',
    pitch: 0,
    eaves: 0,
    parapet: 'balustrade',
    tiledBands: false,
    bands: true,
    shades: 'tiled',
    porch: { pillars: 'round-stone', roof: 'tiled', depth: 6 },
    upperVolume: false,
    pergola: false,
    cladding: 'none',
    domes: 'none',
    palettes: [
      palette('ochre-maroon', 'Ochre & maroon', { wall: '#dfb366', wallAlt: '#ecd39f', base: '#7a2e29', trim: '#8a3a2e', roof: '#ad4f2a', frame: '#56291d', wood: '#683823', stone: '#eadfc8' }),
      palette('cream-terracotta', 'Cream & terracotta', { wall: '#efe1c3', wallAlt: '#e3cfa6', base: '#a1523a', trim: '#b05d3d', roof: '#a94c2b', frame: '#5c3322', wood: '#6b3f25', stone: '#f2e9d6' }),
      palette('yellow-green', 'Yellow & green', { wall: '#eecb69', wallAlt: '#f3dc96', base: '#3d6948', trim: '#3d6948', roof: '#a44f2d', frame: '#2d4d36', wood: '#5a3921', stone: '#efe6cf' }),
    ],
  },
  kerala: {
    id: 'kerala',
    name: 'Kerala',
    tagline: 'A steep tiled roof with deep eaves for the rain',
    features: ['Steep Mangalore-tile roof with wide eaves', 'Wooden pillars at the sit-out', 'Tiled sunshades and a laterite base'],
    roof: 'hip',
    pitch: 0.75,
    eaves: 2.5,
    parapet: 'none',
    tiledBands: true,
    bands: false,
    shades: 'tiled',
    porch: { pillars: 'round-wood', roof: 'tiled', depth: 7 },
    upperVolume: false,
    pergola: false,
    cladding: 'none',
    domes: 'none',
    palettes: [
      palette('white-laterite', 'White & laterite', { wall: '#f4f1ea', wallAlt: '#ece6d9', base: '#9a4a30', trim: '#e9e3d6', roof: '#a1432a', frame: '#5a3620', wood: '#683d22', stone: '#9a4a30' }),
      palette('cream-teak', 'Cream & teak', { wall: '#efe4cc', wallAlt: '#e6d8bb', base: '#7b5a3d', trim: '#e3d6bb', roof: '#983f28', frame: '#5b3a22', wood: '#784928', stone: '#7b5a3d' }),
      palette('pale-yellow-brown', 'Pale yellow & brown', { wall: '#f1e1a6', wallAlt: '#e8d48f', base: '#6c4930', trim: '#ecdfb0', roof: '#8c3a25', frame: '#4e3220', wood: '#5d3920', stone: '#6c4930' }),
    ],
  },
  rajasthani: {
    id: 'rajasthani',
    name: 'Rajasthani',
    tagline: 'Sandstone tones, jharokhas and a chhatri on the terrace',
    features: ['Jharokha bay windows on the front', 'Notched (kangura) parapet', 'A chhatri pavilion and sandstone base'],
    roof: 'flat',
    pitch: 0,
    eaves: 0,
    parapet: 'crenellated',
    tiledBands: false,
    bands: true,
    shades: 'jharokha',
    porch: null,
    upperVolume: false,
    pergola: false,
    cladding: 'stone',
    domes: 'chhatri',
    palettes: [
      palette('jaipur-pink', 'Jaipur pink', { wall: '#e0a088', wallAlt: '#ebbda8', base: '#b46b53', trim: '#f2e2d2', roof: '#c4765b', frame: '#77402e', wood: '#693a24', stone: '#d48c70' }),
      palette('jaisalmer-gold', 'Jaisalmer gold', { wall: '#dab267', wallAlt: '#e6c88b', base: '#b48a45', trim: '#f1e2bd', roof: '#c4954f', frame: '#6c4a22', wood: '#6a4424', stone: '#cba158' }),
      palette('jodhpur-blue', 'Jodhpur blue', { wall: '#7ba3c7', wallAlt: '#a6c1da', base: '#587ea2', trim: '#f1f1ec', roof: '#6d93b8', frame: '#2e4a65', wood: '#69482d', stone: '#98b5d0' }),
    ],
  },
  punjabi: {
    id: 'punjabi',
    name: 'Punjabi kothi',
    tagline: 'A grand portico, brick panels and domed corners',
    features: ['Pillared portico at the entrance', 'Brick-panel cladding on the ground floor', 'Balustrade parapet with corner domes'],
    roof: 'flat',
    pitch: 0,
    eaves: 0,
    parapet: 'balustrade',
    tiledBands: false,
    bands: true,
    shades: 'slab',
    porch: { pillars: 'square', roof: 'flat', depth: 7 },
    upperVolume: false,
    pergola: false,
    cladding: 'brick',
    domes: 'corners',
    palettes: [
      palette('cream-brick', 'Cream & brick', { wall: '#f0e5cf', wallAlt: '#e2d0ad', base: '#97482f', trim: '#c6a067', roof: '#a8563a', frame: '#4a3524', wood: '#6a4227', stone: '#b2513a' }),
      palette('ivory-gold', 'Ivory & gold', { wall: '#f5efe2', wallAlt: '#ece1c9', base: '#8b785a', trim: '#c49c4e', roof: '#b8924e', frame: '#4c3d26', wood: '#6e4a2b', stone: '#d6c197' }),
      palette('peach-white', 'Peach & white', { wall: '#f0c6a4', wallAlt: '#f6e0cd', base: '#985839', trim: '#faf6ef', roof: '#b9694a', frame: '#56382a', wood: '#6b4227', stone: '#c66f4c' }),
    ],
  },
  south_indian: {
    id: 'south_indian',
    name: 'South Indian',
    tagline: 'A Chettinad-style thinnai, red oxide and tiled eaves',
    features: ['Pillared thinnai verandah with a tiled roof', 'Tiled eaves along every floor', 'Red-oxide base and bands'],
    roof: 'flat',
    pitch: 0,
    eaves: 0,
    parapet: 'plain',
    tiledBands: true,
    bands: true,
    shades: 'tiled',
    porch: { pillars: 'round-wood', roof: 'tiled', depth: 6 },
    upperVolume: false,
    pergola: false,
    cladding: 'none',
    domes: 'none',
    palettes: [
      palette('terracotta-white', 'Terracotta & white', { wall: '#f5f1e8', wallAlt: '#e8ddcb', base: '#a6462c', trim: '#b04e30', roof: '#a6462c', frame: '#4f2c1b', wood: '#5c3320', stone: '#e1d4bd' }),
      palette('ochre-teal', 'Ochre & teal', { wall: '#e5bd68', wallAlt: '#edd194', base: '#2d6d68', trim: '#2d6d68', roof: '#a0482a', frame: '#244c48', wood: '#59341f', stone: '#efe2c4' }),
      palette('lime-red-oxide', 'Lime & red oxide', { wall: '#f1eee5', wallAlt: '#e5e0d2', base: '#8c3223', trim: '#8c3223', roof: '#983b25', frame: '#4e2d1c', wood: '#4e2d1b', stone: '#e8e1d0' }),
    ],
  },
}

/** Styles in the order the picker shows them. */
export const STYLE_ORDER: DesignStyle[] = ['modern', 'contemporary', 'traditional', 'kerala', 'south_indian', 'rajasthani', 'punjabi']

/** A style with the colour scheme chosen for it. */
export interface Look {
  kit: StyleKit
  palette: Palette
}

/** The project's style and colour scheme (the style's first scheme when none is chosen, Modern without a brief). */
export function lookFor(brief: Pick<ProjectBrief, 'style' | 'palette'> | null | undefined): Look {
  const kit = STYLE_KITS[brief?.style ?? 'modern'] ?? STYLE_KITS.modern
  const chosen = kit.palettes.find((p) => p.id === brief?.palette)
  return { kit, palette: chosen ?? kit.palettes[0] }
}
