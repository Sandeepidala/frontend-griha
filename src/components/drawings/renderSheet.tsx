import type { ComponentType } from 'react'
import type { SheetKind } from '@/lib/drawings/sheets'
import { ElevationsSheet, FloorPlanSheet, RoofPlanSheet, SectionsSheet } from './sheets/ArchitecturalSheets'
import type { SheetProps } from './sheets/common'
import { EstimateSheet, SummarySheet } from './sheets/GeneralSheets'
import { ElectricalLayoutSheet, LightingSheet, PowerSheet } from './sheets/ElectricalSheets'
import { FalseCeilingSheet, FurnitureSheet, KitchenSheet } from './sheets/InteriorSheets'
import { DrainageSheet, SanitarySheet, WaterSupplySheet } from './sheets/PlumbingSheets'
import { LandscapingSheet, SetbacksSheet, SiteLayoutSheet } from './sheets/SiteSheets'
import { BeamLayoutSheet, ColumnLayoutSheet, FoundationSheet, SlabLayoutSheet, StaircaseSheet } from './sheets/StructuralSheets'

export type { SheetProps }

/** 2D sheet components by kind; 3D model sheets are rendered by Model3DSheet instead. */
export const SHEET_COMPONENTS: Partial<Record<SheetKind, ComponentType<SheetProps>>> = {
  summary: SummarySheet,
  estimate: EstimateSheet,
  'site-layout': SiteLayoutSheet,
  setbacks: SetbacksSheet,
  landscaping: LandscapingSheet,
  'floor-plan': FloorPlanSheet,
  'roof-plan': RoofPlanSheet,
  elevations: ElevationsSheet,
  sections: SectionsSheet,
  foundation: FoundationSheet,
  columns: ColumnLayoutSheet,
  beams: BeamLayoutSheet,
  slabs: SlabLayoutSheet,
  staircase: StaircaseSheet,
  lighting: LightingSheet,
  power: PowerSheet,
  'electrical-layout': ElectricalLayoutSheet,
  'water-supply': WaterSupplySheet,
  drainage: DrainageSheet,
  sanitary: SanitarySheet,
  furniture: FurnitureSheet,
  kitchen: KitchenSheet,
  'false-ceiling': FalseCeilingSheet,
}
