export interface YM {
  y: number
  m: number
}

// Column definition for the dynamic column system
export interface ColumnDef {
  id: string
  label: string
  color: string
  locked?: boolean        // true = always visible, can't hide/remove (work, projects, education)
  private?: boolean       // shows lock icon in header
  width: 'full' | 'half'  // half = COL_W/2 (74px)
  renderType: 'bar' | 'slot' | 'marker'  // rendering style for items in this column
  noAdd?: boolean         // true = double-click header doesn't open add modal
  visible: boolean        // user toggle (always true for locked columns)
  sortOrder: number       // position within its zone (locked cols sorted first)
}

// Unified timeline item
export interface TimelineItem {
  id: string
  cat: string
  title: string
  start: string
  end: string | null
  color: string
  fuzzyStart: boolean
  fuzzyEnd: boolean
  note: string
  description?: string
  source: 'chronicle' | 'work' | 'contact' | 'education'
}

export interface PlaceItem {
  id: string
  title: string
  start: string
  end: string | null
  color: string
  fuzzyStart: boolean
  fuzzyEnd: boolean
  note: string
}
