export interface YM {
  y: number
  m: number
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
