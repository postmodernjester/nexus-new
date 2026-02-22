export interface Profile {
  id: string
  user_id: string
  full_name: string
  headline?: string
  bio?: string
  location?: string
  website?: string
  avatar_url?: string
  is_public: boolean
  ai_strengths?: string[]
  ai_interests?: string[]
  ai_positioning?: string
  ai_trajectory?: string
  created_at: string
  updated_at: string
}

export interface WorkEntry {
  id: string
  user_id: string
  title: string
  organization: string
  organization_id?: string
  engagement_type: EngagementType
  start_date: string
  end_date?: string
  is_active: boolean
  location?: string
  location_type?: LocationType
  description?: string
  ai_enhanced_description?: string
  skills: string[]
  media_items: MediaItem[]
  notify_connections: boolean
  compensation_type?: CompensationType
  compensation_amount?: number
  compensation_currency?: string
  estimated_hours?: number
  total_project_value?: number
  payment_status?: PaymentStatus
  compensation_notes?: string
  headline_override?: string
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  owner_id: string
  full_name: string
  company?: string
  role?: string
  location?: string
  email?: string
  phone?: string
  website?: string
  relationship_type: RelationshipType
  how_we_met?: string
  follow_up_status?: FollowUpStatus
  last_contact_date?: string
  next_action_date?: string
  tags: string[]
  is_claimable: boolean
  claimed_by?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  contact_id: string
  owner_id: string
  content: string
  created_at: string
}

export interface Communication {
  id: string
  contact_id: string
  owner_id: string
  type: 'meeting' | 'call' | 'email' | 'message' | 'other'
  subject?: string
  notes?: string
  date: string
  created_at: string
}

export interface FinancialTransaction {
  id: string
  contact_id?: string
  work_entry_id?: string
  owner_id: string
  amount: number
  currency: string
  type: 'income' | 'expense'
  description?: string
  date: string
  created_at: string
}

export interface RelationshipEdge {
  id: string
  source_id: string
  target_id: string
  relationship_type: RelationshipType
  strength: number
  communication_frequency: number
  collaboration_depth: number
  value_exchanged: number
  created_at: string
  updated_at: string
}

export interface MediaItem {
  id: string
  type: 'image' | 'pdf' | 'link' | 'video' | 'audio' | 'book'
  url: string
  title?: string
  description?: string
}

export interface GraphNode {
  id: string
  name: string
  avatar_url?: string
  role?: string
  company?: string
  connections: number
  relationship_strength: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  strength: number
  communication_intensity: number
}

export type EngagementType =
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'freelance'
  | 'advisory'
  | 'internship'
  | 'project-based'
  | 'volunteer'
  | 'board-member'
  | 'self-employed'
  | 'other'

export type LocationType =
  | 'on-site'
  | 'hybrid'
  | 'remote'
  | 'travel-based'
  | 'multi-location'

export type CompensationType =
  | 'salary'
  | 'hourly'
  | 'project-fee'
  | 'retainer'
  | 'equity'
  | 'revenue-share'

export type PaymentStatus =
  | 'paid'
  | 'partially-paid'
  | 'pending'
  | 'pro-bono'

export type RelationshipType =
  | 'None'
  | 'Acquaintance'
  | 'Business Contact'
  | 'Work-Friend'
  | 'Close Friend'
  | 'Family'

export type FollowUpStatus =
  | 'none'
  | 'pending'
  | 'scheduled'
  | 'overdue'
  | 'completed'
