export interface Contact {
  id: string;
  owner_id: string;
  linked_profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  location: string | null;
  relationship_type: string | null;
  follow_up_status: string | null;
  last_contact_date: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
  ai_summary: string | null;
  how_we_met: string | null;
  met_date: string | null;
  avatar_url: string | null;
  show_on_chronicle: boolean;
  created_at: string;
}

export interface KeyLink {
  type: string;
  url: string;
  visible: boolean;
}

export interface LinkedProfile {
  full_name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar_url: string | null;
  key_links: KeyLink[] | null;
}

export interface LinkedWorkEntry {
  id: string;
  title: string;
  company: string | null;
  engagement_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  location: string | null;
}

export interface LinkedChronicleEntry {
  id: string;
  type: string;
  title: string;
  start_date: string;
  end_date: string | null;
  canvas_col: string;
  note: string | null;
  description: string | null;
}

export interface LinkedEducationEntry {
  id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

export interface NoteEntry {
  id: string;
  contact_id: string;
  owner_id: string;
  content: string;
  context: string | null;
  entry_date: string;
  action_text: string | null;
  action_due_date: string | null;
  action_completed: boolean;
  created_at: string;
}
