import type { ColumnDef } from './types'

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
export const CURRENT_YEAR = new Date().getFullYear()
export const COL_W = 148
export const HALF_W = 74
export const COLLAPSED_W = 24
export const AXIS_W = 100
export const MAX_COLUMNS = 8

// Zoom: slider 0 → 60yr visible, 0.5 → ~4yr, 1 → 2yr
export const ZOOM_YEARS_MAX = 60
export const ZOOM_YEARS_MIN = 2
export const ZOOM_GAMMA = 0.38

// localStorage keys
export const LS_SLIDER = 'chronicle_slider_pos'
export const LS_CENTER_YEAR = 'chronicle_center_year'
export const LS_CENTER_MONTH = 'chronicle_center_month'
export const LS_COLLAPSED = 'chronicle_collapsed_cols'
export const LS_COL_CONFIG = 'chronicle_col_config'

// ═══════════════════════════════════════════════
// LOCKED COLUMNS (always visible, always leftmost)
// ═══════════════════════════════════════════════
export const LOCKED_COLS: ColumnDef[] = [
  { id: 'work',      label: 'Work',       color: '#4070a8', locked: true, width: 'full', renderType: 'bar', visible: true, sortOrder: 0 },
  { id: 'project',   label: 'Projects',   color: '#508038', locked: true, width: 'full', renderType: 'bar', visible: true, sortOrder: 1 },
  { id: 'education', label: 'Education',  color: '#2a8a6a', locked: true, width: 'full', renderType: 'bar', visible: true, sortOrder: 2 },
]

// ═══════════════════════════════════════════════
// DEFAULT USER COLUMNS (right zone, togglable)
// ═══════════════════════════════════════════════
export const DEFAULT_USER_COLS: ColumnDef[] = [
  { id: 'personal',   label: 'Personal',   color: '#a85060', width: 'full', renderType: 'bar', visible: true, sortOrder: 0 },
  { id: 'gatherings', label: 'Gatherings', color: '#c06848', width: 'full', renderType: 'slot', visible: true, sortOrder: 1 },
  { id: 'tech',       label: 'Tech',       color: '#986020', width: 'half', renderType: 'bar', visible: true, sortOrder: 2 },
  { id: 'people',     label: 'People',     color: '#7050a8', width: 'full', renderType: 'marker', noAdd: true, visible: true, sortOrder: 3 },
]

// ═══════════════════════════════════════════════
// PRESET COLUMNS (user can add these from settings)
// ═══════════════════════════════════════════════
export const PRESET_COLS: Omit<ColumnDef, 'visible' | 'sortOrder'>[] = [
  { id: 'health',    label: 'Health',    color: '#c04050', width: 'half', renderType: 'bar' },
  { id: 'creative',  label: 'Creative',  color: '#8848a0', width: 'half', renderType: 'bar' },
  { id: 'finance',   label: 'Finance',   color: '#38806a', width: 'half', renderType: 'bar' },
  { id: 'social',    label: 'Social',    color: '#d07828', width: 'full', renderType: 'bar' },
  { id: 'spiritual', label: 'Spiritual', color: '#6878b8', width: 'half', renderType: 'bar' },
  { id: 'residence', label: 'Residences', color: '#806840', width: 'full', renderType: 'bar' },
]

// ═══════════════════════════════════════════════
// COLOR PALETTE — 16 per column hue + 10 universal
// Rows: 4 deep · 4 medium · 4 vivid · 4 pastel
// ═══════════════════════════════════════════════
export const COLUMN_PALETTE: Record<string, string[]> = {
  work: [
    '#0a1e3d', '#122d55', '#1a3c6e', '#224b87',
    '#2d5080', '#4070a8', '#5890c8', '#78b0e0',
    '#2060d0', '#3080f0', '#1a90ff', '#40a8ff',
    '#a0c8f0', '#b8d8f8', '#cce4ff', '#ddeeff',
  ],
  project: [
    '#0e2608', '#1a3a10', '#28501c', '#366828',
    '#306018', '#508038', '#70a050', '#90c070',
    '#38a020', '#50c030', '#48d838', '#68e858',
    '#a8dca0', '#c0e8b8', '#d4f0cc', '#e4f8e0',
  ],
  education: [
    '#082820', '#103828', '#184a38', '#206048',
    '#1a6050', '#2a8a6a', '#40a880', '#60c8a0',
    '#18a878', '#28c890', '#30e0a0', '#48f0b8',
    '#98dcc8', '#b0e8d8', '#c8f0e4', '#ddf8f0',
  ],
  personal: [
    '#401020', '#581828', '#702038', '#882848',
    '#802838', '#a85060', '#c87080', '#e090a0',
    '#d03860', '#e84878', '#f05888', '#f878a0',
    '#f0b8c8', '#f4ccd8', '#f8dde4', '#fceef0',
  ],
  residence: [
    '#281808', '#3c2810', '#503818', '#684820',
    '#604820', '#806840', '#a08858', '#c0a878',
    '#b08030', '#c89838', '#e0b048', '#f0c860',
    '#e0d0a8', '#e8dcc0', '#f0e4d0', '#f4ece0',
  ],
  gatherings: [
    '#501008', '#701810', '#8c2818', '#a83820',
    '#a04828', '#c06848', '#d88868', '#f0a888',
    '#e05030', '#f06838', '#f88048', '#ff9860',
    '#f8c8b0', '#fad8c8', '#fce4d8', '#fef0e8',
  ],
  tech: [
    '#281408', '#3c2010', '#503018', '#684020',
    '#604018', '#986020', '#b88040', '#d8a060',
    '#c07818', '#d89020', '#f0a828', '#ffc038',
    '#e8d0a0', '#f0dcb8', '#f4e4c8', '#f8edd8',
  ],
  people: [
    '#180c30', '#281848', '#382460', '#483078',
    '#482870', '#7050a8', '#9070c8', '#b090e0',
    '#6040d0', '#7858e8', '#8868f8', '#a080ff',
    '#c8b8f0', '#d8ccf4', '#e4dcf8', '#f0eafc',
  ],
  health: [
    '#400810', '#601018', '#801820', '#a02028',
    '#b03040', '#c04050', '#d06068', '#e08088',
    '#e03040', '#f04050', '#ff5060', '#ff7080',
    '#f0b0b8', '#f4c4cc', '#f8d8dc', '#fce8ec',
  ],
  creative: [
    '#2c1040', '#401858', '#582470', '#703088',
    '#683890', '#8848a0', '#a868b8', '#c888d0',
    '#9838c0', '#b048d8', '#c058f0', '#d078ff',
    '#d8b8e8', '#e4ccf0', '#ecdcf4', '#f4ecf8',
  ],
  finance: [
    '#082820', '#103830', '#184838', '#205848',
    '#286850', '#38806a', '#489880', '#60b098',
    '#28a878', '#38c090', '#40d8a0', '#58f0b8',
    '#a0dcc8', '#b8e8d8', '#ccf0e4', '#e0f8f0',
  ],
  social: [
    '#482008', '#603010', '#784018', '#905020',
    '#b06020', '#d07828', '#e89840', '#f8b860',
    '#e88818', '#f8a028', '#ffb838', '#ffc850',
    '#f8dca8', '#fae4c0', '#fcecd0', '#fef4e0',
  ],
  spiritual: [
    '#282848', '#383860', '#485078', '#586890',
    '#5868a0', '#6878b8', '#8098d0', '#98b0e0',
    '#5070d0', '#6088e8', '#7098f8', '#88b0ff',
    '#b8c8f0', '#c8d8f4', '#dce4f8', '#e8f0fc',
  ],
}

// Universal colors available to any column
export const UNIVERSAL_COLORS = [
  '#c83030', '#e06020', '#d4a820', '#48a048',
  '#2080b0', '#4858a8', '#8040a0', '#a04870',
  '#505050', '#1a1812',
]

// Default color per column ID (for items that don't specify one)
export const DEFAULT_COLORS: Record<string, string> = {
  work: '#4070a8', project: '#508038', education: '#2a8a6a', personal: '#a85060',
  residence: '#806840', gatherings: '#c06848', tech: '#986020', people: '#7050a8',
  health: '#c04050', creative: '#8848a0', finance: '#38806a', social: '#d07828',
  spiritual: '#6878b8',
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

/** Build the full resolved column list: locked left + visible user right */
export function resolveColumns(userCols: ColumnDef[]): ColumnDef[] {
  const sorted = [...userCols].sort((a, b) => a.sortOrder - b.sortOrder)
  return [...LOCKED_COLS, ...sorted.filter(c => c.visible)]
}

/** Build the complete column list (including hidden) for settings panel */
export function allColumns(userCols: ColumnDef[]): ColumnDef[] {
  const sorted = [...userCols].sort((a, b) => a.sortOrder - b.sortOrder)
  return [...LOCKED_COLS, ...sorted]
}

/** Load user column config from localStorage, or return defaults */
export function loadUserColumns(): ColumnDef[] {
  if (typeof window === 'undefined') return DEFAULT_USER_COLS
  try {
    const saved = localStorage.getItem(LS_COL_CONFIG)
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnDef[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_USER_COLS
}

/** Save user column config to localStorage */
export function saveUserColumns(cols: ColumnDef[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_COL_CONFIG, JSON.stringify(cols))
}

// Legacy export: the old COLS shape for anything that still references it during migration
// This will be removed once ChronicleCanvas is fully migrated
export const COLS = [...LOCKED_COLS, ...DEFAULT_USER_COLS]

// Legacy: columns where double-click should NOT open add modal
// Now driven by noAdd on ColumnDef, but kept for transition
export const NO_ADD_COLS = new Set(
  [...LOCKED_COLS, ...DEFAULT_USER_COLS, ...PRESET_COLS.map(p => ({ ...p, visible: true, sortOrder: 0 }))]
    .filter(c => c.noAdd).map(c => c.id)
)
